import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoleDefinitions } from './RoleDefinitions';
import { useAuthoredRoles, useRetireRole, useUpsertRole } from '@/hooks/useRoleAuthoring';
import { useFrameworkLeaves } from '@/hooks/useFrameworkLeaves';
import type { AuthoredRole } from '@/types/skillServiceTypes';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({ t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k) }),
}));
const toast = vi.fn();
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/useRoleAuthoring', () => ({
  useAuthoredRoles: vi.fn(),
  useRetireRole: vi.fn(),
  useUpsertRole: vi.fn(),
}));
vi.mock('@/hooks/useFrameworkLeaves', () => ({ useFrameworkLeaves: vi.fn() }));
vi.mock('./RoleEditor', () => ({
  RoleEditor: ({ role }: { role?: AuthoredRole }) => <div data-testid="editor">{role?.roleId ?? 'new'}</div>,
}));

const live: AuthoredRole = { roleId: 'nurse', name: 'Nurse', skills: ['a', 'b'], skillCount: 2, status: 'LIVE', version: 3 };
const retired: AuthoredRole = { roleId: 'old', name: 'Old role', skills: ['a', 'gone'], skillCount: 2, status: 'RETIRED', version: 1 };
const retireMutate = vi.fn();
const upsertMutate = vi.fn();

const setRoles = (over: Partial<ReturnType<typeof useAuthoredRoles>> = {}) =>
  vi.mocked(useAuthoredRoles).mockReturnValue({ roles: [live, retired], isLoading: false, isError: false, ...over });
// Skills come from the framework itself (lern's role/list no longer lists them).
const setLeaves = (leaves: string[], isLoaded = true) =>
  vi.mocked(useFrameworkLeaves).mockReturnValue({ leaves, vocabulary: undefined, isLoaded });

beforeEach(() => {
  vi.clearAllMocks();
  setRoles();
  setLeaves(['a', 'b']);
  vi.mocked(useRetireRole).mockReturnValue({ mutate: retireMutate, isPending: false } as unknown as ReturnType<typeof useRetireRole>);
  vi.mocked(useUpsertRole).mockReturnValue({ mutate: upsertMutate, isPending: false } as unknown as ReturnType<typeof useUpsertRole>);
});

const renderDefs = () => render(<RoleDefinitions frameworkId="fw" />);

describe('RoleDefinitions', () => {
  it('lists live roles only until "show retired" is on', () => {
    renderDefs();
    expect(screen.getByTestId('role-row-nurse')).toBeInTheDocument();
    expect(screen.queryByTestId('role-row-old')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByTestId('role-row-old')).toHaveTextContent('userManagement.competencyRole.roles.retiredStatus');
  });

  it('opens the editor to create, and to edit a role', () => {
    renderDefs();
    fireEvent.click(screen.getByTestId('role-new'));
    expect(screen.getByTestId('editor')).toHaveTextContent('new');
    fireEvent.click(screen.getByTestId('role-edit-nurse'));
    expect(screen.getByTestId('editor')).toHaveTextContent('nurse');
  });

  it('retires only after confirming', () => {
    renderDefs();
    fireEvent.click(screen.getByTestId('role-retire-nurse'));
    expect(retireMutate).not.toHaveBeenCalled();
    const confirm = document.querySelector('[data-edataid="confirm-dialog-confirm"]');
    expect(confirm).not.toBeNull();
    fireEvent.click(confirm as Element);
    expect(retireMutate).toHaveBeenCalledWith('nurse', expect.any(Object));
    const opts = retireMutate.mock.calls[0]?.[1] as { onSuccess: () => void; onError: (e: Error) => void };
    opts.onSuccess();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('roles.retired') }));
    opts.onError(new Error('boom'));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'boom', variant: 'destructive' }));
  });

  // Skills that stopped being leaves would make lern reject the whole write, so they are left out.
  it('reactivates with reactivate: true and only the skills still in the framework', () => {
    renderDefs();
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByTestId('role-reactivate-old'));
    expect(upsertMutate).toHaveBeenCalledWith(
      { roleId: 'old', name: 'Old role', skills: ['a'], reactivate: true },
      expect.any(Object)
    );
  });

  it('shows an empty state', () => {
    setRoles({ roles: [] });
    renderDefs();
    expect(screen.getByTestId('role-list-empty')).toBeInTheDocument();
  });

  it('shows a load error and disables New role', () => {
    setRoles({ roles: [], isError: true });
    renderDefs();
    expect(screen.getByTestId('role-list-error')).toBeInTheDocument();
    expect(screen.getByTestId('role-new')).toBeDisabled();
  });

  it('disables New role when the framework has no skills', () => {
    setLeaves([]);
    renderDefs();
    expect(screen.getByText('userManagement.competencyRole.roles.noFrameworkSkills')).toBeInTheDocument();
    expect(screen.getByTestId('role-new')).toBeDisabled();
  });

  it('does not warn about missing skills while the framework is still loading', () => {
    setLeaves([], false);
    renderDefs();
    expect(screen.queryByText('userManagement.competencyRole.roles.noFrameworkSkills')).not.toBeInTheDocument();
  });
});
