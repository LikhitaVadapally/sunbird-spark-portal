import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { skillService, normaliseGap, normaliseRecommendation } from '@/services/skill';
import { nextTargets } from '@/services/skill/roleReadiness';
import { useUserId } from './useAuthInfo';
import type { Recommendation, SkillGap } from '@/types/skillServiceTypes';

const GAP_KEY = 'skillGap';
const RECOMMEND_KEY = 'skillRecommend';

/**
 * Readiness for the learner's assigned role and each target role.
 *
 * No `frameworkId` is sent: the service reads it from the learner's `user_role` row and reports it
 * back, which is how the page learns which framework the roles belong to. A learner with no roles
 * gets `frameworkId: ''` and nothing to measure.
 */
export function useSkillGap(): {
  gap: SkillGap | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const userId = useUserId();
  const query = useQuery({
    queryKey: [GAP_KEY, userId],
    queryFn: async () => normaliseGap((await skillService.gapRead()).data),
    enabled: Boolean(userId),
  });
  return { gap: query.data, isLoading: query.isLoading, isError: query.isError, refetch: () => void query.refetch() };
}

/**
 * Ranked content that closes one role's missing skills.
 *
 * `role` is always passed: without it the service picks the alphabetically first target, which is
 * not necessarily the role the learner is looking at.
 */
export function useSkillRecommend(
  frameworkId: string | undefined,
  role: string | undefined
): { recommendation: Recommendation | undefined; isLoading: boolean } {
  const userId = useUserId();
  const query = useQuery({
    queryKey: [RECOMMEND_KEY, userId, frameworkId, role],
    queryFn: async () => normaliseRecommendation((await skillService.recommend({ frameworkId, role })).data),
    enabled: Boolean(userId && frameworkId && role),
  });
  return { recommendation: query.data, isLoading: query.isLoading };
}

/**
 * Adds or removes one target role.
 *
 * `role/update` replaces the whole stored set, so the request carries every target the learner
 * keeps (see `nextTargets`). Only targets are settable here - the assigned role is an admin's.
 */
export function useUpdateTargetRoles(frameworkId: string | undefined, gap: SkillGap | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (change: { add?: string; remove?: string }) => {
      if (!frameworkId) throw new Error('No framework to save target roles against');
      await skillService.updateTargetRoles({ frameworkId, targetRoles: nextTargets(gap, change) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [GAP_KEY] });
      void queryClient.invalidateQueries({ queryKey: [RECOMMEND_KEY] });
    },
  });
}
