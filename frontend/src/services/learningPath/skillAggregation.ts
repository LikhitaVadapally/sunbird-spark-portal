import type { ViewerSummaryRecord } from '../../types/viewerServiceTypes';
import type { LearningPathModel, LPCourseNode, LPLevelNode } from '../../types/learningPathTypes';
import { computeCourseProgress, computePathProgress } from './learningPathProgress';
import { deriveWaiversFromOptionalNodes } from './levelWaivers';

export type PathSkillStatus = 'completed' | 'ongoing' | 'not-started';

/**
 * One enrolled Learning Path, reduced to the skill CODES it teaches and the ones still waiting
 * on unfinished courses.
 *
 * Deliberately says nothing about what the learner HOLDS. Held skills come from the skill
 * profile (`profile/read`), which is the single source of truth for "gained" - so this summary
 * stays valid while the profile loads, and the gained/pending split is done once, in
 * `services/skill/mySkills.ts`, for My Skills and the Learning Path pages alike.
 */
export interface PathSkillSummary {
  pathId: string;
  contextId?: string;
  pathName: string;
  progressPct: number;
  status: PathSkillStatus;
  /** Framework the path's codes belong to, when the hierarchy names one - used only for names. */
  frameworkId?: string;
  /** Every code the path teaches. */
  taughtCodes: string[];
  /** Codes tagged on courses the learner has not finished yet, before subtracting held skills. */
  unfinishedCodes: string[];
}

/** Aggregate tallies for the My Skills hero. */
export interface SkillAggregate {
  totalSkills: number;
  gainedSkills: number;
  pendingSkills: number;
  pathsCompleted: number;
  pathsOngoing: number;
}

/**
 * The codes a course teaches. An untagged course falls back to its Level's OWN tags - authors
 * often tag the Level once rather than every course in it. Not the Level's derived union: that
 * would make an untagged course borrow its siblings' skills.
 */
export function courseSkillCodes(course: LPCourseNode, level?: LPLevelNode): string[] {
  if (course.skillCodes.length > 0) return course.skillCodes;
  return level ? (level.ownSkillCodes ?? level.skillCodes) : [];
}

/**
 * Courses that count as finished for skills: completed, waived by the prior assessment
 * (`optional`), or inside a Level that was waived/credited as a whole.
 *
 * Waivers are derived with `deriveWaiversFromOptionalNodes` - the same pure derivation the
 * `useLevelWaivers` hook wraps - because this runs from a `useQueries` fan-out, not a component.
 */
export function getFinishedCourseIds(
  model: LearningPathModel,
  pathSummary: ViewerSummaryRecord | undefined,
  summaryByCollectionId: Map<string, ViewerSummaryRecord>
): Set<string> {
  const waivers = deriveWaiversFromOptionalNodes(model, pathSummary, summaryByCollectionId);
  const finished = new Set<string>();
  const courses = [
    ...model.levels.flatMap((level) => level.courses.map((course) => ({ course, levelId: level.identifier }))),
    ...(model.outcomeAssessment ? [{ course: model.outcomeAssessment, levelId: '' }] : []),
  ];
  courses.forEach(({ course, levelId }) => {
    const progress = computeCourseProgress(course, summaryByCollectionId, pathSummary);
    if (waivers[levelId] || progress.optional || progress.pct >= 100 || progress.status === 'completed') {
      finished.add(course.identifier);
    }
  });
  return finished;
}

/**
 * What a path teaches, and what is still left to do in it.
 *
 * The prior assessment is left out of both: it is diagnostic - it waives what the learner already
 * knows rather than teaching anything - so a skipped prior must not leave skills pending forever.
 * The outcome assessment counts like any course.
 */
export function derivePathSkillCodes(
  model: LearningPathModel,
  finishedCourseIds: ReadonlySet<string>
): { taughtCodes: string[]; unfinishedCodes: string[] } {
  const taught = new Set<string>(model.allSkillCodes);
  const unfinished = new Set<string>();

  const visit = (course: LPCourseNode, level?: LPLevelNode) => {
    const codes = courseSkillCodes(course, level);
    codes.forEach((code) => taught.add(code));
    if (!finishedCourseIds.has(course.identifier)) codes.forEach((code) => unfinished.add(code));
  };

  model.levels.forEach((level) => {
    level.skillCodes.forEach((code) => taught.add(code));
    level.courses.forEach((course) => visit(course, level));
  });
  if (model.outcomeAssessment) visit(model.outcomeAssessment);

  return { taughtCodes: [...taught], unfinishedCodes: [...unfinished] };
}

/** Reduces one path's hierarchy + progress into its skill summary. */
export function buildPathSkillSummary(
  model: LearningPathModel,
  pathSummary: ViewerSummaryRecord | undefined,
  summaryByCollectionId: Map<string, ViewerSummaryRecord>,
  contextId?: string
): PathSkillSummary {
  const finished = getFinishedCourseIds(model, pathSummary, summaryByCollectionId);
  const { taughtCodes, unfinishedCodes } = derivePathSkillCodes(model, finished);
  const progressPct = computePathProgress(model, pathSummary, summaryByCollectionId).pct;

  return {
    pathId: model.identifier,
    contextId,
    pathName: model.name,
    progressPct,
    status: progressPct >= 100 ? 'completed' : progressPct > 0 ? 'ongoing' : 'not-started',
    ...(model.competencyFramework ? { frameworkId: model.competencyFramework } : {}),
    taughtCodes,
    unfinishedCodes,
  };
}

/**
 * One path's skills split by what the learner holds, from ANY source.
 *
 * Gained = taught here AND held. Pending = on an unfinished course AND not held. A code on a
 * finished course that the profile does not (yet) record is neither: the profile is the truth for
 * gained, and there is nothing left in this path for the learner to do about it.
 */
export function splitPathSkills(
  summary: Pick<PathSkillSummary, 'taughtCodes' | 'unfinishedCodes'>,
  heldCodes: ReadonlySet<string>
): { gained: string[]; pending: string[] } {
  return {
    gained: summary.taughtCodes.filter((code) => heldCodes.has(code)),
    pending: summary.unfinishedCodes.filter((code) => !heldCodes.has(code)),
  };
}

export interface PathSkillFilters {
  query?: string;
  status?: PathSkillStatus | 'all';
  /** Display name for a code, so search matches what the learner reads rather than the slug. */
  nameOf?: (code: string) => string;
}

/** Free-text match on the path name or any of its skills, plus a status narrow. */
export function filterPathSummaries(summaries: PathSkillSummary[], filters: PathSkillFilters): PathSkillSummary[] {
  const query = (filters.query ?? '').trim().toLowerCase();
  const status = filters.status ?? 'all';
  const nameOf = filters.nameOf ?? ((code: string) => code);

  return summaries.filter((summary) => {
    if (status !== 'all' && summary.status !== status) return false;
    if (!query) return true;
    return (
      summary.pathName.toLowerCase().includes(query) ||
      summary.taughtCodes.some(
        (code) => code.toLowerCase().includes(query) || nameOf(code).toLowerCase().includes(query)
      )
    );
  });
}
