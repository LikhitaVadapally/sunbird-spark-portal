import { useCallback, useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import {
  skillService,
  normaliseProfile,
  normaliseFrameworkMeta,
  resolveSkillLabel,
  type SkillLabel,
  type SkillVocabulary,
} from '@/services/skill';
import { frameworkVocabulary } from '@/services/skill/skillLeaves';
import {
  FRAMEWORK_STALE_MS,
  competencyFrameworkReadKey,
  readCompetencyFramework,
} from '@/services/skill/competencyFrameworkRead';
import { useUserId } from './useAuthInfo';
import { toQuerySlices, type QuerySlice } from './querySlices';
import type { CompetencyFrameworkMeta, HeldSkill } from '@/types/skillServiceTypes';

/**
 * Distinct, sorted ids that keep their identity while the CONTENT is unchanged. Callers pass a fresh
 * `[frameworkId]` each render; keyed on that array, every memo downstream would rebuild every render.
 */
function useStableIds(frameworkIds: string[]): string[] {
  const key = JSON.stringify(Array.from(new Set(frameworkIds.filter(Boolean))).sort());
  return useMemo(() => JSON.parse(key) as string[], [key]);
}

/** Cache key for a framework's roles (lern `role/list`); role authoring invalidates it. */
export const competencyRolesKey = (frameworkId: string) => ['competencyRoles', frameworkId] as const;

/** A competency framework's names and tree, through the read cache shared with the role editor. */
async function readSkillVocabulary(queryClient: QueryClient, id: string): Promise<SkillVocabulary> {
  const body = await queryClient.fetchQuery({
    queryKey: competencyFrameworkReadKey(id),
    queryFn: () => readCompetencyFramework(id),
    staleTime: FRAMEWORK_STALE_MS,
  });
  return frameworkVocabulary(id, body);
}

/**
 * One skill-vocabulary query per framework id. An id that isn't a competency framework fails its
 * read (404, not retried) and settles as an error: its skills keep their codes as names.
 */
function useVocabularyQueries(ids: string[]): Array<QuerySlice<SkillVocabulary>> {
  const queryClient = useQueryClient();
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['skillVocabulary', id],
      queryFn: () => readSkillVocabulary(queryClient, id),
      enabled: Boolean(id),
      staleTime: FRAMEWORK_STALE_MS,
    })),
    combine: toQuerySlices<SkillVocabulary>,
  });
}

const NO_SKILLS: HeldSkill[] = [];

/**
 * The learner's held skills. `evidence: true` so a card can answer "what proved this?"
 * without a second round trip.
 *
 * `isError` is surfaced rather than swallowed: an unreachable API and an empty profile are
 * indistinguishable otherwise, and the v2 routes are not mirrored into the deployed
 * monolith yet, so 404s are the expected failure until they are.
 */
export function useSkillProfile() {
  const userId = useUserId();
  const query = useQuery({
    queryKey: ['skillProfile', userId],
    queryFn: async () => normaliseProfile((await skillService.profileRead({ evidence: true })).data),
    enabled: Boolean(userId),
  });

  // A stable empty array: a fresh `[]` per render would re-run every memo keyed on it.
  const skills: HeldSkill[] = query.data ?? NO_SKILLS;
  const frameworkIds = useMemo(
    () => Array.from(new Set(skills.map((s) => s.frameworkId).filter(Boolean))),
    [skills]
  );

  return {
    skills,
    frameworkIds,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * The skill tree of each competency framework, as a code -> name/parent index.
 *
 * Display names and the parent term ("Infection Prevention") live only on the framework's terms,
 * so this is the one read the learner side needs. Split out of `useSkillFrameworks`, which loads
 * only roles.
 */
export function useSkillVocabularies(frameworkIds: string[]): {
  vocabularies: Record<string, SkillVocabulary | undefined>;
  isLoading: boolean;
} {
  const ids = useStableIds(frameworkIds);
  const treeQueries = useVocabularyQueries(ids);

  const vocabularies = useMemo(() => {
    const out: Record<string, SkillVocabulary | undefined> = {};
    ids.forEach((id, i) => {
      out[id] = treeQueries[i]?.data;
    });
    return out;
  }, [ids, treeQueries]);

  return { vocabularies, isLoading: treeQueries.some((q) => q.isLoading) };
}

/**
 * Name + group label for any skill code, across the given frameworks.
 *
 * `isLoading` is exposed so a page can hold a skeleton while names resolve, instead of flashing
 * de-slugged codes ("dosage-calculation" -> "Dosage calculation") that then change under the
 * learner. Once loaded, a code no framework knows still de-slugs - see `resolveSkillLabel`.
 */
export function useSkillLabels(frameworkIds: string[]): {
  labelOf: (code: string, frameworkId?: string) => SkillLabel;
  isLoading: boolean;
} {
  const { vocabularies, isLoading } = useSkillVocabularies(frameworkIds);
  const labelOf = useCallback(
    (code: string, frameworkId?: string) => resolveSkillLabel(Object.values(vocabularies), code, frameworkId),
    [vocabularies]
  );
  return { labelOf, isLoading };
}

/**
 * Each framework's roles (lern `role/list`): live roles, their skills and role names.
 *
 * Names and the skill tree are not loaded here - every caller needs only the roles; use
 * `useSkillVocabularies` / `useSkillLabels` for names. `useQueries` because the framework count
 * is data-dependent.
 */
export function useSkillFrameworks(frameworkIds: string[]): {
  metas: Record<string, CompetencyFrameworkMeta | undefined>;
  isLoading: boolean;
} {
  const ids = useStableIds(frameworkIds);

  const metaQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: competencyRolesKey(id),
      queryFn: async () => {
        try {
          return normaliseFrameworkMeta((await skillService.roleList(id)).data);
        } catch (err) {
          // role/list answers 404 when the framework has no roles yet: that is "no roles", not a failure.
          if ((err as { status?: number }).status === 404) return normaliseFrameworkMeta({ frameworkId: id });
          throw err;
        }
      },
      enabled: Boolean(id),
    })),
    combine: toQuerySlices<CompetencyFrameworkMeta | undefined>,
  });

  const metas = useMemo(() => {
    const out: Record<string, CompetencyFrameworkMeta | undefined> = {};
    ids.forEach((id, i) => {
      out[id] = metaQueries[i]?.data;
    });
    return out;
  }, [ids, metaQueries]);

  return { metas, isLoading: metaQueries.some((q) => q.isLoading) };
}

/**
 * Admin assignment of a learner's current role.
 *
 * An assignment from the organisation, not a learner preference. Invalidates nothing on the
 * admin's own caches - the learner's profile is not loaded here.
 */
export function useAssignRole(): UseMutationResult<
  unknown,
  Error,
  { userId: string; frameworkId: string; role: string }
> {
  return useMutation({
    mutationFn: (v: { userId: string; frameworkId: string; role: string }) =>
      skillService.assignRole({
        assignUserId: v.userId,
        frameworkId: v.frameworkId,
        role: v.role,
      }),
  });
}
