import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useContentSearch } from './useContent';
import { collectionHierarchyQueryOptions } from './useCollection';
import { parseLearningPath } from '../services/learningPath/learningPathMapper';
import { derivePathSkillCodes, splitPathSkills } from '../services/learningPath/skillAggregation';
import type { PathSkillSummary } from '../services/learningPath/skillAggregation';
import type { CollectionData } from '../types/collectionTypes';

const DISCOVER_LIMIT = 10;
const DISCOVER_CANDIDATE_CAP = 6;
const SUGGESTION_LIMIT = 10;
const NOTHING_FINISHED: ReadonlySet<string> = new Set();

export type SkillSuggestionSource = 'enrolled' | 'discover';

/** A Learning Path worth recommending: what it would add that the learner doesn't already have. */
export interface SkillSuggestion {
  pathId: string;
  pathName: string;
  /** Set only for enrolled-incomplete paths — enables a resume link. */
  contextId?: string;
  source: SkillSuggestionSource;
  progressPct: number;
  /** Skill CODES this path would add that the learner doesn't hold from any source. */
  newSkills: string[];
  totalSkills: number;
}

/** An enrolled path adds exactly its pending skills - the same set My Skills lists as pending. */
function fromEnrolled(summaries: PathSkillSummary[], heldCodes: ReadonlySet<string>): SkillSuggestion[] {
  return summaries
    .filter((summary) => summary.status !== 'completed')
    .map((summary) => ({
      pathId: summary.pathId,
      pathName: summary.pathName,
      contextId: summary.contextId,
      source: 'enrolled' as const,
      progressPct: summary.progressPct,
      newSkills: splitPathSkills(summary, heldCodes).pending,
      totalSkills: summary.taughtCodes.length,
    }))
    .filter((suggestion) => suggestion.newSkills.length > 0);
}

/**
 * Learning Paths worth trying next: the enrolled-but-incomplete paths still
 * carrying new skills, plus a handful of unenrolled Live paths discovered via
 * content search. Both are ranked by how many new skills they'd unlock.
 *
 * Unenrolled paths need their hierarchy fetched — `ContentSearchItem` carries
 * no skill tags, so search alone can't answer "what would this teach me?".
 * That fan-out shares cache keys with `useCollection`/`useMySkills`, so a path
 * already opened elsewhere costs nothing.
 *
 * "Already gained" is `heldCodes` - the skill profile, so a skill earned from a standalone
 * course, an assessment or an external certificate is never suggested again.
 */
export function useSkillSuggestions(
  summaries: PathSkillSummary[],
  enrolledPathIds: string[],
  heldCodes: ReadonlySet<string>
): { suggestions: SkillSuggestion[]; isLoading: boolean } {
  const enrolledSuggestions = useMemo(() => fromEnrolled(summaries, heldCodes), [summaries, heldCodes]);

  const { data: searchData, isLoading: isSearchLoading } = useContentSearch({
    request: {
      filters: { status: ['Live'], objectType: ['Content'], primaryCategory: ['Learning Path'] },
      sort_by: { lastUpdatedOn: 'desc' },
      limit: DISCOVER_LIMIT,
    },
  });

  const enrolledIdSet = useMemo(() => new Set(enrolledPathIds), [enrolledPathIds]);
  const candidates = useMemo(
    () =>
      (searchData?.data?.content ?? [])
        .filter((item) => !enrolledIdSet.has(item.identifier))
        .slice(0, DISCOVER_CANDIDATE_CAP),
    [searchData, enrolledIdSet]
  );

  const hierarchyQueries = useQueries({
    queries: candidates.map((item) => collectionHierarchyQueryOptions(item.identifier)),
  });

  const discoverSuggestions = useMemo(() => {
    return candidates
      .map((item, i): SkillSuggestion | null => {
        const data = hierarchyQueries[i]?.data as CollectionData | null | undefined;
        const hierarchyRoot = data?.hierarchyRoot;
        if (!hierarchyRoot) return null;

        const model = parseLearningPath(hierarchyRoot);
        // Nothing is finished in a path the learner has not joined, so all of it is still to do.
        const { taughtCodes } = derivePathSkillCodes(model, NOTHING_FINISHED);
        const newSkills = taughtCodes.filter((code) => !heldCodes.has(code));
        if (newSkills.length === 0) return null;

        return {
          pathId: item.identifier,
          pathName: item.name ?? model.name,
          source: 'discover',
          progressPct: 0,
          newSkills,
          totalSkills: taughtCodes.length,
        };
      })
      .filter((suggestion): suggestion is SkillSuggestion => suggestion !== null);
  }, [candidates, hierarchyQueries, heldCodes]);

  const suggestions = useMemo(() => {
    const combined = [...enrolledSuggestions, ...discoverSuggestions];
    return combined
      .sort((a, b) => {
        if (b.newSkills.length !== a.newSkills.length) return b.newSkills.length - a.newSkills.length;
        if (a.source !== b.source) return a.source === 'enrolled' ? -1 : 1;
        return a.pathName.localeCompare(b.pathName);
      })
      .slice(0, SUGGESTION_LIMIT);
  }, [enrolledSuggestions, discoverSuggestions]);

  const isDiscoverHierarchyLoading = candidates.length > 0 && hierarchyQueries.some((q) => q.isLoading);

  return { suggestions, isLoading: isSearchLoading || isDiscoverHierarchyLoading };
}
