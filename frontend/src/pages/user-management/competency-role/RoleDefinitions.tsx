import { useMemo, useState } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { SwitchRow } from '@/components/common/Switch';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useFrameworkLeaves } from '@/hooks/useFrameworkLeaves';
import { useAuthoredRoles, useRetireRole, useUpsertRole } from '@/hooks/useRoleAuthoring';
import { groupLeafOptions } from '@/services/skill';
import { ROLE_STATUS, type AuthoredRole } from '@/types/skillServiceTypes';
import { RoleEditor } from './RoleEditor';

interface RoleDefinitionsProps {
  frameworkId: string;
}

type EditorState = { open: false } | { open: true; role?: AuthoredRole };

/**
 * The roles of a framework and the skills each requires. Roles are retired, never deleted:
 * learners and learning paths point at role codes, so a delete would orphan them.
 */
export function RoleDefinitions({ frameworkId }: RoleDefinitionsProps) {
  const { t } = useAppI18n();
  const { toast } = useToast();
  const { roles, isLoading, isError } = useAuthoredRoles(frameworkId);
  // lern's role/list no longer lists the skills, so they (and their names) come from the framework.
  const { leaves: leafSkills, vocabulary, isLoaded: leavesLoaded } = useFrameworkLeaves(frameworkId);
  const retire = useRetireRole(frameworkId);
  const reactivate = useUpsertRole(frameworkId);

  const [showRetired, setShowRetired] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [retireTarget, setRetireTarget] = useState<AuthoredRole | null>(null);

  const groups = useMemo(
    () => groupLeafOptions(leafSkills, vocabulary),
    [leafSkills, vocabulary]
  );
  const shown = showRetired ? roles : roles.filter((r) => r.status === ROLE_STATUS.live);
  const retiredCount = roles.length - roles.filter((r) => r.status === ROLE_STATUS.live).length;
  const noSkills = leavesLoaded && leafSkills.length === 0;

  const failed = (err: Error) =>
    toast({ title: t('userManagement.competencyRole.roles.actionFailed'), description: err.message, variant: 'destructive' });

  const confirmRetire = () => {
    if (!retireTarget) return;
    retire.mutate(retireTarget.roleId, {
      onSuccess: () => {
        toast({ title: t('userManagement.competencyRole.roles.retired', { name: retireTarget.name }) });
        setRetireTarget(null);
      },
      onError: failed,
    });
  };

  const doReactivate = (role: AuthoredRole) =>
    reactivate.mutate(
      { roleId: role.roleId, name: role.name, skills: role.skills.filter((s) => leafSkills.includes(s)), reactivate: true },
      {
        onSuccess: () => toast({ title: t('userManagement.competencyRole.roles.reactivated', { name: role.name }) }),
        onError: failed,
      }
    );

  return (
    <div className="flex flex-col gap-4" data-testid="role-definitions">
      <p className="text-sm text-sunbird-gray-75">{t('userManagement.competencyRole.roles.intro')}</p>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-[14rem]">
          <SwitchRow
            id="role-show-retired"
            checked={showRetired}
            onChange={setShowRetired}
            label={t('userManagement.competencyRole.roles.showRetired', { count: retiredCount })}
          />
        </div>
        <Button onClick={() => setEditor({ open: true })} disabled={noSkills || isError} data-testid="role-new">
          {t('userManagement.competencyRole.roles.new')}
        </Button>
      </div>

      {noSkills && <p className="text-sm text-sunbird-brick">{t('userManagement.competencyRole.roles.noFrameworkSkills')}</p>}
      {isError && (
        <p className="text-sm text-sunbird-brick" data-testid="role-list-error">
          {t('userManagement.competencyRole.roles.loadFailed')}
        </p>
      )}
      {isLoading && <p className="text-sm text-sunbird-gray-75">{t('loading')}</p>}
      {!isLoading && !isError && shown.length === 0 && (
        <p className="text-sm text-sunbird-gray-75" data-testid="role-list-empty">
          {t('userManagement.competencyRole.roles.empty')}
        </p>
      )}

      {shown.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="role-list">
            <thead>
              <tr className="border-b border-sunbird-gray-e5 text-start text-sunbird-gray-75">
                <th className="py-2 text-start font-medium">{t('userManagement.competencyRole.roles.name')}</th>
                <th className="py-2 text-start font-medium">{t('userManagement.competencyRole.roles.code')}</th>
                <th className="py-2 text-start font-medium">{t('userManagement.competencyRole.roles.skills')}</th>
                <th className="py-2 text-start font-medium">{t('userManagement.competencyRole.roles.status')}</th>
                <th className="py-2 text-start font-medium">{t('userManagement.competencyRole.roles.version')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((role) => {
                const live = role.status === ROLE_STATUS.live;
                return (
                  <tr key={role.roleId} className="border-b border-sunbird-gray-e5" data-testid={`role-row-${role.roleId}`}>
                    <td className="py-2 pe-2">{role.name}</td>
                    <td className="py-2 pe-2 text-sunbird-gray-75">{role.roleId}</td>
                    <td className="py-2 pe-2">{role.skillCount}</td>
                    <td className="py-2 pe-2">
                      <Badge variant={live ? 'secondary' : 'outline'}>
                        {t(live ? 'userManagement.competencyRole.roles.live' : 'userManagement.competencyRole.roles.retiredStatus')}
                      </Badge>
                    </td>
                    <td className="py-2 pe-2">{role.version}</td>
                    <td className="py-2 text-end whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setEditor({ open: true, role })} data-testid={`role-edit-${role.roleId}`}>
                        {t('userManagement.competencyRole.roles.edit')}
                      </Button>
                      {live ? (
                        <Button size="sm" variant="ghost" onClick={() => setRetireTarget(role)} data-testid={`role-retire-${role.roleId}`}>
                          {t('userManagement.competencyRole.roles.retire')}
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled={reactivate.isPending} onClick={() => doReactivate(role)} data-testid={`role-reactivate-${role.roleId}`}>
                          {t('userManagement.competencyRole.roles.reactivate')}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editor.open && (
        <RoleEditor
          frameworkId={frameworkId}
          role={editor.role}
          existingRoles={roles}
          groups={groups}
          leafSkills={leafSkills}
          onClose={() => setEditor({ open: false })}
        />
      )}

      <ConfirmDialog
        open={Boolean(retireTarget)}
        onClose={() => !retire.isPending && setRetireTarget(null)}
        onConfirm={confirmRetire}
        title={t('userManagement.competencyRole.roles.retireTitle', { name: retireTarget?.name ?? '' })}
        description={t('userManagement.competencyRole.roles.retireBody')}
        confirmLabel={t('userManagement.competencyRole.roles.retire')}
        confirmVariant="destructive"
        isLoading={retire.isPending}
      />
    </div>
  );
}
