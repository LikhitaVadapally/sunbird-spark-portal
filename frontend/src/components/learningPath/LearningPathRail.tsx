import { useMemo, useState } from 'react';
import { FiHelpCircle, FiAward } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import { CertificateLockCard } from './CertificateLockCard';
import { LedgerCourseRow } from './LedgerCourseRow';
import { computeCourseProgress, getCourseContentStatus } from '@/services/learningPath/learningPathProgress';
import { buildAssessmentInfoMap } from '@/services/learningPath/learningPathAssessment';
import type { LearningPathModel, LevelProgressInfo, LevelStatusKey, PathProgressInfo } from '@/types/learningPathTypes';
import type { ViewerSummaryRecord } from '@/types/viewerServiceTypes';
import type { PathSkill } from '@/services/learningPath/pathSkillStatus';

interface LearningPathRailProps {
  pathTitle: string;
  model: LearningPathModel;
  progress: PathProgressInfo;
  levelProgress: LevelProgressInfo[];
  levelStatuses: LevelStatusKey[];
  priorDone: boolean;
  outcomeUnlocked: boolean;
  /**
   * Defaults to `true`: the rail only renders inside the player, which already
   * requires enrolment to reach - see `LearningPathPlayerView`'s "must join"
   * dialog. Threaded through anyway for consistency with the ledger, whose
   * prior/course rows use the same three-state pattern.
   */
  isEnrolled?: boolean;
  /** Levels AND the outcome assessment complete — see `isCertificateUnlocked`. */
  certificateUnlocked?: boolean;
  outcomeDone?: boolean;
  /** Needed to show each Level's own courses (with their live progress) while consuming - see `onOpenCourse`. */
  summaryByCollectionId: Map<string, ViewerSummaryRecord>;
  pathSummary?: ViewerSummaryRecord;
  /** The course currently being consumed — its units are shown expanded by default. */
  activeCourseId?: string | undefined;
  activeContentId?: string | undefined;
  onBackToPath: () => void;
  onOpenLevel: (levelId: string) => void;
  onOpenPrior: () => void;
  /** Opens the outcome assessment — only wired up once `outcomeUnlocked` is true. */
  onOpenOutcome?: () => void;
  /** Opens a course directly from its row in the rail (jumps to its first leaf). */
  onOpenCourse: (courseId: string, contentId: string) => void;
  /** Skill names and states for each course's "Gives you" line; without them it shows raw codes. */
  skillName?: (code: string) => string;
  stateOf?: (code: string) => PathSkill | undefined;
}

/**
 * Player-chrome rail — path progress + path structure + certificate — rendered
 * inside `CollectionSidePanel` when a course is opened from within a Learning
 * Path (`?lp=`, see plan §5). Every other course-detail entry point is unaffected.
 */
export function LearningPathRail({
  pathTitle,
  model,
  progress,
  levelProgress,
  levelStatuses,
  priorDone,
  outcomeUnlocked,
  certificateUnlocked = false,
  outcomeDone = false,
  isEnrolled = true,
  summaryByCollectionId,
  pathSummary,
  activeCourseId,
  activeContentId,
  onBackToPath,
  onOpenLevel,
  onOpenPrior,
  onOpenOutcome,
  onOpenCourse,
  skillName,
  stateOf,
}: LearningPathRailProps) {
  const { t } = useAppI18n();
  // `null` = untouched, so the active course stays open until the learner
  // explicitly collapses it; after that their choice wins.
  const [expandedCourseIds, setExpandedCourseIds] = useState<string[] | null>(null);
  // Best score / attempts per leaf. Derived from the path record, which is where
  // both the server's and the optimistic patch's assessment entries land.
  const assessmentInfo = useMemo(() => buildAssessmentInfoMap(pathSummary), [pathSummary]);
  const expanded = expandedCourseIds ?? (activeCourseId ? [activeCourseId] : []);

  const toggleCourse = (courseId: string) =>
    setExpandedCourseIds(
      expanded.includes(courseId) ? expanded.filter((id) => id !== courseId) : [...expanded, courseId]
    );

  return (
    <div className="flex flex-col gap-4" data-testid="learning-path-rail">
      <div className="rounded-xl border border-sunbird-gray-e5 bg-surface p-[1.125rem] shadow-sm">
        <button type="button" onClick={onBackToPath} className="mb-2.5 bg-transparent p-0 text-xs font-medium text-sunbird-brick">
          ← {pathTitle}
        </button>
        <div className="flex items-baseline justify-between gap-2.5">
          <span className="text-sm font-medium text-foreground">{t('learningPath.pathProgress')}</span>
          <span className="text-base font-medium text-sunbird-ink">{progress.pct}%</span>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-pill bg-sunbird-gray-e5">
          <div className="h-full rounded-pill bg-sunbird-brick" style={{ width: `${progress.pct}%` }} />
        </div>
      </div>

      <div className="rounded-xl border border-sunbird-gray-e5 bg-surface p-[1.125rem] shadow-sm">
        <span className="block text-sm font-medium text-foreground">{t('learningPath.level')}</span>
        {model.priorAssessment && (
          <div
            onClick={isEnrolled ? onOpenPrior : undefined}
            role={isEnrolled ? 'button' : undefined}
            tabIndex={isEnrolled ? 0 : undefined}
            onKeyDown={(e) => isEnrolled && e.key === 'Enter' && onOpenPrior()}
            className={`mt-3 flex items-center gap-2.5 rounded-xl border border-sunbird-gray-e5 px-3 py-2.5 ${
              isEnrolled ? 'cursor-pointer' : 'cursor-default opacity-75'
            }`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sunbird-brick text-white">
              <FiHelpCircle className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-medium text-foreground">{model.priorAssessment.name}</span>
              <span className="text-[0.6875rem] text-sunbird-gray-75">
                {/* Three states, matching the Ledger's prior row - see bug: unenrolled
                    learner shown "In progress" on the prior assessment. */}
                {!isEnrolled
                  ? t('learningPath.statusLocked')
                  : priorDone
                    ? t('learningPath.statusCompleted')
                    : t('learningPath.statusInProgress')}
              </span>
            </div>
          </div>
        )}
        <div className="mt-2 flex flex-col gap-2">
          {model.levels.map((level, i) => {
            const lp = levelProgress[i];
            const status = levelStatuses[i];
            const locked = status === 'locked';
            return (
              <div key={level.identifier} className="rounded-xl border border-sunbird-gray-e5">
                <div
                  onClick={locked ? undefined : () => onOpenLevel(level.identifier)}
                  role={locked ? undefined : 'button'}
                  tabIndex={locked ? undefined : 0}
                  onKeyDown={(e) => !locked && e.key === 'Enter' && onOpenLevel(level.identifier)}
                  className={`flex items-start gap-2.5 px-3 py-2.5 ${locked ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${locked ? 'bg-sunbird-gray-b2' : 'bg-sunbird-brick'}`}
                  >
                    {(lp?.pct ?? 0) >= 100 ? '✓' : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-medium text-foreground">
                      {t('learningPath.levelOf', { num: i + 1 })} · {level.name}
                    </span>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-pill bg-sunbird-gray-e5">
                      <div className="h-full rounded-pill bg-sunbird-brick" style={{ width: `${lp?.pct ?? 0}%` }} />
                    </div>
                  </div>
                </div>
                {/* This Level's own courses, so a learner can see (and jump straight to) exactly
                    what's inside it while consuming - not just the Level's rolled-up percentage. */}
                {!locked && level.courses.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-sunbird-gray-e5 p-2.5 pl-3">
                    {level.courses.map((course) => {
                      const courseProgress = computeCourseProgress(course, summaryByCollectionId, pathSummary);
                      return (
                        <LedgerCourseRow
                          key={course.identifier}
                          course={course}
                          progress={courseProgress}
                          onOpen={() => onOpenCourse(course.identifier, course.leafIds[0] ?? '')}
                          isExpanded={expanded.includes(course.identifier)}
                          onToggle={() => toggleCourse(course.identifier)}
                          onOpenContent={(contentId) => onOpenCourse(course.identifier, contentId)}
                          contentStatus={getCourseContentStatus(course, summaryByCollectionId, pathSummary)}
                          assessmentInfo={assessmentInfo}
                          activeContentId={activeContentId ?? null}
                          isEnrolled={isEnrolled}
                          isOptional={courseProgress.optional}
                          skillName={skillName}
                          stateOf={stateOf}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {model.outcomeAssessment && (
          <div
            onClick={outcomeUnlocked ? onOpenOutcome : undefined}
            role={outcomeUnlocked && onOpenOutcome ? 'button' : undefined}
            tabIndex={outcomeUnlocked && onOpenOutcome ? 0 : undefined}
            onKeyDown={(e) => outcomeUnlocked && e.key === 'Enter' && onOpenOutcome?.()}
            className={`mt-2 flex items-center gap-2.5 rounded-xl border border-dashed border-sunbird-gray-b2 px-3 py-2.5 ${
              outcomeUnlocked && onOpenOutcome ? 'cursor-pointer' : 'opacity-75'
            }`}
            data-testid="rail-outcome-row"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sunbird-brick/10 text-sunbird-brick">
              <FiAward className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-medium text-foreground">
                {model.outcomeAssessment.name}
              </span>
              <span className="text-[0.6875rem] text-sunbird-gray-75">
                {outcomeDone
                  ? t('learningPath.statusCompleted')
                  : outcomeUnlocked
                    ? t('learningPath.start')
                    : t('learningPath.locked')}
              </span>
            </div>
          </div>
        )}
      </div>

      <CertificateLockCard levelCount={model.levels.length} doneLevels={progress.doneLevels} unlocked={certificateUnlocked} />
    </div>
  );
}
