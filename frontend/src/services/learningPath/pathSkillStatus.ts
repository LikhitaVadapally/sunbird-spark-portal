import type { LearningPathModel } from '@/types/learningPathTypes';
import { derivePathSkillCodes, splitPathSkills } from './skillAggregation';

export type SkillState = 'held' | 'pending';

export interface PathSkill {
  code: string;
  state: SkillState;
}

export interface PathSkillSummary {
  /** Held first, then pending - the same set My Skills counts for this path. */
  skills: PathSkill[];
  held: number;
  total: number;
}

/**
 * Per-skill status for the Learning Path the learner is on, by the same rule as My Skills
 * (`services/skill/mySkills.ts`), so the counts on both pages always agree.
 *
 * Held = in the learner's skill profile, from ANY source. Pending = still on a course here the
 * learner has not finished. A skill on a finished course that the profile does not record is in
 * neither list - the profile is the truth for "gained", and nothing here is left to do about it.
 *
 * Binary on purpose. A former "in progress" state (the best course percentage) made a half-watched
 * course look like a half-held skill; the evidence model has no such thing, so neither does this.
 */
export function computePathSkills(
  model: LearningPathModel,
  heldCodes: ReadonlySet<string>,
  finishedCourseIds: ReadonlySet<string>
): PathSkillSummary {
  const { gained, pending } = splitPathSkills(derivePathSkillCodes(model, finishedCourseIds), heldCodes);
  const skills: PathSkill[] = [
    ...gained.map((code) => ({ code, state: 'held' as const })),
    ...pending.map((code) => ({ code, state: 'pending' as const })),
  ];
  return { skills, held: gained.length, total: skills.length };
}

export interface RoleReadiness {
  /** Required skills the learner holds. */
  held: number;
  required: number;
  /** 0-100. */
  readiness: number;
  /** Required by the role but taught by no course on this path - finishing here is not enough. */
  notTaught: string[];
}

/**
 * Readiness against the path's target role: required skills held over required skills.
 *
 * Dormant until role-skill mapping is done. Returns undefined when the role requires nothing, so a
 * path with no `targetRole`, or a role with no skills mapped yet, shows no readiness at all rather
 * than a misleading 0%.
 */
export function computeRoleReadiness(
  requiredCodes: readonly string[] | undefined,
  heldCodes: ReadonlySet<string>,
  taughtCodes: readonly string[]
): RoleReadiness | undefined {
  const required = [...new Set(requiredCodes ?? [])];
  if (required.length === 0) return undefined;
  const taught = new Set(taughtCodes);
  const held = required.filter((c) => heldCodes.has(c)).length;
  return {
    held,
    required: required.length,
    readiness: Math.round((held / required.length) * 100),
    notTaught: required.filter((c) => !taught.has(c) && !heldCodes.has(c)),
  };
}
