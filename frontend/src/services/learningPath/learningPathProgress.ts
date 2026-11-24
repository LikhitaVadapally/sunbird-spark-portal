import type { ViewerSummaryRecord } from '../../types/viewerServiceTypes';
import type {
  AssessmentScore,
  LearningPathModel,
  LearningPathPolicy,
  LevelProgressInfo,
  LevelStatusKey,
  LPCourseNode,
  PathProgressInfo,
  ProgressInfo,
  ResumeTarget,
  WaiverInfo,
} from '../../types/learningPathTypes';
import { getCourseContextId, getOptionalNodeIds } from '../viewer/summaryMapper';
import { getAssessmentInfo } from './learningPathAssessment';
import { SKILL_GAINING_STATUSES } from './skillAttainment';

const COMPLETE_STATUS = 2;

function round(n: number): number {
  return Math.round(n);
}

/**
 * Progress for a single Course, sourced from its own summary record, merged
 * with the path record's contentStatus map (per leaf, the course's own entry
 * wins when both have one).
 *
 * A course inside a Learning Path can end up with its own near-empty summary
 * record - e.g. a standalone/legacy enrolment for that same course id, or one
 * created before the Viewer Service's per-course fan-out existed - whose
 * `contentStatus` is `{}` rather than `null`/`undefined`. An `??` fallback
 * would treat that empty-but-present object as authoritative and never look
 * at the path record at all, silently losing every leaf's real status (see
 * bug: a fully-completed Level still showing as not started). Merging instead
 * of falling back means a leaf recorded on EITHER record still counts.
 *
 * Takes the MAX of both available `completionPercentage` signals rather than
 * preferring one outright: that aggregate is only as fresh as the last full
 * summary refetch, while `contentStatus` is patched optimistically (and
 * confirmed via `/v1/summary/read`) the instant a write succeeds. A stale
 * `completionPercentage: 0` must never mask a just-completed leaf.
 */
export function getCourseContentStatus(
  course: Pick<LPCourseNode, 'identifier'>,
  summaryByCollectionId: Map<string, ViewerSummaryRecord>,
  pathSummary?: ViewerSummaryRecord
): Record<string, number> | undefined {
  const courseRecord = summaryByCollectionId.get(course.identifier);
  if (!pathSummary?.contentStatus && !courseRecord?.contentStatus) return undefined;
  return { ...(pathSummary?.contentStatus ?? {}), ...(courseRecord?.contentStatus ?? {}) };
}

/** True when a leaf is recorded complete on either the course's or the path's summary record. */
export function isLeafComplete(contentStatus: Record<string, number> | undefined, leafId: string): boolean {
  return contentStatus?.[leafId] === COMPLETE_STATUS;
}

/** True when a leaf id was waived by a prior assessment (see `getOptionalNodeIds`). */
export function isLeafOptional(optional: Set<string>, leafId: string): boolean {
  return optional.has(leafId);
}

export function computeCourseProgress(
  course: LPCourseNode,
  summaryByCollectionId: Map<string, ViewerSummaryRecord>,
  pathSummary?: ViewerSummaryRecord
): ProgressInfo & { status: 'completed' | 'active' | 'notStarted'; optional: boolean } {
  const total = course.leafIds.length || course.leafNodesCount || 0;
  const courseRecord = summaryByCollectionId.get(course.identifier);
  const contentStatus = getCourseContentStatus(course, summaryByCollectionId, pathSummary);

  const aggregatePct = typeof courseRecord?.completionPercentage === 'number' ? courseRecord.completionPercentage : 0;

  const contentStatusCompleted = contentStatus
    ? course.leafIds.filter((id) => contentStatus[id] === COMPLETE_STATUS).length
    : 0;
  const contentStatusPct = total > 0 ? round((contentStatusCompleted / total) * 100) : 0;

  const pct = Math.max(aggregatePct, contentStatusPct);
  const completed =
    pct === contentStatusPct ? contentStatusCompleted : total > 0 ? Math.min(total, round((pct / 100) * total)) : 0;

  const status = pct >= 100 ? 'completed' : pct > 0 ? 'active' : 'notStarted';

  // A course is optional when the Viewer Service (via a prior assessment)
  // waived either the whole course or every one of its leaves. `completionPercentage`
  // and `contentStatus` are left untouched here - only the level rollup below
  // and the UI's "Optional" badge act on this flag, per the plan's decision to
  // trust the server for percentages.
  const optionalNodes = getOptionalNodeIds(pathSummary, summaryByCollectionId);
  const optional = optionalNodes.has(course.identifier) || (total > 0 && course.leafIds.every((id) => optionalNodes.has(id)));

  return { pct, completed, total, status, optional };
}

/**
 * Progress for a Level — average of its REQUIRED courses' percentages
 * (a course waived by a prior assessment - see `computeCourseProgress`'s
 * `optional` flag - is excluded from both the mean and `total`/`doneCourses`).
 *
 * Without this exclusion, an optional course with no fan-out record
 * contributes a flat 0% and pins the Level below 100% forever, even though
 * the learner was never expected to attempt it - see bug: a fully-waived
 * Level could never unlock the outcome assessment or certificate. A Level
 * whose courses are ALL optional is reported as 100% (`total: 0` would
 * otherwise read as an empty/degenerate Level rather than a satisfied one).
 */
export function computeLevelProgress(
  level: { courses: LPCourseNode[] },
  summaryByCollectionId: Map<string, ViewerSummaryRecord>,
  pathSummary?: ViewerSummaryRecord
): LevelProgressInfo {
  const courseProgresses = level.courses.map((c) => computeCourseProgress(c, summaryByCollectionId, pathSummary));
  const requiredProgresses = courseProgresses.filter((p) => !p.optional);
  const total = requiredProgresses.length;
  const doneCourses = requiredProgresses.filter((p) => p.status === 'completed').length;
  const pct =
    total > 0 ? round(requiredProgresses.reduce((sum, p) => sum + p.pct, 0) / total) : level.courses.length > 0 ? 100 : 0;
  return { pct, completed: doneCourses, total, doneCourses };
}

/** Overall path progress — prefers the path record's own `completionPercentage`. */
export function computePathProgress(
  model: LearningPathModel,
  pathSummary: ViewerSummaryRecord | undefined,
  summaryByCollectionId: Map<string, ViewerSummaryRecord>
): PathProgressInfo {
  const levelCount = model.levels.length;
  if (!pathSummary) {
    return { pct: 0, completed: 0, total: model.leafTotal, doneLevels: 0, levelCount };
  }

  const doneLevels = model.levels.filter(
    (level) => computeLevelProgress(level, summaryByCollectionId, pathSummary).pct >= 100
  ).length;

  const pct = pathCompletionPct(pathSummary, model.leafTotal);

  return { pct, completed: doneLevels, total: model.leafTotal, doneLevels, levelCount };
}

/**
 * A path's completion from its summary record: the service's own percentage when it sends one
 * (the live service doesn't yet), else completed leaves over `leafTotal`. Shared by the path page
 * and My Learning so the two never disagree.
 */
export function pathCompletionPct(pathSummary: ViewerSummaryRecord, leafTotal: number): number {
  if (typeof pathSummary.completionPercentage === 'number') return pathSummary.completionPercentage;
  if (leafTotal <= 0) return 0;
  const done = Object.values(pathSummary.contentStatus ?? {}).filter((s) => s === COMPLETE_STATUS).length;
  return round((done / leafTotal) * 100);
}

/**
 * Derives each content Level's display status from its progress and the path's policy.
 *  - Unenrolled — every Level is locked, regardless of policy. Without this, an
 *    unauthenticated/unenrolled visitor on a `Diagnostic`/`PriorLearning` path
 *    with no prior assessment saw every Level as `notStarted` (openable) rather
 *    than locked - see bug: unenrolled learner able to reach Level content.
 *  - `Fixed`         — sequential: a Level unlocks once the previous one is 100%.
 *  - `Diagnostic` / `PriorLearning` — every Level is locked until the prior assessment is complete;
 *    after that, everything opens.
 *  - A waiver entry (when one exists) always wins over the derived state.
 *
 * Per the design doc, this unlock gate is COMPLETION-based only — merely
 * submitting the prior assessment (any score) unlocks the next level. The
 * 70%-pass threshold applies to the OUTCOME assessment (see
 * `isOutcomeUnlocked`), not to prior-level unlocking; a below-threshold score
 * on the prior assessment does not block progression. Waivers/credit-by-exam
 * are a server-side decision (see `useLevelWaivers`) — this function only
 * reflects a waiver already granted, it never grants one.
 */
export function deriveLevelStatuses(
  model: LearningPathModel,
  policy: LearningPathPolicy,
  progressList: LevelProgressInfo[],
  priorDone: boolean,
  waivers: Record<string, WaiverInfo> = {},
  isEnrolled = true
): LevelStatusKey[] {
  if (!isEnrolled) return model.levels.map(() => 'locked');

  return model.levels.map((level, i) => {
    const waiver = waivers[level.identifier];
    if (waiver) return waiver.status;

    const prog = progressList[i];
    if (!prog) return 'locked';
    if (prog.pct >= 100) return 'completed';

    if (policy === 'Fixed') {
      if (i === 0) return prog.pct > 0 ? 'active' : 'notStarted';
      const prevComplete = (progressList[i - 1]?.pct ?? 0) >= 100;
      if (!prevComplete) return 'locked';
      return prog.pct > 0 ? 'active' : 'notStarted';
    }

    // Diagnostic / PriorLearning
    if (!priorDone) return 'locked';
    return prog.pct > 0 ? 'active' : 'notStarted';
  });
}

/**
 * The outcome assessment unlocks only once every content Level is complete -
 * a Level counts as satisfied at `pct >= 100` OR when its derived status is a
 * skill-gaining one (`SKILL_GAINING_STATUSES` - completed/waived/credited).
 * The second check is what makes a Level waived wholesale by a prior
 * assessment (an `optional_nodes` entry for the LEVEL id itself, not just its
 * courses) count as done even if `computeLevelProgress` never independently
 * reaches 100 for it. `levelStatuses` is optional so every existing call site
 * (which predates waivers mattering here) keeps compiling unchanged.
 */
export function isOutcomeUnlocked(progressList: LevelProgressInfo[], levelStatuses?: LevelStatusKey[]): boolean {
  return (
    progressList.length > 0 &&
    progressList.every((p, i) => p.pct >= 100 || (!!levelStatuses?.[i] && SKILL_GAINING_STATUSES.has(levelStatuses[i]!)))
  );
}

/**
 * The certificate unlocks once every content Level AND the outcome assessment
 * itself are complete.
 *
 * Deliberately NOT gated on the whole-path `completionPercentage`: that figure
 * counts the outcome assessment's own leaf, which is by definition still
 * incomplete at the moment the last Level closes — so a path could never reach
 * 100% at the only point the gate is evaluated, leaving the card permanently
 * "Locked" even with every level done (see bug: certificate locked at 2/2
 * levels complete). A path with no outcome assessment unlocks on Levels alone.
 */
export function isCertificateUnlocked(
  hasOutcomeAssessment: boolean,
  progressList: LevelProgressInfo[],
  outcomeProgress: ProgressInfo | null,
  levelStatuses?: LevelStatusKey[]
): boolean {
  if (!isOutcomeUnlocked(progressList, levelStatuses)) return false;
  if (!hasOutcomeAssessment) return true;
  return (outcomeProgress?.pct ?? 0) >= 100;
}

/**
 * Best score for an assessment course/content id, from the path record's
 * `assessmentStatus`. Kept as a thin wrapper over `getAssessmentInfo` so
 * existing callers that only need the score are unaffected by the id-convention
 * resolution and attempt count that helper adds.
 */
export function getAssessmentScore(
  identifier: string | undefined,
  pathSummary: ViewerSummaryRecord | undefined,
  leafIds?: string[]
): AssessmentScore | null {
  return getAssessmentInfo(identifier, leafIds, pathSummary);
}

function findOwningCourse(model: LearningPathModel, contentId: string): LPCourseNode | undefined {
  const allCourses = [
    ...(model.priorAssessment ? [model.priorAssessment] : []),
    ...model.levels.flatMap((l) => l.courses),
    ...(model.outcomeAssessment ? [model.outcomeAssessment] : []),
  ];
  return allCourses.find((c) => c.leafIds.includes(contentId));
}

/**
 * The resume target: the path record's `lastReadContentId` when it maps to a
 * known course, else the first incomplete leaf in document order (prior →
 * levels → outcome). The course's write context is resolved via
 * `getCourseContextId` (the per-course fan-out record's own contextId) rather
 * than blindly constructing `<lpContextId>:<courseId>` — see summaryMapper.ts.
 */
export function getResumeTarget(
  model: LearningPathModel,
  pathSummary: ViewerSummaryRecord | undefined,
  records: ViewerSummaryRecord[] = []
): ResumeTarget | null {
  if (!pathSummary?.contextId) return null;
  const contextId = pathSummary.contextId;

  if (pathSummary.lastReadContentId) {
    const owner = findOwningCourse(model, pathSummary.lastReadContentId);
    if (owner) {
      return {
        collectionId: owner.identifier,
        contentId: pathSummary.lastReadContentId,
        contextId: getCourseContextId(records, contextId, owner.identifier),
      };
    }
  }

  // Optional leaves (waived by a prior assessment) are skipped so an
  // unattempted one never becomes the resume target - a learner excused from
  // a leaf must not be sent back into it.
  const optionalNodes = getOptionalNodeIds(pathSummary);
  const allCourses = [
    ...(model.priorAssessment ? [model.priorAssessment] : []),
    ...model.levels.flatMap((l) => l.courses),
    ...(model.outcomeAssessment ? [model.outcomeAssessment] : []),
  ];
  for (const course of allCourses) {
    const firstIncomplete = course.leafIds.find(
      (id) => (pathSummary.contentStatus?.[id] ?? 0) !== COMPLETE_STATUS && !optionalNodes.has(id)
    );
    if (firstIncomplete) {
      return {
        collectionId: course.identifier,
        contentId: firstIncomplete,
        contextId: getCourseContextId(records, contextId, course.identifier),
      };
    }
  }

  return null;
}
