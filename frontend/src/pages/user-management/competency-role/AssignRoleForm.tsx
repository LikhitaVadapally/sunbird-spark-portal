import { useState } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import { Button } from '@/components/common/Button';
import { useSkillFrameworks, useAssignRole } from '@/hooks/useSkillProfile';

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
 */
export function AssignRoleForm({ frameworkId }: AssignRoleFormProps) {
  const { t } = useAppI18n();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('');
  const { metas } = useSkillFrameworks(frameworkId ? [frameworkId] : []);
  const assign = useAssignRole();

  const meta = metas[frameworkId];
  const roles = meta?.roleCodes ?? [];
  const roleName = (code: string) => meta?.roleNames?.[code] ?? code;
  const canSubmit = Boolean(userId.trim() && frameworkId && role) && !assign.isPending;
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
        <input
          className="rounded-lg border border-sunbird-gray-e5 bg-surface px-3 py-2"
          value={userId}
          onChange={(e) => edit(() => setUserId(e.target.value))}
          placeholder={t('userManagement.competencyRole.userIdPlaceholder')}
          data-testid="competency-role-user"
        />
      </label>

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
          onClick={() => assign.mutate({ userId: userId.trim(), frameworkId, role })}
          data-testid="competency-role-assign"
        >
          {assign.isPending
            ? t('userManagement.competencyRole.assigning')
            : t('userManagement.competencyRole.assign')}
        </Button>
      </div>

      {assign.isSuccess && assign.variables && (
        <p className="text-sm text-sunbird-green" data-testid="competency-role-done">
          {t('userManagement.competencyRole.assigned', { role: roleName(assign.variables.role) })}
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
