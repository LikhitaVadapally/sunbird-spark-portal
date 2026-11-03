import { useMemo, useState } from 'react';
import { useAppI18n } from '@/hooks/useAppI18n';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/common/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/common/Dialog';
import { useUpsertRole } from '@/hooks/useRoleAuthoring';
import { toRoleCode, type SkillOptionGroup } from '@/services/skill';
import type { AuthoredRole } from '@/types/skillServiceTypes';
import { RoleSkillPicker } from './RoleSkillPicker';

interface RoleEditorProps {
  frameworkId: string;
  /** The role being edited; undefined to create one. */
  role?: AuthoredRole;
  /** Every authored role (retired too), to block a code that is already taken. */
  existingRoles: AuthoredRole[];
  groups: SkillOptionGroup[];
  leafSkills: string[];
  onClose: () => void;
}

/**
 * Create or edit one role. Mounted only while open, so its form state starts fresh each time.
 *
 * The save sends the FULL skill set (lern replaces, never merges). Codes the role holds that are
 * no longer leaves are shown but not sent: lern would reject them anyway.
 */
export function RoleEditor({ frameworkId, role, existingRoles, groups, leafSkills, onClose }: RoleEditorProps) {
  const { t } = useAppI18n();
  const { toast } = useToast();
  const upsert = useUpsertRole(frameworkId);
  const isEdit = Boolean(role);

  const leafSet = useMemo(() => new Set(leafSkills), [leafSkills]);
  const [name, setName] = useState(role?.name ?? '');
  const [code, setCode] = useState(role?.roleId ?? '');
  const [codeTouched, setCodeTouched] = useState(isEdit);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((role?.skills ?? []).filter((s) => leafSet.has(s)))
  );
  const stale = (role?.skills ?? []).filter((s) => !leafSet.has(s));

  const taken = !isEdit && existingRoles.find((r) => r.roleId === code);
  const canSave = Boolean(name.trim() && code && selected.size > 0 && !taken) && !upsert.isPending;

  const onName = (value: string) => {
    setName(value);
    if (!codeTouched) setCode(toRoleCode(value));
  };

  const save = () =>
    upsert.mutate(
      { roleId: code, name: name.trim(), skills: Array.from(selected) },
      {
        onSuccess: (diff) => {
          toast({
            title: t('userManagement.competencyRole.roles.saved', { name: name.trim() }),
            description: t('userManagement.competencyRole.roles.savedDiff', {
              added: diff?.added.length ?? 0,
              removed: diff?.removed.length ?? 0,
            }),
          });
          if (diff?.rejected.length) {
            toast({
              title: t('userManagement.competencyRole.roles.rejected', { skills: diff.rejected.join(', ') }),
              variant: 'destructive',
            });
          }
          onClose();
        },
      }
    );

  return (
    <Dialog open onOpenChange={(open) => !open && !upsert.isPending && onClose()}>
      <DialogContent className="max-w-xl" data-testid="role-editor">
        <DialogHeader>
          <DialogTitle>
            {t(isEdit ? 'userManagement.competencyRole.roles.editTitle' : 'userManagement.competencyRole.roles.newTitle')}
          </DialogTitle>
          <DialogDescription>{t('userManagement.competencyRole.roles.editorHint')}</DialogDescription>
        </DialogHeader>

        <label className="flex flex-col gap-1 text-sm">
          {t('userManagement.competencyRole.roles.name')}
          <input
            className="rounded-lg border border-sunbird-gray-e5 bg-surface px-3 py-2"
            value={name}
            onChange={(e) => onName(e.target.value)}
            data-testid="role-editor-name"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t('userManagement.competencyRole.roles.code')}
          <input
            className="rounded-lg border border-sunbird-gray-e5 bg-surface px-3 py-2 disabled:opacity-60"
            value={code}
            disabled={isEdit}
            onChange={(e) => {
              setCodeTouched(true);
              setCode(toRoleCode(e.target.value));
            }}
            data-testid="role-editor-code"
          />
          {taken && (
            <span className="text-xs text-sunbird-brick" data-testid="role-editor-code-taken">
              {t('userManagement.competencyRole.roles.codeTaken', { name: taken.name })}
            </span>
          )}
        </label>

        <RoleSkillPicker groups={groups} selected={selected} onChange={setSelected} stale={stale} />

        {upsert.isError && (
          <p className="text-sm text-sunbird-brick" role="alert" data-testid="role-editor-error">
            {upsert.error?.message || t('userManagement.competencyRole.roles.saveFailed')}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={upsert.isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={save} disabled={!canSave} data-testid="role-editor-save">
            {upsert.isPending ? t('userManagement.competencyRole.roles.saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
