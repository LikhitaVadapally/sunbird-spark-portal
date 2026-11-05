import { describe, it, expect } from 'vitest';
import { computePathSkills, computeRoleReadiness } from './pathSkillStatus';
import type { LearningPathModel, LPCourseNode } from '@/types/learningPathTypes';

const course = (id: string, codes: string[]): LPCourseNode => ({
  identifier: id, name: id, leafNodesCount: 2, leafIds: [`${id}_a`, `${id}_b`],
  skills: [], skillCodes: codes, isAssessmentCourse: false,
});

const model = (courses: LPCourseNode[], all: string[]): LearningPathModel => ({
  identifier: 'lp', name: 'LP', policy: 'Fixed',
  levels: [{ identifier: 'l1', name: 'L1', index: 1, skills: [], skillCodes: [], courses }],
  allSkills: [], allSkillCodes: all, courseTotal: courses.length, leafTotal: courses.length * 2,
});

const m = model(
  [course('c1', ['dosage-calculation', 'iv-administration']), course('c2', ['hand-hygiene'])],
  ['dosage-calculation', 'iv-administration', 'hand-hygiene']
);

describe('computePathSkills', () => {
  it('reports a skill as held when the profile holds it, from any source', () => {
    const r = computePathSkills(m, new Set(['hand-hygiene']), new Set());
    expect(r.skills.find((s) => s.code === 'hand-hygiene')?.state).toBe('held');
    expect(r.held).toBe(1);
  });

  it('reports skills on unfinished courses as pending', () => {
    const r = computePathSkills(m, new Set(), new Set());
    expect(r.skills.map((s) => s.state)).toEqual(['pending', 'pending', 'pending']);
    expect(r.total).toBe(3);
  });

  // The profile is the truth for "gained": finishing a course does not by itself grant its skills.
  it('leaves out a finished course skill the profile does not record', () => {
    const r = computePathSkills(m, new Set(), new Set(['c1']));
    expect(r.skills.map((s) => s.code)).toEqual(['hand-hygiene']);
  });

  it('lists held skills before pending ones', () => {
    const r = computePathSkills(m, new Set(['iv-administration']), new Set());
    expect(r.skills[0]).toEqual({ code: 'iv-administration', state: 'held' });
  });
});

describe('computeRoleReadiness', () => {
  it('is undefined while the role has no skills mapped', () => {
    expect(computeRoleReadiness(undefined, new Set(['a']), ['a'])).toBeUndefined();
    expect(computeRoleReadiness([], new Set(['a']), ['a'])).toBeUndefined();
  });

  it('counts required skills held from any source, and flags ones the path does not teach', () => {
    const r = computeRoleReadiness(['a', 'b', 'c', 'd'], new Set(['a', 'd']), ['a', 'b']);
    expect(r).toEqual({ held: 2, required: 4, readiness: 50, notTaught: ['c'] });
  });
});

