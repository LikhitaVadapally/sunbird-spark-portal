import type { LearningPathModel, LPCourseNode, LPLevelNode } from '@/types/learningPathTypes';

/**
 * The model with every displayed skill list rebuilt from its codes through `nameOf` - the
 * framework's authored names ("French Cuisine") instead of the mapper's de-slugged codes
 * ("Cuisine french"). The mapper can't do this itself: names need the framework read.
 */
export function withSkillNames(model: LearningPathModel, nameOf: (code: string) => string): LearningPathModel {
  const names = (codes: string[]) => [...new Set(codes.map(nameOf))];
  const course = (c: LPCourseNode): LPCourseNode => (c.skillCodes.length ? { ...c, skills: names(c.skillCodes) } : c);
  const level = (l: LPLevelNode): LPLevelNode => {
    const courses = l.courses.map(course);
    return { ...l, courses, ...(l.skillCodes.length ? { skills: names(l.skillCodes) } : {}) };
  };
  const levels = model.levels.map(level);
  const priorAssessment = model.priorAssessment && course(model.priorAssessment);
  const outcomeAssessment = model.outcomeAssessment && course(model.outcomeAssessment);
  const allSkills = [...new Set([
    ...(priorAssessment?.skills ?? []),
    ...levels.flatMap((l) => l.skills),
    ...(outcomeAssessment?.skills ?? []),
  ])];
  return { ...model, levels, priorAssessment, outcomeAssessment, allSkills };
}
