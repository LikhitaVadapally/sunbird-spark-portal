import { describe, it, expect } from 'vitest';
import { withSkillNames } from './skillNames';
import type { LearningPathModel } from '@/types/learningPathTypes';

const course = (codes: string[]) => ({ identifier: 'c', name: 'c', leafIds: [], units: [], skills: codes, skillCodes: codes, isAssessmentCourse: false }) as never;

describe('withSkillNames', () => {
  const names: Record<string, string> = { 'cuisine-french': 'French Cuisine', 'cuisine-italian': 'Italian Cuisine' };
  const nameOf = (code: string) => names[code] ?? code;
  const model = {
    identifier: 'lp', name: 'LP', policy: 'Fixed', allSkills: ['Cuisine french'], allSkillCodes: ['cuisine-french'],
    courseTotal: 1, leafTotal: 1,
    levels: [{ identifier: 'l1', name: 'L1', index: 1, skills: ['Cuisine french', 'Cuisine italian'], skillCodes: ['cuisine-french', 'cuisine-italian'], ownSkillCodes: [], courses: [course(['cuisine-french'])] }],
  } as unknown as LearningPathModel;

  // The framework's authored names, not the de-slugged codes ("Cuisine french").
  it('names Level, course and path skills from their codes', () => {
    const out = withSkillNames(model, nameOf);
    expect(out.levels[0]!.skills).toEqual(['French Cuisine', 'Italian Cuisine']);
    expect(out.levels[0]!.courses[0]!.skills).toEqual(['French Cuisine']);
    expect(out.allSkills).toEqual(['French Cuisine', 'Italian Cuisine']);
  });

  it('keeps a code no framework knows as the de-slugged name it already had', () => {
    const out = withSkillNames(model, (c) => (c === 'cuisine-french' ? 'French Cuisine' : 'Cuisine italian'));
    expect(out.levels[0]!.skills).toEqual(['French Cuisine', 'Cuisine italian']);
  });
});
