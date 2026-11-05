import { useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import {
  skillService,
  normaliseProfile,
  normaliseGap,
  normaliseRecommendation,
  normaliseFrameworkMeta,
  buildSkillVocabulary,
  type SkillVocabulary,
  type TaxonomyFrameworkResponse,
} from '@/services/skill';
import { FrameworkService } from '@/services/FrameworkService';
import { useUserId } from './useAuthInfo';
import type {
  CompetencyFrameworkMeta,
  HeldSkill,
  Recommendation,
  SkillGap,
} from '@/types/skillServiceTypes';

const frameworkService = new FrameworkService();

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

  const skills: HeldSkill[] = query.data ?? [];
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
 * Readiness against the learner's current role and each saved target.
 *
 * `role` previews a role the learner has not saved: the service returns it as `current`,
 * which is how "what if I aimed at this?" is answered without writing anything first.
 */
export function useSkillGap(frameworkId: string | undefined, role?: string): {
  gap: SkillGap | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const userId = useUserId();
  const query = useQuery({
    queryKey: ['skillGap', userId, frameworkId, role],
    queryFn: async () =>
      normaliseGap(
        (await skillService.gapRead({ ...(frameworkId ? { frameworkId } : {}), ...(role ? { role } : {}) })).data
      ),
    enabled: Boolean(userId && frameworkId),
  });
  return { gap: query.data, isLoading: query.isLoading, isError: query.isError };
}

/** Outstanding skills and the ranked content that closes them. */
export function useSkillRecommend(frameworkId: string | undefined, role?: string): {
  recommendation: Recommendation | undefined;
  isLoading: boolean;
} {
  const userId = useUserId();
  const query = useQuery({
    queryKey: ['skillRecommend', userId, frameworkId, role],
    queryFn: async () =>
      normaliseRecommendation(
        (await skillService.recommend({ ...(frameworkId ? { frameworkId } : {}), ...(role ? { role } : {}) })).data
      ),
    enabled: Boolean(userId && frameworkId && role),
  });
  return { recommendation: query.data, isLoading: query.isLoading };
}

/**
 * Resolved framework meta plus the skill tree, for every framework the learner holds
 * skills in.
 *
 * TWO READS PER FRAMEWORK, deliberately. The competency read gives tier labels, the flat
 * leaf list and each role's required set, but NO tree and NO display names - those live on
 * the taxonomy framework's nested terms. `useQueries` because the framework count is
 * data-dependent, mirroring `useMySkills`.
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
      queryFn: async () => {
        try {
          return normaliseFrameworkMeta((await skillService.frameworkRead(id)).data);
        } catch (err) {
          // role/list answers 404 when the framework has no roles yet: that is "no roles", not a failure.
          if ((err as { status?: number }).status === 404) return normaliseFrameworkMeta({ frameworkId: id });
          throw err;
        }
      },
      enabled: Boolean(id),
    })),
  });

  const treeQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['framework', id],
      queryFn: () => frameworkService.read<TaxonomyFrameworkResponse>(id),
      enabled: Boolean(id),
    })),
  });

  const metas = useMemo(() => {
    const out: Record<string, CompetencyFrameworkMeta | undefined> = {};
    ids.forEach((id, i) => {
      out[id] = metaQueries[i]?.data;
    });
    return out;
  }, [ids, metaQueries]);

  const vocabularies = useMemo(() => {
    const out: Record<string, SkillVocabulary | undefined> = {};
    ids.forEach((id, i) => {
      out[id] = buildSkillVocabulary(id, treeQueries[i]?.data?.data);
    });
    return out;
  }, [ids, treeQueries]);

  return {
    metas,
    vocabularies,
    isLoading: metaQueries.some((q) => q.isLoading) || treeQueries.some((q) => q.isLoading),
  };
}

/**
 * Saves the learner's target roles.
 *
 * Best-effort: the gap is computed from the role passed explicitly, so a failed save costs
 * the learner their saved preference, not the readiness they are looking at. Only targets
 * are settable here - `currentRole` is stripped server-side.
 */
export function useSaveTargetRole(frameworkId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (role: string) => {
      if (!frameworkId) return;
      await skillService.updateTargetRoles({ frameworkId, targetRoles: [role] });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['skillGap'] });
      void queryClient.invalidateQueries({ queryKey: ['skillRecommend'] });
    },
  });
}


/**
 * Admin assignment of a learner's current role.
 *
 * Separate from `useSaveTargetRole`, which is the learner setting their own aspiration. These are
 * different facts with different authorities: assigned vs aspired. Invalidates nothing on the
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
