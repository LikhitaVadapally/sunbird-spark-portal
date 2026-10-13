import { useAppI18n } from '@/hooks/useAppI18n';
import { PathProgressCard } from '@/components/learningPath/PathProgressCard';
import { PathSkillProgressCard } from '@/components/learningPath/PathSkillProgressCard';
import { usePathSkills } from '@/hooks/usePathSkills';
import { CertificateLockCard } from '@/components/learningPath/CertificateLockCard';
import { EnrolCard } from '@/components/learningPath/EnrolCard';
import { LearningPathCreatorPanel } from '@/components/learningPath/LearningPathCreatorPanel';
import { LedgerTable } from '@/components/learningPath/LedgerTable';
import { LearningPathGoBackButton } from '@/components/learningPath/LearningPathGoBackButton';
import type { useLearningPath } from '@/hooks/useLearningPath';

type LearningPathData = ReturnType<typeof useLearningPath>;

interface LearningPathOverviewProps {
  lp: LearningPathData;
  isAuthenticated: boolean;
  onOpenLevel: (levelId: string) => void;
  onOpenPrior: () => void;
  onOpenOutcome: () => void;
  onOpenCourse: (courseId: string, contentId: string) => void;
}

/** Overview screen (Style B · Ledger): sticky progress rail + ledger table, or an enrol prompt when not yet enrolled. */
export function LearningPathOverview({
  lp,
  isAuthenticated,
  onOpenLevel,
  onOpenPrior,
  onOpenOutcome,
  onOpenCourse,
}: LearningPathOverviewProps) {
  const { t } = useAppI18n();
  const {
    model,
    policy,
    progress,
    levelProgress,
    levelStatuses,
    priorState,
    outcomeState,
    certificateUnlocked,
    enrollment,
    pathSummary,
    summaryByCollectionId,
    isTrackable,
    isCreatorViewingOwnPath,
    isMentorViewingPath,
  } = lp;
  const isCreatorOrMentor = isTrackable && isAuthenticated && (isCreatorViewingOwnPath || isMentorViewingPath);
  // Only meaningful to someone actually walking the path: a creator previewing it holds no skills.
  const pathSkills = usePathSkills(model, summaryByCollectionId, pathSummary);

  return (
    <div className="flex-1 min-w-0 mx-auto max-w-[85rem] px-6 py-7">
      <LearningPathGoBackButton />

      <h1 className="mb-1 text-[1.625rem] font-bold text-foreground">{model.name}</h1>
      {model.description && <p className="mb-5 text-sm text-sunbird-gray-75">{model.description}</p>}

      <div className="mb-4">
        <PathProgressCard
          progress={progress}
          policy={policy}
          courseTotal={model.courseTotal}
          scopeCount={model.allSkills.length}
          batchEndDate={enrollment.batchEndDate}
        />
      </div>

      {enrollment.isEnrolled && pathSkills.summary && (
        <div className="mb-4">
          <PathSkillProgressCard summary={pathSkills.summary} name={pathSkills.name} role={pathSkills.role} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18.75rem] lg:items-start">
        <div>
          {model.levels.length === 0 ? (
            <p className="rounded-xl border border-sunbird-gray-e5 bg-surface p-6 text-center text-sm text-sunbird-gray-75">
              {t('learningPath.noLevels')}
            </p>
          ) : (
            <LedgerTable
              stateOf={enrollment.isEnrolled ? pathSkills.stateOf : undefined}
              skillName={pathSkills.name}
              model={model}
              levelProgress={levelProgress}
              levelStatuses={levelStatuses}
              priorProgress={priorState.progress}
              priorDone={priorState.done}
              outcomeUnlocked={outcomeState.unlocked}
              outcomeProgress={outcomeState.progress}
              summaryByCollectionId={summaryByCollectionId}
              pathSummary={pathSummary}
              isEnrolled={enrollment.isEnrolled}
              onOpenLevel={onOpenLevel}
              onOpenPrior={onOpenPrior}
              onOpenOutcome={model.outcomeAssessment ? onOpenOutcome : undefined}
              onOpenCourse={onOpenCourse}
            />
          )}
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-[8.625rem]">
          {isCreatorOrMentor ? (
            <LearningPathCreatorPanel pathId={model.identifier} pathName={model.name} />
          ) : enrollment.isEnrolled ? (
            <CertificateLockCard
              levelCount={model.levels.length}
              doneLevels={progress.doneLevels}
              unlocked={certificateUnlocked}
            />
          ) : (
            <EnrolCard
              isAuthenticated={isAuthenticated}
              batches={enrollment.batches}
              batchListLoading={enrollment.batchListLoading}
              batchListError={enrollment.batchListError}
              enrolLoading={enrollment.enrolLoading}
              enrolError={enrollment.enrolError}
              onEnrol={enrollment.handleEnrol}
            />
          )}
        </div>
      </div>
    </div>
  );
}
