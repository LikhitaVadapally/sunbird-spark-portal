import { describe, it, expect } from 'vitest';
import {
  aggregateMySkills,
  buildMySkills,
  filterMySkills,
  getMostReinforcedSkills,
  toSourceKind,
} from './mySkills';
import { derivePathSkillCodes } from '../learningPath/skillAggregation';
import type { PathSkillSummary } from '../learningPath/skillAggregation';
import type { HeldSkill } from '../../types/skillServiceTypes';
import type { LearningPathModel, LPCourseNode, LPLevelNode } from '../../types/learningPathTypes';

const SEP_2 = Date.UTC(2026, 8, 2);
const SEP_12 = Date.UTC(2026, 8, 12);

function held(skillId: string, sourceType: string, attainedOn?: number, overrides: Partial<HeldSkill> = {}): HeldSkill {
  return {
    skillId,
    frameworkId: 'nursing_fw',
    sourceType,
    ...(attainedOn !== undefined ? { attainedOn } : {}),
    evidence: [],
    ...overrides,
  };
}

function course(identifier: string, skillCodes: string[]): LPCourseNode {
  return { identifier, name: identifier, leafNodesCount: 1, leafIds: [`${identifier}-leaf`], skills: [], skillCodes, isAssessmentCourse: false };
}

function level(identifier: string, courses: LPCourseNode[], ownSkillCodes: string[] = []): LPLevelNode {
  return { identifier, name: identifier, index: 0, skills: [], skillCodes: ownSkillCodes, ownSkillCodes, courses };
}

function model(identifier: string, levels: LPLevelNode[]): LearningPathModel {
  return { identifier, name: identifier, policy: 'Fixed', levels, allSkills: [], allSkillCodes: [], courseTotal: 0, leafTotal: 0 };
}

/** A path summary straight from the hierarchy - the same derivation `buildPathSkillSummary` uses. */
function path(m: LearningPathModel, finished: string[] = [], over: Partial<PathSkillSummary> = {}): PathSkillSummary {
  return {
    pathId: m.identifier,
    contextId: `${m.identifier}-batch`,
    pathName: m.identifier === 'icu' ? 'ICU Nurse Induction' : m.identifier,
    progressPct: 50,
    status: 'ongoing',
    ...derivePathSkillCodes(m, new Set(finished)),
    ...over,
  };
}

/** Asha: enrolled in ICU Nurse Induction, finished 3 of its 5 courses. */
const icu = model('icu', [
  level('l1', [course('c1', ['dosage-calculation']), course('c2', ['iv-administration']), course('c3', ['ppe-use'])]),
  level('l2', [course('c4', ['sterile-field', 'ppe-use']), course('c5', [])], ['wound-care']),
]);
const ashaPath = path(icu, ['c1', 'c2', 'c3']);
const ashaProfile = [
  held('dosage-calculation', 'LEARNING_PATH', SEP_12),
  held('hand-hygiene', 'COURSE', SEP_2),
  held('neonatal-resuscitation', 'EXTERNAL', undefined, {
    evidence: [{ evidenceId: 'e1', sourceType: 'EXTERNAL', sourceId: 'nrp-cert', occurredOn: SEP_2, revoked: false }],
  }),
  held('ppe-use', 'ASSESSMENT', SEP_2),
];

const byCode = (entries: ReturnType<typeof buildMySkills>, code: string) => entries.find((e) => e.code === code);

describe('buildMySkills - the gained/pending rule', () => {
  const skills = buildMySkills(ashaProfile, [ashaPath]);

  // (a)
  it('counts a skill from a standalone course (in no path) as gained', () => {
    expect(byCode(skills, 'hand-hygiene')).toMatchObject({ gained: true, source: 'course', gainedAt: SEP_2, paths: [] });
  });

  // (b)
  it('counts a skill held from elsewhere as gained - never pending - even on an unfinished path course', () => {
    const ppe = byCode(skills, 'ppe-use');
    expect(ppe).toMatchObject({ gained: true, source: 'assessment' });
    expect(skills.filter((e) => e.code === 'ppe-use')).toHaveLength(1);
  });

  // (c)
  it('shows an external certificate as gained, dated from its evidence', () => {
    expect(byCode(skills, 'neonatal-resuscitation')).toMatchObject({ gained: true, source: 'external', gainedAt: SEP_2 });
  });

  it('lists skills on unfinished path courses as pending, with the path', () => {
    expect(byCode(skills, 'sterile-field')).toMatchObject({
      gained: false,
      paths: [{ pathId: 'icu', contextId: 'icu-batch', pathName: 'ICU Nurse Induction' }],
    });
  });

  // (d)
  it("falls back to the Level's skills for an untagged unfinished course", () => {
    expect(byCode(skills, 'wound-care')).toMatchObject({ gained: false });
  });

  // (e)
  it('neither gains nor pends a finished course skill the profile does not record', () => {
    expect(byCode(skills, 'iv-administration')).toBeUndefined();
  });

  // (f)
  it('counts a code pending in two paths once, carrying both paths', () => {
    const other = path(model('other', [level('o1', [course('o-c1', ['sterile-field'])])]));
    const merged = buildMySkills(ashaProfile, [ashaPath, other]);
    const sterile = merged.filter((e) => e.code === 'sterile-field');
    expect(sterile).toHaveLength(1);
    expect(sterile[0]?.paths.map((p) => p.pathId)).toEqual(['icu', 'other']);
  });

  it('merges a code held under two frameworks into one skill with the earliest date', () => {
    const merged = buildMySkills(
      [held('triage', 'COURSE', SEP_12), held('triage', 'ASSESSMENT', SEP_2, { frameworkId: 'other_fw' })],
      []
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.gainedAt).toBe(SEP_2);
  });

  it('lists gained skills first, most recent first', () => {
    expect(skills.map((s) => s.gained)).toEqual([true, true, true, true, false, false]);
    expect(skills[0]?.code).toBe('dosage-calculation');
  });
});

describe('aggregateMySkills', () => {
  it('tallies gained and pending, and paths by status', () => {
    const skills = buildMySkills(ashaProfile, [ashaPath]);
    expect(aggregateMySkills(skills, [ashaPath, { ...ashaPath, pathId: 'done', status: 'completed' }])).toEqual({
      totalSkills: 6,
      gainedSkills: 4,
      pendingSkills: 2,
      pathsCompleted: 1,
      pathsOngoing: 1,
    });
  });
});

describe('toSourceKind', () => {
  it('maps the profile source types, keeping unknown ones visible', () => {
    expect(['COURSE', 'ASSESSMENT', 'LEARNING_PATH', 'EXTERNAL', 'MANUAL', undefined].map(toSourceKind)).toEqual([
      'course',
      'assessment',
      'learningPath',
      'external',
      'other',
      'other',
    ]);
  });
});

describe('filterMySkills', () => {
  const skills = buildMySkills(ashaProfile, [ashaPath]);
  const GROUPS: Record<string, string> = { 'hand-hygiene': 'Infection Prevention', 'ppe-use': 'Infection Prevention' };
  const labelOf = (e: { code: string }) => ({ name: e.code.replace(/-/g, ' '), group: GROUPS[e.code] });

  it('narrows by status', () => {
    expect(filterMySkills(skills, { status: 'pending', labelOf }).map((e) => e.code).sort()).toEqual([
      'sterile-field',
      'wound-care',
    ]);
  });

  it('narrows by group label', () => {
    expect(filterMySkills(skills, { group: 'Infection Prevention', labelOf }).map((e) => e.code).sort()).toEqual([
      'hand-hygiene',
      'ppe-use',
    ]);
  });

  it('searches the displayed name and the path name', () => {
    expect(filterMySkills(skills, { query: 'hand hyg', labelOf }).map((e) => e.code)).toEqual(['hand-hygiene']);
    expect(filterMySkills(skills, { query: 'icu nurse', labelOf }).map((e) => e.code).sort()).toEqual([
      'dosage-calculation',
      'ppe-use',
      'sterile-field',
      'wound-care',
    ]);
  });
});

describe('insights', () => {
  it('returns skills taught by more than one enrolled path', () => {
    const other = path(model('other', [level('o1', [course('o-c1', ['sterile-field'])])]));
    const skills = buildMySkills(ashaProfile, [ashaPath, other]);
    expect(getMostReinforcedSkills(skills).map((s) => s.code)).toEqual(['sterile-field']);
  });
});
