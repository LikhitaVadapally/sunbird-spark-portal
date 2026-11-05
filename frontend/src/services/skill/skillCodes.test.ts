import { describe, it, expect } from 'vitest';
import { buildSkillVocabulary } from './skillTree';
import { toSkillCode, withSkillCodes } from './skillCodes';
import type { LearningPathModel } from '../../types/learningPathTypes';

// Shape of the live USF read: flat categories, skills under `skill`.
const usf = buildSkillVocabulary('USF', {
  framework: {
    categories: [
      { code: 'industry', terms: [{ code: 'it', name: 'Information Technology' }] },
      { code: 'skill', terms: [{ code: 'dv', name: 'Data Visualization' }, { code: 'pp', name: 'Python Programming' }] },
    ],
  },
});
const health = buildSkillVocabulary('fw_health', {
  framework: {
    categories: [
      { code: 'competency', terms: [{ code: 'ipc', name: 'Infection Prevention', children: [{ code: 'hand-hygiene', name: 'Hand Hygiene' }] }] },
    ],
  },
});

describe('buildSkillVocabulary codeByName', () => {
  it('indexes skill-category names, lower-cased', () => {
    expect(usf.codeByName).toEqual({ 'data visualization': 'dv', 'python programming': 'pp' });
  });

  it('leaves out non-skill categories such as industry', () => {
    expect(usf.codeByName['information technology']).toBeUndefined();
  });

  it('drops a name two codes share', () => {
    const dup = buildSkillVocabulary('x', {
      framework: { categories: [{ code: 'skill', terms: [{ code: 'a', name: 'Same' }, { code: 'b', name: 'same' }] }] },
    });
    expect(dup.codeByName).toEqual({});
  });
});

describe('toSkillCode', () => {
  it('passes a known code through', () => {
    expect(toSkillCode([usf, health], 'hand-hygiene')).toBe('hand-hygiene');
    expect(toSkillCode([usf], 'dv', 'USF')).toBe('dv');
  });

  it('resolves a USF name to its code, ignoring case', () => {
    expect(toSkillCode([usf, health], 'Data Visualization', 'USF')).toBe('dv');
    expect(toSkillCode([usf], ' data visualization ')).toBe('dv');
  });

  it('leaves an unknown tag unchanged', () => {
    expect(toSkillCode([usf], 'Cloud Computing', 'USF')).toBe('Cloud Computing');
    expect(toSkillCode([undefined], 'anything')).toBe('anything');
  });
});

describe('withSkillCodes', () => {
  it('maps every *Codes field and keeps display names', () => {
    const course = { identifier: 'c1', name: 'C', leafNodesCount: 1, leafIds: [], skills: ['Data Visualization'], skillCodes: ['Data Visualization'], isAssessmentCourse: false };
    const model = {
      identifier: 'lp', name: 'LP', policy: 'Fixed', competencyFramework: 'USF',
      levels: [{ identifier: 'l1', name: 'L1', index: 0, skills: [], skillCodes: ['Data Visualization'], ownSkillCodes: ['Python Programming'], courses: [course] }],
      allSkills: ['Data Visualization'], allSkillCodes: ['Data Visualization', 'Python Programming'], courseTotal: 1, leafTotal: 1,
    } as unknown as LearningPathModel;
    const codeOf = (tag: string, fw?: string) => toSkillCode([usf], tag, fw);

    const out = withSkillCodes(model, codeOf);
    expect(out.allSkillCodes).toEqual(['dv', 'pp']);
    expect(out.levels[0]?.skillCodes).toEqual(['dv']);
    expect(out.levels[0]?.ownSkillCodes).toEqual(['pp']);
    expect(out.levels[0]?.courses[0]?.skillCodes).toEqual(['dv']);
    expect(out.levels[0]?.courses[0]?.skills).toEqual(['Data Visualization']);
  });
});
