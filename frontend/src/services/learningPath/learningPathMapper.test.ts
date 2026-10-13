import { describe, it, expect } from 'vitest';
import { parseLearningPath } from './learningPathMapper';
import { LP_HIERARCHY_NO_ASSESSMENTS } from './__fixtures__/lpHierarchyNoAssessments.fixture';
import {
  LP_HIERARCHY_WITH_ASSESSMENTS,
  LP_HIERARCHY_EMPTY,
} from './__fixtures__/lpHierarchyWithAssessments.fixture';

describe('parseLearningPath', () => {
  it('parses the real LP hierarchy (two Levels, no prior/outcome assessment)', () => {
    const model = parseLearningPath(LP_HIERARCHY_NO_ASSESSMENTS);

    expect(model.identifier).toBe('do_2146317230884208641312');
    expect(model.name).toBe('TLP-1');
    expect(model.policy).toBe('Fixed');
    expect(model.priorAssessment).toBeUndefined();
    expect(model.outcomeAssessment).toBeUndefined();
    expect(model.levels).toHaveLength(2);
    expect(model.levels[0]!.name).toBe('Level-1');
    expect(model.levels[0]!.index).toBe(1);
    expect(model.levels[1]!.name).toBe('Level-2');
    expect(model.courseTotal).toBe(2);
    expect(model.leafTotal).toBe(3);
  });

  it('falls back to the union of course skills when the Level node has no skill fields of its own', () => {
    const model = parseLearningPath(LP_HIERARCHY_NO_ASSESSMENTS);

    expect(model.levels[0]!.skills.sort()).toEqual(['Java Programming', 'Python Programming'].sort());
    expect(model.levels[1]!.skills).toEqual(['JavaScript']);
    expect(model.allSkills.sort()).toEqual(['Java Programming', 'JavaScript', 'Python Programming'].sort());
  });

  it('marks no course as an assessment course when leaves are pdf/epub/video', () => {
    const model = parseLearningPath(LP_HIERARCHY_NO_ASSESSMENTS);

    model.levels.forEach((level) => {
      level.courses.forEach((course) => {
        expect(course.isAssessmentCourse).toBe(false);
      });
    });
  });

  it('unwraps a single-assessment-course first Level into priorAssessment and a single-assessment-course last Level into outcomeAssessment', () => {
    const model = parseLearningPath(LP_HIERARCHY_WITH_ASSESSMENTS);

    expect(model.priorAssessment).toBeDefined();
    expect(model.priorAssessment?.identifier).toBe('course_prior');
    expect(model.priorAssessment?.isAssessmentCourse).toBe(true);

    expect(model.outcomeAssessment).toBeDefined();
    expect(model.outcomeAssessment?.identifier).toBe('course_outcome');
    expect(model.outcomeAssessment?.isAssessmentCourse).toBe(true);

    // Only the middle Level remains as a content Level.
    expect(model.levels).toHaveLength(1);
    expect(model.levels[0]!.identifier).toBe('level_1');
  });

  it('keeps a mid-level assessment course as a normal course in its Level (not unwrapped)', () => {
    const model = parseLearningPath(LP_HIERARCHY_WITH_ASSESSMENTS);

    const midLevel = model.levels[0]!;
    expect(midLevel.courses).toHaveLength(2);
    const assessCourse = midLevel.courses.find((c) => c.identifier === 'course_1_assess');
    expect(assessCourse?.isAssessmentCourse).toBe(true);
  });

  // v2 renamed the content field `competencies` -> `skills`, and its values became leaf CODES
  // rather than the labels v1 stored. These strings are rendered straight to the learner as chips,
  // so a raw code would surface as a slug.
  it('reads level skills from the Level node skills field, de-slugged for display', () => {
    const model = parseLearningPath(LP_HIERARCHY_WITH_ASSESSMENTS);
    expect(model.levels[0]!.skills).toEqual(['Data literacy', 'Spreadsheet basics']);
  });

  it('never surfaces a raw competency code to the learner', () => {
    const model = parseLearningPath({
      ...LP_HIERARCHY_WITH_ASSESSMENTS,
      children: [{ identifier: 'lvl_x', name: 'L', primaryCategory: 'Level', index: 1,
        skill: ['iv-administration', 'hmis_reporting'], children: [] }],
    } as never);
    expect(model.levels[0]!.skills).toEqual(['Iv administration', 'Hmis reporting']);
    model.levels[0]!.skills.forEach((s) => expect(s).not.toMatch(/[-_]/));
    // the raw codes survive alongside, for matching against held skills
    expect(model.levels[0]!.skillCodes).toEqual(['iv-administration', 'hmis_reporting']);
  });

  it('resolves policy from the root node, defaulting to Fixed for an unknown value', () => {
    const model = parseLearningPath(LP_HIERARCHY_WITH_ASSESSMENTS);
    expect(model.policy).toBe('Diagnostic');

    const unknownPolicy = parseLearningPath({ ...LP_HIERARCHY_NO_ASSESSMENTS, policy: 'Bogus' });
    expect(unknownPolicy.policy).toBe('Fixed');
  });

  // Regression: the live authoring tool writes the lowercase design-label
  // spelling ("adaptive", "strict") rather than the design doc's PascalCase
  // codes ("Diagnostic", "Fixed") - both must resolve to the same policy.
  it.each([
    ['adaptive', 'Diagnostic'],
    ['Adaptive', 'Diagnostic'],
    ['diagnostic', 'Diagnostic'],
    ['strict', 'Fixed'],
    ['Strict', 'Fixed'],
    ['fixed', 'Fixed'],
    ['prior learning', 'PriorLearning'],
    ['prior_learning', 'PriorLearning'],
    ['PriorLearning', 'PriorLearning'],
  ])('normalises policy=%s to %s', (raw, expected) => {
    const model = parseLearningPath({ ...LP_HIERARCHY_NO_ASSESSMENTS, policy: raw });
    expect(model.policy).toBe(expected);
  });

  it('handles an empty Learning Path with no Levels', () => {
    const model = parseLearningPath(LP_HIERARCHY_EMPTY);

    expect(model.levels).toEqual([]);
    expect(model.priorAssessment).toBeUndefined();
    expect(model.outcomeAssessment).toBeUndefined();
    expect(model.courseTotal).toBe(0);
    expect(model.allSkills).toEqual([]);
  });

  it('preserves each course\'s own units (with their leaves) alongside the flattened leafIds', () => {
    const model = parseLearningPath(LP_HIERARCHY_NO_ASSESSMENTS);
    const course = model.levels[0]!.courses[0]!;

    expect(course.units).toHaveLength(2);
    expect(course.units!.map((u) => u.name)).toEqual(['Unit-1', 'Unit-2']);
    expect(course.units!.every((u) => u.isUnit)).toBe(true);

    const unit1 = course.units![0]!;
    expect(unit1.children).toHaveLength(1);
    expect(unit1.children[0]!.name).toBe('LP-Content-1-JavaProg');
    expect(unit1.children[0]!.isUnit).toBe(false);
    // A unit rolls up the leaf ids beneath it; a leaf carries its own id.
    expect(unit1.leafIds).toEqual(['do_21463158442296934411']);
    expect(unit1.children[0]!.leafIds).toEqual(['do_21463158442296934411']);
    // The flattened list stays the source of truth for progress maths.
    expect(course.leafIds).toEqual(course.units!.flatMap((u) => u.leafIds));
  });

  // The rail renders "attempt N of M" for self-assess leaves, so the limit has to
  // survive the hierarchy -> LPUnitNode mapping instead of being dropped.
  it('carries a leaf\'s maxAttempts through into the unit tree', () => {
    const hierarchy = JSON.parse(JSON.stringify(LP_HIERARCHY_NO_ASSESSMENTS));
    const leaf = hierarchy.children[0].children[0].children[0].children[0];
    leaf.mimeType = 'application/vnd.sunbird.questionset';
    leaf.maxAttempts = 3;

    const model = parseLearningPath(hierarchy);
    const mappedLeaf = model.levels[0]!.courses[0]!.units![0]!.children[0]!;
    expect(mappedLeaf.maxAttempts).toBe(3);
  });

  it('omits maxAttempts for leaves that declare none', () => {
    const model = parseLearningPath(LP_HIERARCHY_NO_ASSESSMENTS);
    const mappedLeaf = model.levels[0]!.courses[0]!.units![0]!.children[0]!;
    expect(mappedLeaf.maxAttempts).toBeUndefined();
  });

  it('returns an empty model for a null/undefined root', () => {
    expect(parseLearningPath(null)).toMatchObject({ identifier: '', levels: [], policy: 'Fixed' });
    expect(parseLearningPath(undefined)).toMatchObject({ identifier: '', levels: [], policy: 'Fixed' });
  });

  // REGRESSION: the search indexer mirrors `skill` into `se_skills`, so a course tagged
  // `dosage-calculation` comes back carrying both. Unioning a de-slugged `skill` with a RAW
  // `se_skills` listed each competency twice - the V3 path reported 16 skills for the 8 it teaches.
  it('does not list a skill twice when se_skills mirrors the raw code', () => {
    const model = parseLearningPath({
      ...LP_HIERARCHY_WITH_ASSESSMENTS,
      children: [{ identifier: 'lvl_d', name: 'L', primaryCategory: 'Level', index: 1,
        skill: ['dosage-calculation', 'iv-administration'],
        se_skills: ['dosage-calculation', 'iv-administration'],
        children: [] }],
    } as never);
    expect(model.levels[0]!.skills).toEqual(['Dosage calculation', 'Iv administration']);
  });

  // se_skills is the platform's search-enriched COPY of skill, verified identical on live V3
  // content, so `skill` wins outright when present.
  it('ignores se_skills when skill is present', () => {
    const model = parseLearningPath({
      ...LP_HIERARCHY_WITH_ASSESSMENTS,
      children: [{ identifier: 'lvl_e', name: 'L', primaryCategory: 'Level', index: 1,
        skill: ['hand-hygiene'], se_skills: ['hand-hygiene', 'something-else'], children: [] }],
    } as never);
    expect(model.levels[0]!.skills).toEqual(['Hand hygiene']);
  });

  // Older content carries se_skills with no `skill`, holding real taxonomy labels.
  it('falls back to se_skills when the node has no skill field', () => {
    const model = parseLearningPath({
      ...LP_HIERARCHY_WITH_ASSESSMENTS,
      children: [{ identifier: 'lvl_f', name: 'L', primaryCategory: 'Level', index: 1,
        se_skills: ['Data literacy'], children: [] }],
    } as never);
    expect(model.levels[0]!.skills).toEqual(['Data literacy']);
  });

  // My Skills keys pending skills by CODE, so the codes need the same skill -> se_skills fallback.
  it('takes codes from se_skills too when a course has no skill field', () => {
    const model = parseLearningPath({
      ...LP_HIERARCHY_WITH_ASSESSMENTS,
      children: [{ identifier: 'lvl_g', name: 'L', primaryCategory: 'Level', index: 1, children: [
        { identifier: 'c_g', name: 'C', mimeType: 'application/vnd.ekstep.content-collection',
          se_skills: ['hand-hygiene'], children: [{ identifier: 'r_g', mimeType: 'video/mp4' }] },
      ] }],
    } as never);
    expect(model.levels[0]!.courses[0]!.skillCodes).toEqual(['hand-hygiene']);
  });

  // An untagged course falls back to its Level's OWN codes, not the union of its siblings'.
  it("keeps a Level's own codes apart from the union of its courses' codes", () => {
    const course = (id: string, skill?: string[]) => ({ identifier: id, name: id,
      mimeType: 'application/vnd.ekstep.content-collection', ...(skill ? { skill } : {}),
      children: [{ identifier: `${id}_r`, mimeType: 'video/mp4' }] });
    const model = parseLearningPath({
      ...LP_HIERARCHY_WITH_ASSESSMENTS,
      children: [
        { identifier: 'tagged', name: 'T', primaryCategory: 'Level', index: 1, skill: ['wound-care'],
          children: [course('c1', ['sterile-field']), course('c2')] },
        { identifier: 'untagged', name: 'U', primaryCategory: 'Level', index: 2,
          children: [course('c3', ['ppe-use']), course('c4')] },
      ],
    } as never);
    expect(model.levels[0]!.ownSkillCodes).toEqual(['wound-care']);
    expect(model.levels[1]!.ownSkillCodes).toEqual([]);
    expect(model.levels[1]!.skillCodes).toEqual(['ppe-use']);
  });

  it('falls back to the taxonomy framework when the path names no competency framework', () => {
    const model = parseLearningPath({ ...LP_HIERARCHY_WITH_ASSESSMENTS, framework: 'nursing_fw' } as never);
    expect(model.competencyFramework).toBe('nursing_fw');
  });
});

