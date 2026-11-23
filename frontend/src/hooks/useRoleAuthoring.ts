import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { skillService, normaliseAuthoredRoles, normaliseRoleDiff } from '@/services/skill';
import { competencyRolesKey } from '@/hooks/useSkillProfile';
import type { AuthoredRole, RoleDiff, RoleUpsertRequest } from '@/types/skillServiceTypes';

export const authoredRolesKey = (frameworkId: string) => ['authoredRoles', frameworkId] as const;

/**
 * After any role write, refresh both reads of the role table: the admin list here, and the
 * learner-facing role list that `useSkillFrameworks` caches - the Assign dropdown uses the
 * latter, so without it a new or retired role would not show up there until a reload.
 */
function useInvalidateRoles(frameworkId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: authoredRolesKey(frameworkId) });
    void queryClient.invalidateQueries({ queryKey: competencyRolesKey(frameworkId) });
  };
}

/** Every authored role of a framework, RETIRED included. */
export function useAuthoredRoles(frameworkId: string): {
  roles: AuthoredRole[];
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: authoredRolesKey(frameworkId),
    queryFn: async () => normaliseAuthoredRoles((await skillService.roleRead({ frameworkId })).data),
    enabled: Boolean(frameworkId),
  });
  return { roles: query.data ?? [], isLoading: query.isLoading, isError: query.isError };
}

/** Create, edit or reactivate a role. Resolves to what changed. */
export function useUpsertRole(frameworkId: string) {
  const invalidate = useInvalidateRoles(frameworkId);
  return useMutation<RoleDiff | undefined, Error, Omit<RoleUpsertRequest, 'frameworkId'>>({
    mutationFn: async (role) =>
      normaliseRoleDiff((await skillService.roleUpsert({ ...role, frameworkId })).data),
    onSuccess: invalidate,
  });
}

/** Retire a role (learners holding it keep it). */
export function useRetireRole(frameworkId: string) {
  const invalidate = useInvalidateRoles(frameworkId);
  return useMutation<RoleDiff | undefined, Error, string>({
    mutationFn: async (roleId) =>
      normaliseRoleDiff((await skillService.roleRetire({ frameworkId, roleId })).data),
    onSuccess: invalidate,
  });
}
