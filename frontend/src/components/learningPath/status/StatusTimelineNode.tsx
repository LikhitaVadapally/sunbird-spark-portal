import { FiCheck, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { useAppI18n } from '@/hooks/useAppI18n';
import { SkillTag } from './SkillTag';
import { StatusCourseRow } from './StatusCourseRow';
import { computeCourseProgress } from '@/services/learningPath/learningPathProgress';
import type { LPLevelNode, LevelProgressInfo } from '@/types/learningPathTypes';
import type { ViewerSummaryRecord } from '@/types/viewerServiceTypes';

interface StatusTimelineNodeProps {
  level: LPLevelNode;
  levelNumber: number;
  /** Attainment only — this page never locks a level, so there is no `locked` state here. */
  attained: boolean;
  progress: LevelProgressInfo;
  /** Codes held from any source (skill profile). */
  gainedSkills: ReadonlySet<string>;
  nameOf: (code: string) => string;
  selectedSkill: string | null;
  expanded: boolean;
  summaryByCollectionId: Map<string, ViewerSummaryRecord>;
  pathSummary?: ViewerSummaryRecord;
  onToggle: () => void;
  onSelectSkill: (skill: string) => void;
}

/** One Level in the status timeline — expandable, read-only, and highlighted when it teaches the selected skill. */
export function StatusTimelineNode({
  level,
  levelNumber,
  attained,
  progress,
  gainedSkills,
  nameOf,
  selectedSkill,
  expanded,
  summaryByCollectionId,
  pathSummary,
  onToggle,
  onSelectSkill,
}: StatusTimelineNodeProps) {
  const { t } = useAppI18n();
  const codes = level.skillCodes;
  const teachesSelected = !!selectedSkill && codes.includes(selectedSkill);
  const isDimmed = !!selectedSkill && !teachesSelected;

  return (
    <li
      className={`relative pl-16 transition-opacity duration-300 ${isDimmed ? 'opacity-40' : ''}`}
      data-testid="status-timeline-node"
    >
      <span
        className={`absolute left-0 top-3 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold shadow-sm transition-all ${
          attained
            ? 'bg-sunbird-success-message text-white'
            : progress.pct > 0
              ? 'border-2 border-sunbird-brick bg-surface text-sunbird-brick'
              : 'border border-sunbird-gray-d0 bg-surface text-sunbird-gray-75'
        }`}
        data-testid="status-node-marker"
      >
        {attained ? <FiCheck className="h-5 w-5" /> : levelNumber}
      </span>

      <div
        className={`overflow-hidden rounded-xl border bg-surface transition-all ${
          teachesSelected ? 'border-sunbird-brick shadow-sunbird-sm' : 'border-sunbird-gray-e5'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-sunbird-ivory ${
            expanded ? 'bg-sunbird-ivory' : ''
          }`}
        >
          <span className="flex items-center justify-center text-sunbird-gray-75">
            {expanded ? <FiChevronDown /> : <FiChevronRight />}
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              {t('learningPath.levelOf', { num: levelNumber })} · {level.name}
            </span>
            <span className="text-xs text-sunbird-gray-75">
              {level.courses.length} {t('learningPath.courses')} ·{' '}
              {t('learningPath.skillsGainedCount', {
                gained: codes.filter((code) => gainedSkills.has(code)).length,
                total: codes.length,
              })}
            </span>
          </div>
          <div className="flex w-32 shrink-0 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-sunbird-gray-e5">
              <div
                className={`h-full rounded-pill transition-all duration-700 ${
                  attained ? 'bg-sunbird-success-message' : 'bg-sunbird-brick'
                }`}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-xs font-medium text-sunbird-gray-75">{progress.pct}%</span>
          </div>
        </button>

        {expanded && (
          <div className="animate-fade-in border-t border-dashed border-sunbird-gray-e5 px-4 py-4">
            {codes.length > 0 && (
              <div className="mb-3">
                <span className="mb-2 block text-[0.6875rem] font-medium uppercase tracking-wider text-sunbird-gray-75">
                  {t('learningPath.skillsInThisLevel')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {codes.map((code, i) => (
                    <SkillTag
                      key={code}
                      skill={code}
                      label={nameOf(code)}
                      gained={gainedSkills.has(code)}
                      index={i}
                      size="sm"
                      selected={selectedSkill === code}
                      onSelect={onSelectSkill}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {level.courses.map((course) => (
                <StatusCourseRow
                  key={course.identifier}
                  course={course}
                  progress={computeCourseProgress(course, summaryByCollectionId, pathSummary)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
