import type { SkillVocabulary } from './skillTree';
import type { LearningPathModel, LPCourseNode } from '../../types/learningPathTypes';

/** Turns a content skill tag into the code the skill profile stores. */
export type CodeOf = (tag: string, frameworkId?: string) => string;

/**
 * The skill code a content tag names.
 *
 * Competency content is tagged with CODES ("dosage-calculation"); taxonomy content (USF) with the
 * term NAME ("Data Visualization"), while the profile stores the code ("dv") - the same rule the
 * skill service applies when it awards the skill. So: a tag some framework already knows as a code
 * passes through; else the preferred framework's name match, then any framework's; else the tag
 * unchanged, so an unknown tag still shows and simply never matches.
 */
export function toSkillCode(
  vocabularies: Array<SkillVocabulary | undefined>,
  tag: string,
  preferredFrameworkId?: string
): string {
  const loaded = vocabularies.filter((v): v is SkillVocabulary => Boolean(v));
  if (loaded.some((v) => v.labels[tag])) return tag;
  const key = tag.trim().toLowerCase();
  const preferred = loaded.find((v) => v.frameworkId === preferredFrameworkId)?.codeByName[key];
  return preferred ?? loaded.map((v) => v.codeByName[key]).find(Boolean) ?? tag;
}

/**
 * A path model with every skill tag turned into a code, so it can be matched against held skills.
 *
 * Only the `*Codes` fields change; `skills` stay as authored, for display.
 */
export function withSkillCodes(model: LearningPathModel, codeOf: CodeOf): LearningPathModel {
  const fw = model.competencyFramework;
  const map = (codes: string[]) => [...new Set(codes.map((c) => codeOf(c, fw)))];
  const course = (c: LPCourseNode): LPCourseNode => ({ ...c, skillCodes: map(c.skillCodes) });
  return {
    ...model,
    allSkillCodes: map(model.allSkillCodes),
    levels: model.levels.map((level) => ({
      ...level,
      skillCodes: map(level.skillCodes),
      ...(level.ownSkillCodes ? { ownSkillCodes: map(level.ownSkillCodes) } : {}),
      courses: level.courses.map(course),
    })),
    ...(model.priorAssessment ? { priorAssessment: course(model.priorAssessment) } : {}),
    ...(model.outcomeAssessment ? { outcomeAssessment: course(model.outcomeAssessment) } : {}),
  };
}
