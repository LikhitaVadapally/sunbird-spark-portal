import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssignRoleForm } from './AssignRoleForm';
import { useSkillFrameworks, useAssignRole } from '@/hooks/useSkillProfile';
import { userManagementService } from '@/services/UserManagementService';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({ t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k) }),
}));
vi.mock('@/hooks/useSkillProfile', () => ({
  useSkillFrameworks: vi.fn(),
  useAssignRole: vi.fn(),
}));
vi.mock('@/services/UserManagementService', () => ({
  userManagementService: { findUsers: vi.fn() },
}));

const ID = '00baafef-f85d-4476-80ac-baf63d2ca7d5';
const searchReturns = (content: unknown[]) =>
  vi.mocked(userManagementService.findUsers).mockResolvedValue({ data: { response: { content } }, status: 200, headers: {} });

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
    mutate, reset: vi.fn(), isIdle: true, isPending: false, isSuccess: false, isError: false,
  } as unknown as ReturnType<typeof useAssignRole>);
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
);
const renderTab = () => render(<AssignRoleForm frameworkId="fw" />, { wrapper });
const typeUser = (value: string) => fireEvent.change(screen.getByTestId('competency-role-user'), { target: { value } });
const chooseRole = () => fireEvent.change(screen.getByTestId('competency-role-select'), { target: { value: 'nursing-officer' } });

describe('AssignRoleForm', () => {
  it('lists roles by their authored name, not the code', () => {
    renderTab();
    expect(screen.getByText('Staff Nurse (ICU)')).toBeInTheDocument();
    expect(screen.queryByText('staff-nurse-icu')).not.toBeInTheDocument();
  });

  it('assigns the chosen role to the entered user', () => {
    renderTab();
    typeUser(` ${ID} `);
    chooseRole();
    fireEvent.click(screen.getByTestId('competency-role-assign'));
    // trimmed: a pasted id often carries whitespace, and the server would 404 on it
    expect(mutate).toHaveBeenCalledWith({ userId: ID, frameworkId: 'fw', role: 'nursing-officer' });
    // An ID is used as is: no lookup, no Find button.
    expect(userManagementService.findUsers).not.toHaveBeenCalled();
    expect(screen.queryByTestId('competency-role-find')).not.toBeInTheDocument();
  });

  it('cannot submit without both a user and a role', () => {
    renderTab();
    expect(screen.getByTestId('competency-role-assign')).toBeDisabled();
    typeUser(ID);
    expect(screen.getByTestId('competency-role-assign')).toBeDisabled();
  });

  it('reports a failure rather than silently doing nothing', () => {
    vi.mocked(useAssignRole).mockReturnValue({
      mutate, reset: vi.fn(), isIdle: false, isPending: false, isSuccess: false, isError: true,
    } as unknown as ReturnType<typeof useAssignRole>);
    renderTab();
    expect(screen.getByTestId('competency-role-error')).toBeInTheDocument();
  });
  it('names the role that was assigned, not the one picked afterwards', () => {
    const reset = vi.fn();
    vi.mocked(useAssignRole).mockReturnValue({
      mutate, reset, isIdle: false, isPending: false, isSuccess: true, isError: false,
      variables: { userId: 'u1', frameworkId: 'fw', role: 'nursing-officer' },
    } as unknown as ReturnType<typeof useAssignRole>);
    renderTab();
    expect(screen.getByTestId('competency-role-done')).toBeInTheDocument();
    typeUser(ID);
    expect(reset).toHaveBeenCalled();
  });

  it('finds a learner by email, shows who it is, then assigns by their user ID', async () => {
    searchReturns([{ id: 'u-7', firstName: 'Asha', lastName: 'Rao', userName: 'asha_1' }]);
    renderTab();
    typeUser(' asha@example.com ');
    chooseRole();
    expect(screen.getByTestId('competency-role-assign')).toBeDisabled();
    fireEvent.click(screen.getByTestId('competency-role-find'));
    await waitFor(() => expect(screen.getByTestId('competency-role-found')).toHaveTextContent('Asha Rao (asha_1)'));
    expect(userManagementService.findUsers).toHaveBeenCalledWith({ email: 'asha@example.com' });
    fireEvent.click(screen.getByTestId('competency-role-assign'));
    expect(mutate).toHaveBeenCalledWith({ userId: 'u-7', frameworkId: 'fw', role: 'nursing-officer' });
  });

  it('finds a learner by username', async () => {
    searchReturns([{ userId: 'u-8', userName: 'ravi_2' }]);
    renderTab();
    typeUser('ravi_2');
    fireEvent.click(screen.getByTestId('competency-role-find'));
    await waitFor(() => expect(screen.getByTestId('competency-role-found')).toHaveTextContent('ravi_2'));
    expect(userManagementService.findUsers).toHaveBeenCalledWith({ userName: 'ravi_2' });
  });

  it('says so when nobody matches, and keeps Assign disabled', async () => {
    searchReturns([]);
    renderTab();
    typeUser('nobody@example.com');
    chooseRole();
    fireEvent.click(screen.getByTestId('competency-role-find'));
    await waitFor(() => expect(screen.getByTestId('competency-role-not-found')).toHaveTextContent('notFound'));
    expect(screen.getByTestId('competency-role-assign')).toBeDisabled();
  });

  it('refuses to guess when more than one user matches', async () => {
    searchReturns([{ id: 'a' }, { id: 'b' }]);
    renderTab();
    typeUser('shared');
    fireEvent.click(screen.getByTestId('competency-role-find'));
    await waitFor(() => expect(screen.getByTestId('competency-role-not-found')).toHaveTextContent('manyFound'));
  });

  it('forgets the match when the learner is edited', async () => {
    searchReturns([{ id: 'u-7', userName: 'asha_1' }]);
    renderTab();
    typeUser('asha_1');
    fireEvent.click(screen.getByTestId('competency-role-find'));
    await waitFor(() => expect(screen.getByTestId('competency-role-found')).toBeInTheDocument());
    typeUser('asha_2');
    expect(screen.queryByTestId('competency-role-found')).not.toBeInTheDocument();
  });
});
