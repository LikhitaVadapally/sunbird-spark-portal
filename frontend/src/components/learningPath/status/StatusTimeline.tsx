import { StatusTimelineNode } from './StatusTimelineNode';
import type { LPLevelNode, LevelProgressInfo } from '@/types/learningPathTypes';
import type { ViewerSummaryRecord } from '@/types/viewerServiceTypes';

interface StatusTimelineProps {
  levels: LPLevelNode[];
  attainedLevels: boolean[];
  levelProgress: LevelProgressInfo[];
  gainedSkills: ReadonlySet<string>;
  nameOf: (code: string) => string;
  selectedSkill: string | null;
  expandedLevelIds: ReadonlySet<string>;
  summaryByCollectionId: Map<string, ViewerSummaryRecord>;
  pathSummary?: ViewerSummaryRecord;
  onToggleLevel: (levelId: string) => void;
  onSelectSkill: (skill: string) => void;
}

/** The vertical spine connecting every Level of the path — nothing is ever hidden or locked here. */
export function StatusTimeline({
  levels,
  attainedLevels,
  levelProgress,
  gainedSkills,
  nameOf,
  selectedSkill,
  expandedLevelIds,
  summaryByCollectionId,
  pathSummary,
  onToggleLevel,
  onSelectSkill,
}: StatusTimelineProps) {
  return (
    <ol className="relative flex flex-col gap-4" data-testid="status-timeline">
      <div aria-hidden className="absolute bottom-8 left-5 top-8 w-0.5 bg-sunbird-gray-e5" />
      {levels.map((level, i) => (
        <StatusTimelineNode
          key={level.identifier}
          level={level}
          levelNumber={i + 1}
          attained={attainedLevels[i] ?? false}
          progress={levelProgress[i] ?? { pct: 0, completed: 0, total: 0, doneCourses: 0 }}
          gainedSkills={gainedSkills}
          nameOf={nameOf}
          selectedSkill={selectedSkill}
          expanded={expandedLevelIds.has(level.identifier)}
          summaryByCollectionId={summaryByCollectionId}
          pathSummary={pathSummary}
          onToggle={() => onToggleLevel(level.identifier)}
          onSelectSkill={onSelectSkill}
        />
      ))}
    </ol>
  );
}
