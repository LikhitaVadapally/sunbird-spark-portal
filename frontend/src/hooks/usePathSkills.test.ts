import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePathSkills } from './usePathSkills';
import type { LearningPathModel, LPCourseNode } from '@/types/learningPathTypes';

const CODE_BY_NAME: Record<string, string> = { 'Python Programming': 'pp', 'SQL Basics': 'sql' };

vi.mock('./useSkillProfile', () => ({
  useSkillProfile: () => ({ skills: [{ skillId: 'pp', frameworkId: 'USF' }], frameworkIds: ['USF'], isLoading: false }),
  useSkillLabels: () => ({
    labelOf: (code: string) => ({ name: code, resolved: true }),
    codeOf: (tag: string) => CODE_BY_NAME[tag] ?? tag,
    isLoading: false,
  }),
  // Role `analyst` needs `sql`, which only a course teaches (the root is tagged `pp` alone).
  useSkillFrameworks: () => ({
    metas: { USF: { frameworkId: 'USF', roles: { analyst: ['sql'] }, roleNames: { analyst: 'Analyst' }, roleCodes: ['analyst'] } },
    isLoading: false,
  }),
}));

const course = (identifier: string, skillCodes: string[]): LPCourseNode => ({
  identifier,
  name: identifier,
  leafNodesCount: 1,
  leafIds: [`${identifier}-leaf`],
  skills: skillCodes,
  skillCodes,
  isAssessmentCourse: false,
});

/** A USF path: tagged by skill NAME, while the profile holds codes. */
const model: LearningPathModel = {
  identifier: 'lp1',
  name: 'Data path',
  policy: 'Fixed',
  levels: [
    {
      identifier: 'l1',
      name: 'Level 1',
      index: 0,
      skills: ['Python Programming', 'SQL Basics'],
      skillCodes: ['Python Programming', 'SQL Basics'],
      courses: [course('c1', ['Python Programming']), course('c2', ['SQL Basics'])],
    },
  ],
  allSkills: ['Python Programming'],
  allSkillCodes: ['Python Programming'],
  targetRole: 'analyst',
  competencyFramework: 'USF',
  courseTotal: 2,
  leafTotal: 2,
};

describe('usePathSkills', () => {
  it('returns the path with skill names turned into the codes the profile holds', () => {
    const { result } = renderHook(() => usePathSkills(model, new Map()));
    expect(result.current.model.levels[0]?.skillCodes).toEqual(['pp', 'sql']);
    expect(result.current.model.levels[0]?.courses[1]?.skillCodes).toEqual(['sql']);
    // So a held skill matches: `pp` is gained, not merely "in scope".
    expect(result.current.stateOf('pp')?.state).toBe('held');
  });

  it('counts a skill taught by a course as on the path, even when the root tag omits it', () => {
    const { result } = renderHook(() => usePathSkills(model, new Map()));
    expect(result.current.role?.code).toBe('analyst');
    expect(result.current.role?.notTaught).toEqual([]);
  });
});
