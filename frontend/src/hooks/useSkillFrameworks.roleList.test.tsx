import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSkillFrameworks, useSkillLabels, useSkillVocabularies } from './useSkillProfile';
import { useFrameworkLeaves } from './useFrameworkLeaves';
import { skillService } from '@/services/skill';
import { CompetencyFrameworkService } from '@/services/CompetencyFrameworkService';

// lern's role/list answers 404 when a framework has no roles yet; that must read as "no roles".
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

const httpError = (status: number) => Object.assign(new Error(`Request failed (${status})`), { status });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useSkillFrameworks with role/list', () => {
  it('reads roles and role names', async () => {
    vi.spyOn(skillService, 'roleList').mockResolvedValue({
      data: { frameworkId: 'fw', roles: { nurse: ['dose'] }, roleNames: { nurse: 'Nurse' } },
      status: 200,
      headers: {},
    } as never);
    const { result } = renderHook(() => useSkillFrameworks(['fw']), { wrapper });
    await waitFor(() => expect(result.current.metas.fw).toBeDefined());
    expect(result.current.metas.fw?.roleCodes).toEqual(['nurse']);
    expect(result.current.metas.fw?.roleNames).toEqual({ nurse: 'Nurse' });
  });

  it('treats a 404 as a framework with no roles', async () => {
    vi.spyOn(skillService, 'roleList').mockRejectedValue(httpError(404));
    const { result } = renderHook(() => useSkillFrameworks(['fw']), { wrapper });
    await waitFor(() => expect(result.current.metas.fw).toBeDefined());
    expect(result.current.metas.fw?.roleCodes).toEqual([]);
    expect(result.current.metas.fw?.roles).toEqual({});
  });

  // Regression: with no stale time every mount and window focus refetched role/list.
  it('reads role/list once for several mounts and a window focus', async () => {
    const roleList = vi.spyOn(skillService, 'roleList').mockResolvedValue({
      data: { frameworkId: 'fw', roles: {}, roleNames: {} }, status: 200, headers: {},
    } as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const stable = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const first = renderHook(() => useSkillFrameworks(['fw']), { wrapper: stable });
    await waitFor(() => expect(first.result.current.metas.fw).toBeDefined());
    const second = renderHook(() => useSkillFrameworks(['fw']), { wrapper: stable });
    await waitFor(() => expect(second.result.current.metas.fw).toBeDefined());
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 20));
    expect(roleList).toHaveBeenCalledTimes(1);
  });

  it('still fails on other errors', async () => {
    vi.spyOn(skillService, 'roleList').mockRejectedValue(httpError(500));
    const { result } = renderHook(() => useSkillFrameworks(['fw']), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.metas.fw).toBeUndefined();
  });
});

const competencyTree = {
  framework: {
    categories: [
      { code: 'competency', index: 1, terms: [{ identifier: 'c1', code: 'comp', name: 'Comp', category: 'competency', associations: [{ identifier: 's1', category: 'skill' }] }] },
      { code: 'skill', index: 2, terms: [{ identifier: 's1', code: 'hmis', name: 'HMIS Reporting', category: 'skill' }] },
    ],
  },
};
const competencyRead = () =>
  vi.spyOn(CompetencyFrameworkService.prototype, 'read').mockResolvedValue({ data: competencyTree, status: 200, headers: {} } as never);

describe('useSkillVocabularies', () => {
  it('reads names from the competency framework read', async () => {
    competencyRead();
    const { result } = renderHook(() => useSkillVocabularies(['fw']), { wrapper });
    await waitFor(() => expect(result.current.vocabularies.fw).toBeDefined());
    expect(result.current.vocabularies.fw?.labels.hmis).toBe('HMIS Reporting');
    expect(result.current.vocabularies.fw?.skillField).toBe('skill');
  });

  it('settles when a framework is not a competency framework, and names fall back to the code', async () => {
    vi.spyOn(CompetencyFrameworkService.prototype, 'read').mockRejectedValue(httpError(404));
    const { result } = renderHook(() => useSkillLabels(['USF']), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.labelOf('dv', 'USF')).toEqual({ name: 'Dv', resolved: false });
  });

  it('keeps the same vocabularies object across re-renders once loaded', async () => {
    competencyRead();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const stable = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, rerender } = renderHook(() => useSkillVocabularies(['fw']), { wrapper: stable });
    await waitFor(() => expect(result.current.vocabularies.fw).toBeDefined());
    const first = result.current.vocabularies;
    rerender();
    rerender();
    // A new object per render would re-run every memo keyed on it (names, path skills, My Skills).
    expect(result.current.vocabularies).toBe(first);
  });

  it('reads a competency framework once for both skill names and the role editor', async () => {
    const read = competencyRead();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const stable = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(
      () => ({ names: useSkillVocabularies(['fw']), leaves: useFrameworkLeaves('fw') }),
      { wrapper: stable },
    );
    await waitFor(() => expect(result.current.names.vocabularies.fw).toBeDefined());
    await waitFor(() => expect(result.current.leaves.isLoaded).toBe(true));
    expect(result.current.leaves.leaves).toEqual(['hmis']);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
