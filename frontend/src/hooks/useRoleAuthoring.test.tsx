import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthoredRoles, useUpsertRole, useRetireRole } from './useRoleAuthoring';
import { skillService } from '@/services/skill';

vi.mock('@/services/skill', async (orig) => {
  const actual = await orig<typeof import('@/services/skill')>();
  return {
    ...actual,
    skillService: { roleRead: vi.fn(), roleUpsert: vi.fn(), roleRetire: vi.fn() },
  };
});

let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const diff = { roleId: 'r', added: ['a'], removed: [], unchanged: [], rejected: [], changed: true };

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('useAuthoredRoles', () => {
  it('loads the normalised roles of the framework', async () => {
    vi.mocked(skillService.roleRead).mockResolvedValue({
      data: { roles: [{ roleId: 'r', name: 'R', skills: ['a'], status: 'LIVE', version: 1 }] }, status: 200, headers: {},
    });
    const { result } = renderHook(() => useAuthoredRoles('fw'), { wrapper });
    await waitFor(() => expect(result.current.roles).toHaveLength(1));
    expect(skillService.roleRead).toHaveBeenCalledWith({ frameworkId: 'fw' });
  });

  it('does not fetch without a framework', () => {
    renderHook(() => useAuthoredRoles(''), { wrapper });
    expect(skillService.roleRead).not.toHaveBeenCalled();
  });
});

describe('role writes', () => {
  // The Assign dropdown reads the learner-facing framework read, so it must be refreshed too.
  it('upsert returns the diff and refreshes the role list and the framework read', async () => {
    vi.mocked(skillService.roleUpsert).mockResolvedValue({ data: { diff }, status: 200, headers: {} });
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpsertRole('fw'), { wrapper });
    act(() => result.current.mutate({ roleId: 'r', name: 'R', skills: ['a'] }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(diff);
    expect(skillService.roleUpsert).toHaveBeenCalledWith({ roleId: 'r', name: 'R', skills: ['a'], frameworkId: 'fw' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['authoredRoles', 'fw'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['competencyFrameworkV2', 'fw'] });
  });

  it('retire sends the role and refreshes', async () => {
    vi.mocked(skillService.roleRetire).mockResolvedValue({ data: { diff: { ...diff, retired: true } }, status: 200, headers: {} });
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useRetireRole('fw'), { wrapper });
    act(() => result.current.mutate('r'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(skillService.roleRetire).toHaveBeenCalledWith({ frameworkId: 'fw', roleId: 'r' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['authoredRoles', 'fw'] });
  });

  it('does not refresh on failure', async () => {
    vi.mocked(skillService.roleRetire).mockRejectedValue(new Error('nope'));
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useRetireRole('fw'), { wrapper });
    act(() => result.current.mutate('r'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
