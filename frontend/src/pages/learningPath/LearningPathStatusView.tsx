import { useMemo, useState } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import { LearningPathGoBackButton } from '@/components/learningPath/LearningPathGoBackButton';
import { StatusHero } from '@/components/learningPath/status/StatusHero';
import { SkillCelebrationPanel } from '@/components/learningPath/status/SkillCelebrationPanel';
import { StatusTimeline } from '@/components/learningPath/status/StatusTimeline';
import { getAttainedLevels } from '@/services/learningPath/skillAttainment';
import type { useLearningPath } from '@/hooks/useLearningPath';
import type { UsePathSkillsResult } from '@/hooks/usePathSkills';

type LearningPathData = ReturnType<typeof useLearningPath>;

interface LearningPathStatusViewProps {
  lp: LearningPathData;
  /** Route to the Learning Path itself — the only navigation this read-only page offers. */
  pathLink: string;
  /** Gained/pending by the My Skills rule - computed once by the page so every view agrees. */
  pathSkills: UsePathSkillsResult;
}

/**
 * Learning Path status page: a read-only skill ledger. Every Level is shown and
 * expandable regardless of the path's unlock policy, and no row launches content —
 * learners head back into the path through the single link in the hero.
 */
export function LearningPathStatusView({ lp, pathLink, pathSkills }: LearningPathStatusViewProps) {
  const { t } = useAppI18n();
  const {
    model,
    progress,
    levelProgress,
    levelStatuses,
    pathSummary,
    summaryByCollectionId,
    isCreatorViewingOwnPath,
    isMentorViewingPath,
  } = lp;

  const attainedLevels = useMemo(
    () => getAttainedLevels(levelProgress, levelStatuses),
    [levelProgress, levelStatuses]
  );
  // Skills are CODES here, gained from the skill profile - the same numbers My Skills shows.
  const pathSkillCodes = useMemo(() => (pathSkills.summary?.skills ?? []).map((s) => s.code), [pathSkills.summary]);
  const gainedCount = pathSkills.summary?.held ?? 0;

  // Every level starts open: this page is a summary, not a navigation tree.
  const [collapsedLevelIds, setCollapsedLevelIds] = useState<Set<string>>(() => new Set());
  const expandedLevelIds = useMemo(
    () => new Set(model.levels.map((l) => l.identifier).filter((id) => !collapsedLevelIds.has(id))),
    [model.levels, collapsedLevelIds]
  );

  const toggleLevel = (levelId: string) => {
    setCollapsedLevelIds((prev) => {
      const next = new Set(prev);
      if (next.has(levelId)) next.delete(levelId);
      else next.add(levelId);
      return next;
    });
  };

  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const selectSkill = (skill: string) => setSelectedSkill((prev) => (prev === skill ? null : skill));

  return (
    <div className="flex-1 min-w-0 mx-auto max-w-[85rem] px-6 py-7">
      <LearningPathGoBackButton />

      {(isCreatorViewingOwnPath || isMentorViewingPath) && (
        <p
          className="mb-4 rounded-lg border border-sunbird-gray-e5 bg-sunbird-ivory px-4 py-2 text-xs text-sunbird-gray-75"
          data-testid="status-viewer-note"
        >
          {t('learningPath.viewerNote')}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[21rem_1fr] lg:items-start">
        <div className="flex flex-col gap-4 lg:sticky lg:top-[8.625rem]">
          <StatusHero
            pathName={model.name}
            progress={progress}
            gainedCount={gainedCount}
            skillTotal={pathSkillCodes.length}
            pathLink={pathLink}
          />
        </div>

        <div className="flex flex-col gap-5">
          <SkillCelebrationPanel
            allSkills={pathSkillCodes}
            gainedSkills={pathSkills.heldCodes}
            nameOf={pathSkills.name}
            selectedSkill={selectedSkill}
            onSelectSkill={selectSkill}
            onClearSkill={() => setSelectedSkill(null)}
          />

          {model.levels.length === 0 ? (
            <p className="rounded-2xl border border-sunbird-gray-e5 bg-surface p-6 text-center text-sm text-sunbird-gray-75">
              {t('learningPath.noLevels')}
            </p>
          ) : (
            <StatusTimeline
              levels={model.levels}
              attainedLevels={attainedLevels}
              levelProgress={levelProgress}
              gainedSkills={pathSkills.heldCodes}
              nameOf={pathSkills.name}
              selectedSkill={selectedSkill}
              expandedLevelIds={expandedLevelIds}
              summaryByCollectionId={summaryByCollectionId}
              pathSummary={pathSummary}
              onToggleLevel={toggleLevel}
              onSelectSkill={selectSkill}
            />
          )}
        </div>
      </div>
    </div>
  );
}
