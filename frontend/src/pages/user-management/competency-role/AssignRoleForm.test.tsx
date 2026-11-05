import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssignRoleForm } from './AssignRoleForm';
import { useSkillFrameworks, useAssignRole } from '@/hooks/useSkillProfile';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({ t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k) }),
}));
vi.mock('@/hooks/useSkillProfile', () => ({
  useSkillFrameworks: vi.fn(),
  useAssignRole: vi.fn(),
}));

const mutate = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useSkillFrameworks).mockReturnValue({
    metas: {
      fw: {
        frameworkId: 'fw', tierLabels: [], depth: 2, leafSkills: [],
        roles: { 'staff-nurse-icu': ['a'], 'nursing-officer': ['a', 'b'] },
        roleNames: { 'staff-nurse-icu': 'Staff Nurse (ICU)', 'nursing-officer': 'Nursing Officer' },
        roleCodes: ['staff-nurse-icu', 'nursing-officer'],
      },
    },
    isLoading: false,
  });
  vi.mocked(useAssignRole).mockReturnValue({
    mutate, isPending: false, isSuccess: false, isError: false,
  } as unknown as ReturnType<typeof useAssignRole>);
});

const renderTab = () => render(<AssignRoleForm frameworkId="fw" />);

describe('AssignRoleForm', () => {
  it('lists roles by their authored name, not the code', () => {
    renderTab();
    expect(screen.getByText('Staff Nurse (ICU)')).toBeInTheDocument();
    expect(screen.queryByText('staff-nurse-icu')).not.toBeInTheDocument();
  });

  it('assigns the chosen role to the entered user', () => {
    renderTab();
    fireEvent.change(screen.getByTestId('competency-role-user'), { target: { value: ' u1 ' } });
    fireEvent.change(screen.getByTestId('competency-role-select'), { target: { value: 'nursing-officer' } });
    fireEvent.click(screen.getByTestId('competency-role-assign'));
    // trimmed: a pasted id often carries whitespace, and the server would 404 on it
    expect(mutate).toHaveBeenCalledWith({ userId: 'u1', frameworkId: 'fw', role: 'nursing-officer' });
  });

  it('cannot submit without both a user and a role', () => {
    renderTab();
    expect(screen.getByTestId('competency-role-assign')).toBeDisabled();
    fireEvent.change(screen.getByTestId('competency-role-user'), { target: { value: 'u1' } });
    expect(screen.getByTestId('competency-role-assign')).toBeDisabled();
  });

  it('reports a failure rather than silently doing nothing', () => {
    vi.mocked(useAssignRole).mockReturnValue({
      mutate, isPending: false, isSuccess: false, isError: true,
    } as unknown as ReturnType<typeof useAssignRole>);
    renderTab();
    expect(screen.getByTestId('competency-role-error')).toBeInTheDocument();
  });
});
