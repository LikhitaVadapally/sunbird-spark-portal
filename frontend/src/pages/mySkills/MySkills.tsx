import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import useImpression from '@/hooks/useImpression';
import { useToast } from '@/hooks/useToast';
import { useMySkills } from '@/hooks/useMySkills';
import { useSkillSuggestions } from '@/hooks/useSkillSuggestions';
import PageLoader from '@/components/common/PageLoader';
import { MySkillsHero } from '@/components/mySkills/MySkillsHero';
import { MySkillsControls } from '@/components/mySkills/MySkillsControls';
import { SkillInsights } from '@/components/mySkills/SkillInsights';
import { SkillGrowthChart } from '@/components/mySkills/SkillGrowthChart';
import { SkillSuggestionRow } from '@/components/mySkills/SkillSuggestionRow';
import { SkillCard } from '@/components/mySkills/SkillCard';
import { SkillPathAccordion } from '@/components/mySkills/SkillPathAccordion';
import { EmptyResult, ProfileErrorBanner, SkillCardSkeletons } from '@/components/mySkills/MySkillsStates';
import { filterPathSummaries } from '@/services/learningPath/skillAggregation';
import { buildSkillGrowthSeries } from '@/services/learningPath/skillGrowth';
import {
  filterMySkills,
  getMostReinforcedSkills,
} from '@/services/skill/mySkills';
import type { SkillsView } from '@/components/mySkills/MySkillsControls';
import type { PathSkillStatus } from '@/services/learningPath/skillAggregation';
import type { MySkillEntry, SkillStatusFilter } from '@/services/skill/mySkills';

const PAGE_SIZE = 24;

const MySkills = () => {
  const { t } = useAppI18n();
  const { toast } = useToast();
  useImpression({ type: 'view', pageid: 'my-skills', env: 'profile' });

  const {
    entries, summaries, skills, heldCodes, aggregate, labelOf, labelsLoading,
    analyzedCount, totalCount, isLoading, isError, profileError, refetch,
  } = useMySkills();

  const [view, setView] = useState<SkillsView>('skills');
  const [query, setQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState<SkillStatusFilter>('all');
  const [groupFilter, setGroupFilter] = useState('');
  const [pathFilter, setPathFilter] = useState<PathSkillStatus | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [expandedPathId, setExpandedPathId] = useState<string | null>(null);

  // Once per failure, not per render: the banner below stays for as long as the error does.
  const toastedProfileError = useRef(false);
  useEffect(() => {
    if (profileError && !toastedProfileError.current) {
      toast({ title: t('mySkills.profileError'), variant: 'destructive' });
    }
    toastedProfileError.current = profileError;
  }, [profileError, toast, t]);

  const labelOfEntry = (entry: MySkillEntry) => labelOf(entry.code, entry.frameworkId);
  const nameOf = (code: string, frameworkId?: string) => labelOf(code, frameworkId).name;

  const mostReinforced = useMemo(() => getMostReinforcedSkills(skills), [skills]);
  const growthSeries = useMemo(() => buildSkillGrowthSeries(skills), [skills]);

  const enrolledPathIds = useMemo(() => entries.map((entry) => entry.path.pathId), [entries]);
  const { suggestions } = useSkillSuggestions(summaries, enrolledPathIds, heldCodes);

  const groupOptions = useMemo(
    () =>
      [...new Set(skills.map((s) => labelOf(s.code, s.frameworkId).group).filter((g): g is string => !!g))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [skills, labelOf]
  );

  const matchingSkills = useMemo(
    () =>
      filterMySkills(skills, {
        query,
        status: skillFilter,
        group: groupFilter,
        labelOf: (entry) => labelOf(entry.code, entry.frameworkId),
      }),
    [skills, query, skillFilter, groupFilter, labelOf]
  );
  const visibleSkills = matchingSkills.slice(0, visibleCount);

  // A path still loading has no skills to match on yet, so it stays visible as a skeleton.
  const matchedPathIds = useMemo(
    () =>
      new Set(
        filterPathSummaries(summaries, { query, status: pathFilter, nameOf: (code) => labelOf(code).name }).map(
          (s) => s.pathId
        )
      ),
    [summaries, query, pathFilter, labelOf]
  );
  const matchingPathEntries = useMemo(
    () => entries.filter((e) => !e.summary || matchedPathIds.has(e.summary.pathId)),
    [entries, matchedPathIds]
  );
  const visiblePaths = matchingPathEntries.slice(0, visibleCount);

  const isSkillsView = view === 'skills';
  const hasMore = isSkillsView ? matchingSkills.length > visibleSkills.length : matchingPathEntries.length > visiblePaths.length;

  const resetPaging = () => setVisibleCount(PAGE_SIZE);

  const selectSkillFromInsights = (entry: MySkillEntry) => {
    setView('skills');
    setSkillFilter('all');
    setGroupFilter('');
    setQuery(labelOfEntry(entry).name);
    setExpandedSkill(entry.code);
    resetPaging();
  };

  const filterOptions = isSkillsView
    ? [
        { value: 'all', label: t('tabs.all') },
        { value: 'gained', label: t('mySkills.gained') },
        { value: 'pending', label: t('mySkills.pending') },
      ]
    : [
        { value: 'all', label: t('tabs.all') },
        { value: 'completed', label: t('status.completed') },
        { value: 'ongoing', label: t('status.ongoing') },
        { value: 'not-started', label: t('status.notStarted') },
      ];

  if (isLoading) return <PageLoader message={t('mySkills.loading')} fullPage={false} />;
  if (isError) return <PageLoader error={t('mySkills.errorLoading')} onRetry={refetch} fullPage={false} />;

  const isEmpty = totalCount === 0 && skills.length === 0;

  return (
    <div className="mx-auto w-full max-w-[110rem] px-6 py-7">
      <h1 className="text-xl font-bold text-foreground">{t('mySkills.title')}</h1>
      <p className="mt-1 text-sm text-sunbird-gray-75">{t('mySkills.subtitle')}</p>

      {profileError && <ProfileErrorBanner onRetry={refetch} />}

      {isEmpty ? (
        <div className="mt-6 flex min-h-[12rem] items-center justify-center rounded-2xl border border-sunbird-gray-e5 bg-surface">
          <p className="text-sm text-sunbird-gray-75">{t('mySkills.noSkills')}</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[19rem_1fr] lg:items-start">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-[8.625rem]">
            <MySkillsHero aggregate={aggregate} analyzedCount={analyzedCount} totalCount={totalCount} />
            <SkillGrowthChart series={growthSeries} />
            {!labelsLoading && (
              <SkillInsights
                mostReinforced={mostReinforced}
                nameOf={(entry) => labelOfEntry(entry).name}
                onSelectSkill={selectSkillFromInsights}
              />
            )}
          </aside>

          <div className="flex min-w-0 flex-col gap-4">
            {!labelsLoading && <SkillSuggestionRow suggestions={suggestions} nameOf={(code) => nameOf(code)} />}
            <MySkillsControls
              view={view}
              onViewChange={(next) => {
                setView(next);
                resetPaging();
              }}
              query={query}
              onQueryChange={(next) => {
                setQuery(next);
                resetPaging();
              }}
              filter={isSkillsView ? skillFilter : pathFilter}
              onFilterChange={(next) => {
                if (isSkillsView) setSkillFilter(next as SkillStatusFilter);
                else setPathFilter(next as PathSkillStatus | 'all');
                resetPaging();
              }}
              filterOptions={filterOptions}
              groupOptions={groupOptions}
              group={groupFilter}
              onGroupChange={(next) => {
                setGroupFilter(next);
                resetPaging();
              }}
              resultLabel={
                isSkillsView
                  ? t('mySkills.skillCount', { count: matchingSkills.length })
                  : t('mySkills.pathResultCount', { count: matchingPathEntries.length })
              }
            />

            {isSkillsView && labelsLoading ? (
              <SkillCardSkeletons />
            ) : isSkillsView ? (
              visibleSkills.length === 0 ? (
                <EmptyResult label={t('mySkills.noSkillResults')} />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleSkills.map((entry) => (
                    <SkillCard
                      key={entry.code}
                      entry={entry}
                      label={labelOfEntry(entry)}
                      isExpanded={expandedSkill === entry.code}
                      onToggle={() => setExpandedSkill((prev) => (prev === entry.code ? null : entry.code))}
                    />
                  ))}
                </div>
              )
            ) : visiblePaths.length === 0 ? (
              <EmptyResult label={t('mySkills.noResults')} />
            ) : (
              <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
                {visiblePaths.map((entry) => (
                  <SkillPathAccordion
                    key={entry.path.contextId ?? entry.path.pathId}
                    pathName={entry.summary?.pathName || entry.path.name}
                    summary={entry.summary}
                    heldCodes={heldCodes}
                    nameOf={nameOf}
                    isLoading={entry.isLoading || labelsLoading}
                    isExpanded={expandedPathId === entry.path.pathId}
                    onToggle={() =>
                      setExpandedPathId((prev) => (prev === entry.path.pathId ? null : entry.path.pathId))
                    }
                  />
                ))}
              </div>
            )}

            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="self-center text-sm font-medium text-sunbird-brick hover:underline"
              >
                {t('mySkills.loadMore')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MySkills;
