import type { LevelProgressInfo, LevelStatusKey } from '../../types/learningPathTypes';

/** Level statuses that count as the level's skills having been gained, regardless of progress. */
export const SKILL_GAINING_STATUSES: ReadonlySet<LevelStatusKey> = new Set(['completed', 'waived', 'credited']);

/**
 * Which Levels the learner has actually attained - drives the Level markers on the status page.
 *
 * Level attainment is PROGRESS, not skills: which skills are gained comes only from the skill
 * profile (see `services/skill/mySkills.ts`), so a finished Level never marks a skill gained by
 * itself.
 *
 * Deliberately ignores the path's unlock policy: the status page reports what
 * has been earned, so a Level counts on its own completion (100%) or on a
 * granted waiver/credit — never on whether the policy would currently let the
 * learner *enter* it.
 */
export function getAttainedLevels(levelProgress: LevelProgressInfo[], levelStatuses: LevelStatusKey[]): boolean[] {
  return levelProgress.map((progress, i) => {
    const status = levelStatuses[i];
    return progress.pct >= 100 || (!!status && SKILL_GAINING_STATUSES.has(status));
  });
}
