import { useMemo } from 'react';
import { useCollection } from './useCollection';
import { useViewerSummary } from './useViewerSummary';
import { useLearningPathEnrollment } from './useLearningPathEnrollment';
import { useLevelWaivers } from './useLevelWaivers';
import { useIsAuthenticated } from './useAuthInfo';
import { useBatchListForMentor } from './useBatch';
import { useIsMentor } from './useUser';
import userAuthInfoService from '../services/userAuthInfoService/userAuthInfoService';
import { parseLearningPath } from '../services/learningPath/learningPathMapper';
import { useSkillFields } from './useSkillFields';
import { useSkillLabels } from './useSkillProfile';
import { withSkillNames } from '../services/learningPath/skillNames';
import { skillFrameworkOf } from '../services/learningPath/learningPathMapper';
import {
  computeCourseProgress,
  computeLevelProgress,
  computePathProgress,
  deriveLevelStatuses,
  isCertificateUnlocked,
  isOutcomeUnlocked,
  getResumeTarget,
} from '../services/learningPath/learningPathProgress';
import { getPathSummary, buildCourseSummaryMapForContext } from '../services/viewer/summaryMapper';

const NO_IDS: string[] = [];

/**
 * Composes the Learning Path hierarchy, Viewer Service progress, and
 * enrolment state into the single object every LP screen consumes.
 */
export function useLearningPath(pathId: string | undefined, contextIdParam: string | undefined) {
  const { isAuthenticated, isLoading: authLoading } = useIsAuthenticated();
  const { data: hierarchyData, isLoading: hierarchyLoading, isError: hierarchyError } = useCollection(pathId);
  const { data: summaryRecords = [], isLoading: summaryLoading } = useViewerSummary();
  const enrollment = useLearningPathEnrollment(pathId, contextIdParam, summaryRecords, isAuthenticated);

  // Creator/mentor detection mirrors CollectionDetailPage.tsx: the path's own creator (or a
  // batch mentor) gets the management rail instead of the learner enrol prompt.
  const currentUserId = userAuthInfoService.getUserId();
  const isCreatorViewingOwnPath =
    !!isAuthenticated &&
    !!hierarchyData?.createdBy &&
    !!currentUserId &&
    hierarchyData.createdBy === currentUserId;
  const isTrackable = (hierarchyData?.trackable?.enabled?.toLowerCase() ?? '') === 'yes';

  const isMentorRole = useIsMentor();
  const { data: mentorBatches } = useBatchListForMentor(pathId, { enabled: isMentorRole });
  const isMentorViewingPath = (mentorBatches?.length ?? 0) > 0;

  // Skill tags live in the path's skill-framework field (`cuisine`, ...), not always `skill`.
  const pathFrameworkId = hierarchyData?.hierarchyRoot?.competencyFramework;
  // Until the field is known the path would be parsed under `skill` and show no skills, so the page
  // waits for it (it shares the framework read used for names).
  const { fieldOf, isLoading: fieldLoading } = useSkillFields([pathFrameworkId]);
  const skillField = fieldOf(pathFrameworkId);
  // Skill names come from the framework ("French Cuisine"), as on the course page; until it loads,
  // or for a code it doesn't know, the de-slugged code is shown.
  const nameFrameworkId = skillFrameworkOf(hierarchyData?.hierarchyRoot);
  const { labelOf } = useSkillLabels(nameFrameworkId ? [nameFrameworkId] : NO_IDS);
  const model = useMemo(
    () => withSkillNames(
      parseLearningPath(hierarchyData?.hierarchyRoot ?? null, skillField),
      (code) => labelOf(code, nameFrameworkId).name,
    ),
    [hierarchyData, skillField, labelOf, nameFrameworkId]
  );
  const pathSummary = useMemo(
    () => getPathSummary(summaryRecords, pathId, contextIdParam),
    [summaryRecords, pathId, contextIdParam]
  );
  const summaryByCollectionId = useMemo(
    () => buildCourseSummaryMapForContext(summaryRecords, enrollment.effectiveContextId),
    [summaryRecords, enrollment.effectiveContextId]
  );

  // Needs model/pathSummary/summaryByCollectionId, so it's declared after them
  // (moved down from a pathId-only stub - see `useLevelWaivers`).
  const waivers = useLevelWaivers(model, pathSummary, summaryByCollectionId);

  const progress = useMemo(
    () => computePathProgress(model, pathSummary, summaryByCollectionId),
    [model, pathSummary, summaryByCollectionId]
  );

  const levelProgress = useMemo(
    () => model.levels.map((level) => computeLevelProgress(level, summaryByCollectionId, pathSummary)),
    [model.levels, summaryByCollectionId, pathSummary]
  );

  const priorProgress = useMemo(
    () =>
      model.priorAssessment
        ? computeCourseProgress(model.priorAssessment, summaryByCollectionId, pathSummary)
        : null,
    [model.priorAssessment, summaryByCollectionId, pathSummary]
  );
  const priorState = { progress: priorProgress, done: !model.priorAssessment || (priorProgress?.pct ?? 0) >= 100 };

  // Computed before outcomeState/certificateUnlocked below - both need to
  // treat a Level waived wholesale by a prior assessment as satisfied even
  // when `computeLevelProgress` doesn't independently reach 100 for it.
  const levelStatuses = useMemo(
    () => deriveLevelStatuses(model, model.policy, levelProgress, priorState.done, waivers, enrollment.isEnrolled),
    [model, levelProgress, priorState.done, waivers, enrollment.isEnrolled]
  );

  const outcomeProgress = useMemo(
    () =>
      model.outcomeAssessment
        ? computeCourseProgress(model.outcomeAssessment, summaryByCollectionId, pathSummary)
        : null,
    [model.outcomeAssessment, summaryByCollectionId, pathSummary]
  );
  const outcomeState = {
    progress: outcomeProgress,
    // A path made entirely of a prior + outcome assessment has zero content
    // Levels left once `parseLearningPath` unwraps both out of `model.levels` -
    // `isOutcomeUnlocked([])` is `false` (correctly locked for a path with no
    // outcome assessment and nothing else), so that case is special-cased here,
    // where `model.outcomeAssessment`'s presence is known, rather than in
    // `isOutcomeUnlocked` itself.
    unlocked: model.levels.length === 0 ? Boolean(model.outcomeAssessment) : isOutcomeUnlocked(levelProgress, levelStatuses),
    done: (outcomeProgress?.pct ?? 0) >= 100,
  };

  const certificateUnlocked = isCertificateUnlocked(
    !!model.outcomeAssessment,
    levelProgress,
    outcomeProgress,
    levelStatuses
  );

  const resumeTarget = useMemo(
    () => getResumeTarget(model, pathSummary, summaryRecords),
    [model, pathSummary, summaryRecords]
  );

  return {
    model,
    policy: model.policy,
    progress,
    levelProgress,
    levelStatuses,
    priorState,
    outcomeState,
    certificateUnlocked,
    enrollment,
    resumeTarget,
    pathSummary,
    summaryByCollectionId,
    summaryRecords,
    createdBy: hierarchyData?.createdBy,
    isTrackable,
    isCreatorViewingOwnPath,
    isMentorViewingPath,
    isLoading: authLoading || hierarchyLoading || summaryLoading || fieldLoading,
    isError: hierarchyError,
  };
}
