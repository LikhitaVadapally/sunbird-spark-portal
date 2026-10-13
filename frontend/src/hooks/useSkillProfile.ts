import { useCallback, useMemo } from 'react';
import { useQuery, useQueries, useMutation } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import {
  skillService,
  normaliseProfile,
  normaliseFrameworkMeta,
  buildSkillVocabulary,
  resolveSkillLabel,
  type SkillLabel,
  type SkillVocabulary,
  type TaxonomyFrameworkResponse,
} from '@/services/skill';
import { FrameworkService } from '@/services/FrameworkService';
import { useUserId } from './useAuthInfo';
import type { CompetencyFrameworkMeta, HeldSkill } from '@/types/skillServiceTypes';

const frameworkService = new FrameworkService();
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
 * The skill tree of each framework, as a code -> name/parent index.
 *
 * Display names and the parent term ("Infection Prevention") live only on the taxonomy
 * framework's nested terms, so this is the one read the learner side needs. Split out of
 * `useSkillFrameworks` because the competency read there (tiers, roles) is admin-only now that
 * role readiness is hidden from learners. Shares its cache key with `useSkillFrameworks`, so
 * the admin screen and the learner pages never read the same tree twice.
 */
export function useSkillVocabularies(frameworkIds: string[]): {
  vocabularies: Record<string, SkillVocabulary | undefined>;
  isLoading: boolean;
} {
  const ids = useMemo(() => Array.from(new Set(frameworkIds.filter(Boolean))).sort(), [frameworkIds]);

  const treeQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['framework', id],
      queryFn: () => frameworkService.read<TaxonomyFrameworkResponse>(id),
      enabled: Boolean(id),
      // A framework changes on publish, not per session; refetching it on every focus only
      // re-flashes the skeleton.
      staleTime: 30 * 60 * 1000,
    })),
  });

  const vocabularies = useMemo(() => {
    const out: Record<string, SkillVocabulary | undefined> = {};
    ids.forEach((id, i) => {
      out[id] = buildSkillVocabulary(id, treeQueries[i]?.data?.data);
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
 * Resolved framework meta plus the skill tree, for every framework given.
 *
 * TWO READS PER FRAMEWORK, deliberately. The competency read gives tier labels, the flat
 * leaf list and each role's required set, but NO tree and NO display names - those live on
 * the taxonomy framework's nested terms (see `useSkillVocabularies`). `useQueries` because the
 * framework count is data-dependent.
 */
export function useSkillFrameworks(frameworkIds: string[]): {
  metas: Record<string, CompetencyFrameworkMeta | undefined>;
  vocabularies: Record<string, SkillVocabulary | undefined>;
  isLoading: boolean;
} {
  const ids = useMemo(() => Array.from(new Set(frameworkIds.filter(Boolean))).sort(), [frameworkIds]);

  const metaQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['competencyFrameworkV2', id],
      queryFn: async () => normaliseFrameworkMeta((await skillService.frameworkRead(id)).data),
      enabled: Boolean(id),
    })),
  });
  const { vocabularies, isLoading: treeLoading } = useSkillVocabularies(ids);

  const metas = useMemo(() => {
    const out: Record<string, CompetencyFrameworkMeta | undefined> = {};
    ids.forEach((id, i) => {
      out[id] = metaQueries[i]?.data;
    });
    return out;
  }, [ids, metaQueries]);

  return {
    metas,
    vocabularies,
    isLoading: metaQueries.some((q) => q.isLoading) || treeLoading,
  };
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
