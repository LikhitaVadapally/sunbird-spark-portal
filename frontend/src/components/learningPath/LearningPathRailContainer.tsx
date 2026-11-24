import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLearningPath } from '@/hooks/useLearningPath';
import { usePathSkills } from '@/hooks/usePathSkills';
import { parseCourseContextId } from '@/services/viewer/summaryMapper';
import { LearningPathRail } from './LearningPathRail';

interface LearningPathRailContainerProps {
  /** The current course's context id — the composite `<lpContextId>:<courseId>` batch id from the route. */
  courseContextId: string | undefined;
}

/**
 * Reads `?lp=` off the current course URL and renders the Learning Path
 * player-chrome rail (see plan §5/§10). Self-contained: `CollectionSidePanel`
 * only needs to render this conditionally — no new props to thread through
 * the existing prop-group interfaces.
 */
export function LearningPathRailContainer({ courseContextId }: LearningPathRailContainerProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { collectionId, contentId } = useParams();
  const pathId = searchParams.get('lp') ?? undefined;
  const parsedContext = courseContextId ? parseCourseContextId(courseContextId) : null;
  const lpContextId = parsedContext?.lpContextId;
  /** The course being consumed right now — its row in the rail opens expanded. */
  const activeCourseId = parsedContext?.courseId ?? collectionId;

  const lp = useLearningPath(pathId, lpContextId);
  const pathSkills = usePathSkills(lp.model, lp.summaryByCollectionId, lp.pathSummary);

  if (!pathId || lp.isLoading || !lp.model.identifier) return null;

  const basePath = lpContextId ? `/learning-path/${pathId}/batch/${lpContextId}` : `/learning-path/${pathId}`;

  return (
    <LearningPathRail
      pathTitle={lp.model.name}
      model={lp.model}
      progress={lp.progress}
      levelProgress={lp.levelProgress}
      levelStatuses={lp.levelStatuses}
      priorDone={lp.priorState.done}
      outcomeUnlocked={lp.outcomeState.unlocked}
      isEnrolled={lp.enrollment.isEnrolled}
      certificateUnlocked={lp.certificateUnlocked}
      outcomeDone={lp.outcomeState.done}
      summaryByCollectionId={lp.summaryByCollectionId}
      pathSummary={lp.pathSummary}
      activeCourseId={activeCourseId}
      activeContentId={contentId}
      onBackToPath={() => navigate(basePath)}
      onOpenLevel={(levelId) => navigate(`${basePath}/level/${levelId}`)}
      onOpenPrior={() => navigate(`${basePath}/prior`)}
      onOpenOutcome={lp.model.outcomeAssessment ? () => navigate(`${basePath}/outcome`) : undefined}
      onOpenCourse={(courseId, contentId) => navigate(`${basePath}/course/${courseId}/content/${contentId}`)}
      skillName={pathSkills.name}
      stateOf={lp.enrollment.isEnrolled ? pathSkills.stateOf : undefined}
    />
  );
}
