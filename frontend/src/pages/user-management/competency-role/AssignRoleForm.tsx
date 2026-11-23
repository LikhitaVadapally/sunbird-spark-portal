import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAppI18n } from '@/hooks/useAppI18n';
import { Button } from '@/components/common/Button';
import { useSkillFrameworks, useAssignRole } from '@/hooks/useSkillProfile';
import { userManagementService } from '@/services/UserManagementService';
import { learnerQueryKind, toFoundUser, type FoundUser, type FoundUserWire } from './learnerLookup';

type Lookup = { status: 'found'; user: FoundUser } | { status: 'none' | 'many' };

/** Looks a learner up by email or username. Exactly one match is required: no guessing. */
function useFindLearner() {
  return useMutation<Lookup, Error, string>({
    mutationFn: async (query) => {
      const value = query.trim();
      const filters = learnerQueryKind(value) === 'email' ? { email: value } : { userName: value };
      const res = await userManagementService.findUsers(filters);
      const content = (res.data?.response?.content ?? []) as FoundUserWire[];
      const users = content.map(toFoundUser).filter((u): u is FoundUser => Boolean(u));
      if (users.length > 1) return { status: 'many' };
      return users[0] ? { status: 'found', user: users[0] } : { status: 'none' };
    },
  });
}

interface AssignRoleFormProps {
  frameworkId: string;
}

/**
 * Assigns a learner's CURRENT competency role.
 *
 * NOT the same "role" as the Change User Roles tab next door. That one sets PLATFORM PERMISSIONS
 * (ORG_ADMIN, CONTENT_CREATOR); this sets the JOB ROLE a learner is measured against - Staff Nurse
 * (ICU), Nursing Officer. Two unrelated concepts one click apart, so the wording here is explicit.
 *
 * Current role is deliberately admin-only: it states what someone is accountable for today, and an
 * organisation cannot report "42% of our ICU nurses are ready" if nurses declare it themselves. A
 * learner's TARGET role stays theirs to choose, and is left untouched by this.
 *
 * The role list is the learner-facing framework read, so it offers LIVE roles only.
 *
 * The learner can be given by Sunbird user ID, email or username. An email or username is looked
 * up first, and the match is shown, so the admin sees who they are assigning before they do.
 */
export function AssignRoleForm({ frameworkId }: AssignRoleFormProps) {
  const { t } = useAppI18n();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const { metas } = useSkillFrameworks(frameworkId ? [frameworkId] : []);
  const assign = useAssignRole();
  const find = useFindLearner();

  const isId = learnerQueryKind(query) === 'id';
  const found = find.data?.status === 'found' ? find.data.user : undefined;
  // A typed ID is used as is; an email or username only once it has been looked up.
  const userId = isId ? query.trim() : found?.id ?? '';

  const meta = metas[frameworkId];
  const roles = meta?.roleCodes ?? [];
  const roleName = (code: string) => meta?.roleNames?.[code] ?? code;
  const canSubmit = Boolean(userId && frameworkId && role) && !assign.isPending;
  // A result describes the request that was sent, so editing the form clears it.
  const edit = (apply: () => void) => {
    apply();
    if (!assign.isIdle) assign.reset();
  };

  return (
    <div className="flex flex-col gap-4" data-testid="competency-role-assign-form">
      <p className="text-sm text-sunbird-gray-75">{t('userManagement.competencyRole.intro')}</p>

      <label className="flex flex-col gap-1 text-sm">
        {t('userManagement.competencyRole.userId')}
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-sunbird-gray-e5 bg-surface px-3 py-2"
            value={query}
            onChange={(e) => edit(() => {
              setQuery(e.target.value);
              find.reset();
            })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim() && !isId) find.mutate(query);
            }}
            placeholder={t('userManagement.competencyRole.userIdPlaceholder')}
            data-testid="competency-role-user"
          />
          {!isId && (
            <Button
              variant="outline"
              disabled={!query.trim() || find.isPending}
              onClick={() => find.mutate(query)}
              data-testid="competency-role-find"
            >
              {find.isPending ? t('userManagement.competencyRole.finding') : t('userManagement.competencyRole.find')}
            </Button>
          )}
        </div>
      </label>
      {found && (
        <p className="text-sm text-sunbird-gray-75" data-testid="competency-role-found">
          {t('userManagement.competencyRole.found', { user: found.label })}
        </p>
      )}
      {(find.data?.status === 'none' || find.data?.status === 'many' || find.isError) && (
        <p className="text-sm text-sunbird-brick" role="alert" data-testid="competency-role-not-found">
          {t(find.data?.status === 'many' ? 'userManagement.competencyRole.manyFound' : 'userManagement.competencyRole.notFound')}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        {t('userManagement.competencyRole.role')}
        <select
          className="rounded-lg border border-sunbird-gray-e5 bg-surface px-3 py-2"
          value={role}
          onChange={(e) => edit(() => setRole(e.target.value))}
          data-testid="competency-role-select"
        >
          <option value="">{t('userManagement.competencyRole.choose')}</option>
          {roles.map((code) => (
            <option key={code} value={code}>{roleName(code)}</option>
          ))}
        </select>
      </label>

      <div>
        <Button
          disabled={!canSubmit}
          onClick={() => assign.mutate({ userId, frameworkId, role })}
          data-testid="competency-role-assign"
        >
          {assign.isPending
            ? t('userManagement.competencyRole.assigning')
            : t('userManagement.competencyRole.assign')}
        </Button>
      </div>

      {assign.isSuccess && assign.variables && (
        <p className="text-sm text-sunbird-green" data-testid="competency-role-done">
          {found
            ? t('userManagement.competencyRole.assignedTo', { role: roleName(assign.variables.role), user: found.label })
            : t('userManagement.competencyRole.assigned', { role: roleName(assign.variables.role) })}
        </p>
      )}
      {assign.isError && (
        <p className="text-sm text-sunbird-brick" data-testid="competency-role-error">
          {t('userManagement.competencyRole.failed')}
        </p>
      )}
    </div>
  );
}
