import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePathSkills } from './usePathSkills';
import type { LearningPathModel, LPCourseNode } from '@/types/learningPathTypes';

vi.mock('./useSkillProfile', () => ({
  useSkillProfile: () => ({ skills: [{ skillId: 'pp', frameworkId: 'fw' }], frameworkIds: ['fw'], isLoading: false }),
  useSkillLabels: () => ({ labelOf: (code: string) => ({ name: code, resolved: true }), isLoading: false }),
  // Role `analyst` needs `sql`, which only a course teaches (the root is tagged `pp` alone).
  useSkillFrameworks: () => ({
    metas: { fw: { frameworkId: 'fw', roles: { analyst: ['sql'] }, roleNames: { analyst: 'Analyst' }, roleCodes: ['analyst'] } },
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

const model: LearningPathModel = {
  identifier: 'lp1',
  name: 'Data path',
  policy: 'Fixed',
  levels: [
    {
      identifier: 'l1',
      name: 'Level 1',
      index: 0,
      skills: ['pp', 'sql'],
      skillCodes: ['pp', 'sql'],
      courses: [course('c1', ['pp']), course('c2', ['sql'])],
    },
  ],
  allSkills: ['pp'],
  allSkillCodes: ['pp'],
  targetRole: 'analyst',
  competencyFramework: 'fw',
  courseTotal: 2,
  leafTotal: 2,
};

describe('usePathSkills', () => {
  it('marks a skill the learner holds as held on the path', () => {
    const { result } = renderHook(() => usePathSkills(model, new Map()));
    expect(result.current.stateOf('pp')?.state).toBe('held');
    expect(result.current.stateOf('sql')?.state).not.toBe('held');
  });

  it('counts a skill taught by a course as on the path, even when the root tag omits it', () => {
    const { result } = renderHook(() => usePathSkills(model, new Map()));
    expect(result.current.role?.code).toBe('analyst');
    expect(result.current.role?.notTaught).toEqual([]);
  });
});
