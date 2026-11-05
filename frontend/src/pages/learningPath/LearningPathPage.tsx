import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAppI18n } from '@/hooks/useAppI18n';
import { useLearningPath } from '@/hooks/useLearningPath';
import { usePermissions } from '@/hooks/usePermission';
import useImpression from '@/hooks/useImpression';
import PageLoader from '@/components/common/PageLoader';
import { LevelDetailView } from '@/components/learningPath/LevelDetailView';
import { usePathSkills } from '@/hooks/usePathSkills';
import { AssessmentGate } from '@/components/learningPath/AssessmentGate';
import { PathCompletionView } from '@/components/learningPath/PathCompletionView';
import { LearningPathOverview } from './LearningPathOverview';
import { LearningPathPlayerView } from './LearningPathPlayerView';
import { LearningPathStatusView } from './LearningPathStatusView';
import { useStoredAssessmentScores } from '@/hooks/useAssessmentScores';
import { mergeAssessmentSources, resolveAssessmentInfo } from '@/services/learningPath/learningPathAssessment';
import type { ScoreRow } from '@/components/learningPath/ScoreRows';

const LearningPathPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathId, contextId, levelId, courseId, contentId } = useParams<{
    pathId: string;
    contextId?: string;
    levelId?: string;
    courseId?: string;
    contentId?: string;
  }>();
  const { t } = useAppI18n();
  const { isAuthenticated } = usePermissions();

  useImpression({
    type: 'view',
    pageid: 'learning-path-detail',
    env: 'course',
    object: { id: pathId ?? '', type: 'Learning Path' },
  });

  const lp = useLearningPath(pathId, contextId);
  const { model, policy, levelStatuses, pathSummary, outcomeState, enrollment } = lp;

  // Computed once for the whole page so the overview card and every level card agree, and the
  // profile is fetched once rather than per level.
  const pathSkills = usePathSkills(model, lp.summaryByCollectionId, pathSummary);
  // Resolved names where the path carries codes; older paths only have display labels.
  const scopedSkillNames = model.allSkillCodes.length > 0 ? model.allSkillCodes.map(pathSkills.name) : model.allSkills;

  // Durable local scores (survive the `['viewerSummary']` refetch that wipes
  // `pathSummary.assessmentStatus`) - merged with the path record below via
  // `mergeAssessmentSources` so a submitted score never disappears after a
  // cache invalidation/reload (see bug: prior/outcome score reverts to "—").
  const priorLocalScores = useStoredAssessmentScores(model.priorAssessment?.identifier);
  const outcomeLocalScores = useStoredAssessmentScores(model.outcomeAssessment?.identifier);
  const getPriorScore = () =>
    resolveAssessmentInfo(
      model.priorAssessment?.identifier,
      model.priorAssessment?.leafIds,
      mergeAssessmentSources(pathSummary, priorLocalScores)
    );
  const getOutcomeScore = () =>
    resolveAssessmentInfo(
      model.outcomeAssessment?.identifier,
      model.outcomeAssessment?.leafIds,
      mergeAssessmentSources(pathSummary, outcomeLocalScores)
    );

  const basePath = contextId ? `/learning-path/${pathId}/batch/${contextId}` : `/learning-path/${pathId}`;
  const goOverview = () => navigate(basePath);
  const goLevel = (id: string) => navigate(`${basePath}/level/${id}`);
  const goPrior = () => navigate(`${basePath}/prior`);
  const goOutcome = () => navigate(`${basePath}/outcome`);

  // Opens the Learning Path's own player screen (design's `bPlayer`) - no
  // Units/Lessons sidebar, no separate course-level enrolment gate.
  const openCourse = (openCourseId: string, openContentId: string) => {
    if (!openContentId) return;
    navigate(`${basePath}/course/${openCourseId}/content/${openContentId}`);
  };

  if (lp.isLoading) return <PageLoader />;
  if (lp.isError || !model.identifier) {
    return <PageLoader error={t('somethingWentWrong')} onRetry={() => window.location.reload()} />;
  }

  if (courseId && contentId) {
    return (
      <LearningPathPlayerView
        lp={lp}
        courseId={courseId}
        contentId={contentId}
        onBackToPath={goOverview}
        onOpenLevel={goLevel}
        onOpenPrior={goPrior}
        onOpenOutcome={goOutcome}
        onNavigateContent={openCourse}
      />
    );
  }

  if (location.pathname.endsWith('/prior') && model.priorAssessment) {
    // Unenrolled learners must never reach this gate - see bug: unenrolled
    // learner able to press "Start assessment" only to be stopped one screen
    // later by the player's "must join" dialog. Mirrors the /outcome guard below.
    if (!enrollment.isEnrolled) {
      return <Navigate to={basePath} replace />;
    }
    return (
      <div className="flex-1 min-w-0 mx-auto max-w-[85rem] px-6 py-7">
        <AssessmentGate
          variant="prior"
          assessment={model.priorAssessment}
          policy={policy}
          allSkills={scopedSkillNames}
          bestScore={getPriorScore()}
          onStart={() => openCourse(model.priorAssessment!.identifier, model.priorAssessment!.leafIds[0] ?? '')}
          onSkip={goOverview}
          onBack={goOverview}
        />
      </div>
    );
  }

  if (location.pathname.endsWith('/outcome')) {
    // Unreachable when locked (the rail/ledger rows only fire onOpenOutcome once
    // unlocked), but a hand-typed URL must still redirect rather than show a gate
    // the learner cannot use yet.
    if (!model.outcomeAssessment || !outcomeState.unlocked) {
      return <Navigate to={basePath} replace />;
    }
    return (
      <div className="flex-1 min-w-0 mx-auto max-w-[85rem] px-6 py-7">
        <AssessmentGate
          variant="outcome"
          assessment={model.outcomeAssessment}
          allSkills={scopedSkillNames}
          bestScore={getOutcomeScore()}
          onStart={() => openCourse(model.outcomeAssessment!.identifier, model.outcomeAssessment!.leafIds[0] ?? '')}
          onBack={goOverview}
        />
      </div>
    );
  }

  if (location.pathname.endsWith('/complete')) {
    const scores: ScoreRow[] = [];
    if (model.priorAssessment) {
      const s = getPriorScore();
      scores.push({
        name: model.priorAssessment.name,
        sub: t('learningPath.priorAssessmentSub'),
        score: s ? `${s.score}/${s.maxScore}` : '—',
        pct: s && s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0,
      });
    }
    if (model.outcomeAssessment) {
      const s = getOutcomeScore();
      scores.push({
        name: model.outcomeAssessment.name,
        sub: t('learningPath.outcomeAssessmentSub'),
        score: s ? `${s.score}/${s.maxScore}` : '—',
        pct: s && s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0,
      });
    }
    return (
      <div className="flex-1 min-w-0 px-6 py-7">
        <PathCompletionView
          pathTitle={model.name}
          levelCount={model.levels.length}
          scores={scores}
          skills={(pathSkills.summary?.skills ?? []).filter((s) => s.state === 'held').map((s) => pathSkills.name(s.code))}
          hasCertificate={(pathSummary?.issuedCertificates?.length ?? 0) > 0}
        />
      </div>
    );
  }

  if (location.pathname.endsWith('/status')) {
    return <LearningPathStatusView lp={lp} pathLink={basePath} pathSkills={pathSkills} />;
  }

  if (levelId) {
    const idx = model.levels.findIndex((l) => l.identifier === levelId);
    const level = model.levels[idx];
    if (level) {
      return (
        <div className="flex-1 min-w-0 mx-auto max-w-[85rem] px-6 py-7">
          <LevelDetailView
            level={level}
            levelNumber={idx + 1}
            progress={lp.levelProgress[idx] ?? { pct: 0, completed: 0, total: 0, doneCourses: 0 }}
            status={levelStatuses[idx] ?? 'locked'}
            summaryByCollectionId={lp.summaryByCollectionId}
            pathSummary={pathSummary}
            isEnrolled={enrollment.isEnrolled}
            stateOf={enrollment.isEnrolled ? pathSkills.stateOf : undefined}
            skillName={pathSkills.name}
            onBack={goOverview}
            onOpenCourse={openCourse}
          />
        </div>
      );
    }
  }

  return (
    <LearningPathOverview
      lp={lp}
      isAuthenticated={isAuthenticated}
      onOpenLevel={goLevel}
      onOpenPrior={goPrior}
      onOpenOutcome={goOutcome}
      onOpenCourse={openCourse}
    />
  );
};

export default LearningPathPage;
