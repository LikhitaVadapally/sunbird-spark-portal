import { FiChevronRight, FiChevronDown } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import { LevelStatusBadge } from './LevelStatusBadge';
import { LedgerCourseRow } from './LedgerCourseRow';
import { computeCourseProgress } from '@/services/learningPath/learningPathProgress';
import type { LPLevelNode, LevelProgressInfo, LevelStatusKey } from '@/types/learningPathTypes';
import type { PathSkill } from '@/services/learningPath/pathSkillStatus';
import type { ViewerSummaryRecord } from '@/types/viewerServiceTypes';

interface LedgerLevelRowProps {
  /** Per-skill state, forwarded to each course row so it can name what it grants. */
  stateOf?: (code: string) => PathSkill | undefined;
  skillName?: (code: string) => string;
  level: LPLevelNode;
  levelNumber: number;
  progress: LevelProgressInfo;
  status: LevelStatusKey;
  expanded: boolean;
  summaryByCollectionId: Map<string, ViewerSummaryRecord>;
  pathSummary?: ViewerSummaryRecord;
  /** Forwarded to each course row's CTA - see `LedgerCourseRow`'s `isEnrolled`. */
  isEnrolled: boolean;
  onToggle: () => void;
  onOpenLevel: () => void;
  onOpenCourse: (courseId: string, contentId: string) => void;
}

/** A single Level row in the Ledger table, expandable to show its Courses (design's `bRows`). */
export function LedgerLevelRow({
  level,
  levelNumber,
  progress,
  status,
  expanded,
  summaryByCollectionId,
  pathSummary,
  isEnrolled,
  stateOf,
  skillName,
  onToggle,
  onOpenLevel,
  onOpenCourse,
}: LedgerLevelRowProps) {
  const { t } = useAppI18n();
  const isLocked = status === 'locked';

  return (
    <div>
      <div
        // A locked level still opens, so the learner can see which courses it holds.
        onClick={onToggle}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
        className={`grid cursor-pointer grid-cols-[2.375rem_1fr_10rem_8.25rem_6.75rem] items-center gap-3.5 border-t border-sunbird-gray-e5 px-[1.125rem] py-3.5 ${
          isLocked && !expanded ? 'opacity-65' : ''
        } ${expanded ? 'bg-sunbird-ivory' : 'bg-surface'}`}
        data-testid="ledger-level-row"
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
      >
        <span className="flex items-center justify-center text-sunbird-gray-75">
          {expanded ? <FiChevronDown /> : <FiChevronRight />}
        </span>
        <div>
          <span className="block text-sm font-medium text-foreground">
            {t('learningPath.levelOf', { num: levelNumber })} · {level.name}
          </span>
          <span className="text-xs text-sunbird-gray-75">
            {level.courses.length} {t('learningPath.courses')}
          </span>
        </div>
        <span className="text-xs leading-tight text-sunbird-gray-4a">{level.skills.join(' · ')}</span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-sunbird-gray-e5">
            <div className="h-full rounded-pill bg-sunbird-brick" style={{ width: `${progress.pct}%` }} />
          </div>
          <span className="w-9 shrink-0 text-right text-xs text-sunbird-gray-75">{progress.pct}%</span>
        </div>
        <span className="text-right">
          <LevelStatusBadge status={status} />
        </span>
      </div>

      {expanded && (
        <div className="border-t border-dashed border-sunbird-gray-e5 bg-sunbird-ivory px-[1.125rem] py-4 pl-[4.375rem]">
          <div className="flex flex-col gap-2">
            {level.courses.map((course) => {
              const courseProgress = computeCourseProgress(course, summaryByCollectionId, pathSummary);
              return (
                <LedgerCourseRow
                  key={course.identifier}
                  course={course}
                  progress={courseProgress}
                  onOpen={() => onOpenCourse(course.identifier, course.leafIds[0] ?? '')}
                  isEnrolled={isEnrolled}
                  isOptional={courseProgress.optional}
                  isLocked={isLocked}
                  stateOf={stateOf}
                  skillName={skillName}
                />
              );
            })}
          </div>
          {!isLocked && (
            <button
              type="button"
              onClick={onOpenLevel}
              className="mt-3.5 bg-transparent p-0 text-sm font-medium text-sunbird-brick"
            >
              {t('learningPath.openLevelDetail')} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
