import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoleEditor } from './RoleEditor';
import { useUpsertRole } from '@/hooks/useRoleAuthoring';
import type { AuthoredRole } from '@/types/skillServiceTypes';
import type { SkillOptionGroup } from '@/services/skill';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({ t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k) }),
}));
const toast = vi.fn();
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/useRoleAuthoring', () => ({ useUpsertRole: vi.fn() }));

const mutate = vi.fn();
const upsertState = (over: Record<string, unknown> = {}) =>
  vi.mocked(useUpsertRole).mockReturnValue({
    mutate, isPending: false, isError: false, error: null, ...over,
  } as unknown as ReturnType<typeof useUpsertRole>);

const groups: SkillOptionGroup[] = [
  { groupCode: 'med', groupName: 'Medication', options: [{ code: 'dose', name: 'Dosage' }, { code: 'admin', name: 'Administering' }] },
  { groupCode: 'care', groupName: 'Patient care', options: [{ code: 'wound', name: 'Wound care' }] },
];
const leafSkills = ['dose', 'admin', 'wound'];
const existing: AuthoredRole[] = [
  { roleId: 'ward-manager', name: 'Ward Manager', skills: ['dose'], skillCount: 1, status: 'RETIRED', version: 2 },
];
const onClose = vi.fn();

const renderEditor = (role?: AuthoredRole) =>
  render(
    <RoleEditor frameworkId="fw" role={role} existingRoles={existing} groups={groups} leafSkills={leafSkills} onClose={onClose} />
  );

beforeEach(() => {
  vi.clearAllMocks();
  upsertState();
});

describe('RoleEditor', () => {
  it('creates a role: code follows the name, and save sends the full skill set', () => {
    renderEditor();
    fireEvent.change(screen.getByTestId('role-editor-name'), { target: { value: 'Staff Nurse (ICU)' } });
    expect(screen.getByTestId('role-editor-code')).toHaveValue('staff-nurse-icu');
    expect(screen.getByTestId('role-editor-save')).toBeDisabled(); // no skills yet
    fireEvent.click(screen.getByLabelText('Dosage'));
    fireEvent.click(screen.getByLabelText('Wound care'));
    fireEvent.click(screen.getByTestId('role-editor-save'));
    expect(mutate).toHaveBeenCalledWith(
      { roleId: 'staff-nurse-icu', name: 'Staff Nurse (ICU)', skills: ['dose', 'wound'] },
      expect.any(Object)
    );
  });

  it('stops following the name once the code is edited by hand', () => {
    renderEditor();
    fireEvent.change(screen.getByTestId('role-editor-code'), { target: { value: 'My Code' } });
    fireEvent.change(screen.getByTestId('role-editor-name'), { target: { value: 'Something else' } });
    expect(screen.getByTestId('role-editor-code')).toHaveValue('my-code');
  });

  // A retired role still owns its code; reusing it would silently overwrite that role.
  it('blocks a code already used, including by a retired role', () => {
    renderEditor();
    fireEvent.change(screen.getByTestId('role-editor-name'), { target: { value: 'Ward Manager' } });
    fireEvent.click(screen.getByLabelText('Dosage'));
    expect(screen.getByTestId('role-editor-code-taken')).toBeInTheDocument();
    expect(screen.getByTestId('role-editor-save')).toBeDisabled();
  });

  it('edits a role: code locked, current skills ticked, stale ones listed and not sent', () => {
    renderEditor({ roleId: 'r1', name: 'Role one', skills: ['dose', 'gone'], skillCount: 2, status: 'LIVE', version: 1 });
    expect(screen.getByTestId('role-editor-code')).toBeDisabled();
    expect(screen.getByTestId('role-skill-stale')).toHaveTextContent('gone');
    expect(screen.getByLabelText('Dosage')).toHaveAttribute('data-state', 'checked');
    fireEvent.click(screen.getByLabelText('Administering'));
    fireEvent.click(screen.getByTestId('role-editor-save'));
    expect(mutate.mock.calls[0]?.[0]).toEqual({ roleId: 'r1', name: 'Role one', skills: ['dose', 'admin'] });
  });

  it('filters skills by search', () => {
    renderEditor();
    fireEvent.change(screen.getByTestId('role-skill-search'), { target: { value: 'wound' } });
    expect(screen.queryByLabelText('Dosage')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Wound care')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('role-skill-search'), { target: { value: 'zzz' } });
    expect(screen.getByText('userManagement.competencyRole.roles.noSkillMatch')).toBeInTheDocument();
  });

  it('toasts the change and closes on success; flags rejected codes', () => {
    renderEditor({ roleId: 'r1', name: 'Role one', skills: ['dose'], skillCount: 1, status: 'LIVE', version: 1 });
    fireEvent.click(screen.getByTestId('role-editor-save'));
    const opts = mutate.mock.calls[0]?.[1] as { onSuccess: (d: unknown) => void };
    opts.onSuccess({ roleId: 'r1', added: ['a'], removed: ['b', 'c'], unchanged: [], rejected: ['x'], changed: true });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('"added":1,"removed":2'),
    }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the dialog open and shows the server message on failure', () => {
    upsertState({ isError: true, error: new Error('Roles with no valid leaf skill') });
    renderEditor();
    expect(screen.getByTestId('role-editor-error')).toHaveTextContent('Roles with no valid leaf skill');
    expect(onClose).not.toHaveBeenCalled();
  });
});
