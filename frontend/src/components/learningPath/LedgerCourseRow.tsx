import { FiBookOpen, FiChevronDown, FiChevronUp, FiHelpCircle } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import { Badge } from '@/components/ui/badge';
import { CourseUnitTree } from './CourseUnitTree';
import type { LPCourseNode } from '@/types/learningPathTypes';
import type { LPAssessmentInfo } from '@/services/learningPath';
import type { ProgressInfo } from '@/types/learningPathTypes';
import type { PathSkill } from '@/services/learningPath/pathSkillStatus';

interface LedgerCourseRowProps {
  course: LPCourseNode;
  progress: ProgressInfo & { status: 'completed' | 'active' | 'notStarted' };
  onOpen: () => void;
  /**
   * Expand/collapse of the course's own units. Opt-in: when `onToggle` is
   * omitted the row behaves exactly as before (no chevron, no unit tree), so
   * the ledger table and level-detail screens are unaffected.
   */
  isExpanded?: boolean;
  onToggle?: () => void;
  /** Opens one leaf inside this course. Required for the unit tree to be interactive. */
  onOpenContent?: (contentId: string) => void;
  contentStatus?: Record<string, number>;
  /** Best score / attempts per leaf, forwarded to the unit tree. */
  assessmentInfo?: Record<string, LPAssessmentInfo>;
  activeContentId?: string | null;
  /** Per-skill state, so the row can say what it grants and why it was waived. */
  stateOf?: (code: string) => PathSkill | undefined;
  skillName?: (code: string) => string;
  /**
   * Defaults to `true` so every existing caller is unaffected. When `false`
   * (the learner has not joined this Learning Path), the CTA reads "Enrol to
   * start" instead of Start/Resume/Revisit, and the row is not clickable -
   * see bug: unenrolled learner could open course content from the ledger.
   */
  isEnrolled?: boolean;
  /**
   * Defaults to `false`. When `true` (the course was waived by a prior
   * assessment - see `computeCourseProgress`'s `optional` flag), an "Optional"
   * badge is shown beside the question-set-only badge. The course stays fully
   * visible and openable either way - only progress denominators exclude it.
   */
  isOptional?: boolean;
  /** Defaults to `false`. When `true` (its Level is still locked), the row is listed but cannot be opened. */
  isLocked?: boolean;
}

// "Revisit" rather than "Review" for a finished course: "Review" is taken by the
// authoring review/publish pipeline, so it reads as a workflow action here.
const CTA_KEY: Record<'completed' | 'active' | 'notStarted', string> = {
  completed: 'learningPath.revisit',
  active: 'learningPath.resume',
  notStarted: 'learningPath.start',
};

/** A single Course row inside an expanded Level (design's `c.` row template). */
export function LedgerCourseRow({
  course,
  progress,
  onOpen,
  isExpanded = false,
  onToggle,
  onOpenContent,
  contentStatus,
  assessmentInfo,
  activeContentId = null,
  isEnrolled = true,
  isOptional = false,
  isLocked = false,
  stateOf,
  skillName,
}: LedgerCourseRowProps) {
  const { t } = useAppI18n();
  const Icon = course.isAssessmentCourse ? FiHelpCircle : FiBookOpen;
  const units = course.units ?? [];
  const isExpandable = Boolean(onToggle) && units.length > 0;
  const canOpen = isEnrolled && !isLocked;

  const grants = course.skillCodes ?? [];
  const nameOf = skillName ?? ((c: string) => c);
  // "Already hold" is only claimable when we actually know the learner's state for every one.
  const allHeld =
    grants.length > 0 && stateOf !== undefined && grants.every((c) => stateOf(c)?.state === 'held');
  const skillLine =
    grants.length === 0
      ? undefined
      : allHeld
        ? t('learningPath.alreadyHold', { skills: grants.map(nameOf).join(', ') })
        : t('learningPath.givesYou', { skills: grants.map(nameOf).join(', ') });

  return (
    <div className="rounded-md border border-sunbird-gray-e5 bg-surface" data-testid="ledger-course-row-wrapper">
      <div
        onClick={canOpen ? onOpen : undefined}
        className={`flex items-center gap-3 px-3.5 py-3 ${canOpen ? 'cursor-pointer' : 'cursor-default'}`}
        data-testid="ledger-course-row"
        role={canOpen ? 'button' : undefined}
        tabIndex={canOpen ? 0 : undefined}
        onKeyDown={(e) => canOpen && e.key === 'Enter' && onOpen()}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sunbird-brick/15 text-sunbird-brick">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{course.name}</span>
            {course.isAssessmentCourse && (
              <Badge variant="secondary" className="text-[0.6875rem]">
                {t('learningPath.questionSetOnly')}
              </Badge>
            )}
            {isOptional && (
              <Badge variant="secondary" className="text-[0.6875rem]">
                {t('learningPath.optional')}
              </Badge>
            )}
          </div>
          <span className="text-xs text-sunbird-gray-75">
            {progress.completed}/{progress.total} · {progress.pct}%
          </span>
          {/* An "Optional" badge on its own gives no reason. Naming the skills the learner already
              holds turns a bare label into an explanation. */}
          {skillLine && (
            <span className="block text-xs text-sunbird-gray-82" data-testid="course-skill-line">
              {skillLine}
            </span>
          )}
        </div>
        <span className="shrink-0 text-sm font-medium text-sunbird-brick">
          {!isEnrolled
            ? t('learningPath.enrolToStart')
            : isLocked
              ? t('learningPath.locked')
              : t(CTA_KEY[progress.status])}
        </span>
        {isExpandable && (
          // Stops propagation so toggling the unit list never navigates into the course.
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
            aria-expanded={isExpanded}
            aria-label={t(isExpanded ? 'learningPath.hideUnits' : 'learningPath.showUnits')}
            data-testid="ledger-course-row-toggle"
            className="shrink-0 bg-transparent p-1 text-sunbird-gray-75"
          >
            {isExpanded ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>
      {isExpandable && isExpanded && (
        <div className="border-t border-sunbird-gray-e5 px-3 py-2">
          <CourseUnitTree
            nodes={units}
            contentStatus={contentStatus}
            assessmentInfo={assessmentInfo}
            activeContentId={activeContentId}
            onOpenContent={(contentId) => onOpenContent?.(contentId)}
            untitledLabel={t('collectionSidebar.untitled')}
          />
        </div>
      )}
    </div>
  );
}
