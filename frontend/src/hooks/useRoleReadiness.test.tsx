import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSkillGap, useSkillRecommend, useUpdateTargetRoles } from './useRoleReadiness';
import type { SkillGap } from '../types/skillServiceTypes';

const { gapRead, recommend, updateTargetRoles } = vi.hoisted(() => ({
  gapRead: vi.fn(),
  recommend: vi.fn(),
  updateTargetRoles: vi.fn(),
}));

vi.mock('@/services/skill', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/skill')>()),
  skillService: { gapRead, recommend, updateTargetRoles },
}));

let mockUserId: string | null = 'u1';
vi.mock('./useAuthInfo', () => ({ useUserId: () => mockUserId }));

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const gap: SkillGap = {
  frameworkId: 'fw',
  targets: [{ role: 'officer', measurable: true, readiness: 50, required: 2, met: 1, outstanding: ['b'] }],
  resolved: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUserId = 'u1';
});

describe('useSkillGap', () => {
  it('reads readiness without naming a framework, so the service uses the learner own', async () => {
    gapRead.mockResolvedValue({ data: { frameworkId: 'fw', current: null, targets: [] } });
    const { result } = renderHook(() => useSkillGap(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.gap?.frameworkId).toBe('fw'));
    expect(gapRead).toHaveBeenCalledWith();
  });

  it('waits for a signed-in user', () => {
    mockUserId = null;
    renderHook(() => useSkillGap(), { wrapper: wrapper() });
    expect(gapRead).not.toHaveBeenCalled();
  });

  it('surfaces a failed read', async () => {
    gapRead.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useSkillGap(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSkillRecommend', () => {
  it('always names the role it recommends for', async () => {
    recommend.mockResolvedValue({ data: { role: 'officer', skills: ['b'], candidates: [] } });
    const { result } = renderHook(() => useSkillRecommend('fw', 'officer'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.recommendation?.role).toBe('officer'));
    expect(recommend).toHaveBeenCalledWith({ frameworkId: 'fw', role: 'officer' });
  });

  it('does not ask without a role', () => {
    renderHook(() => useSkillRecommend('fw', undefined), { wrapper: wrapper() });
    expect(recommend).not.toHaveBeenCalled();
  });
});

describe('useUpdateTargetRoles', () => {
  // role/update replaces the stored set: dropping the other targets here would erase them.
  it('sends every kept target along with the added one', async () => {
    updateTargetRoles.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useUpdateTargetRoles('fw', gap), { wrapper: wrapper() });
    await act(() => result.current.mutateAsync({ add: 'supervisor' }));
    expect(updateTargetRoles).toHaveBeenCalledWith({ frameworkId: 'fw', targetRoles: ['officer', 'supervisor'] });
  });

  it('sends the remaining targets when one is removed', async () => {
    updateTargetRoles.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useUpdateTargetRoles('fw', gap), { wrapper: wrapper() });
    await act(() => result.current.mutateAsync({ remove: 'officer' }));
    expect(updateTargetRoles).toHaveBeenCalledWith({ frameworkId: 'fw', targetRoles: [] });
  });

  it('refuses to save without a framework', async () => {
    const { result } = renderHook(() => useUpdateTargetRoles(undefined, gap), { wrapper: wrapper() });
    await expect(result.current.mutateAsync({ add: 'x' })).rejects.toThrow();
    expect(updateTargetRoles).not.toHaveBeenCalled();
  });
});
