import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSkillFrameworks, useSkillVocabularies } from './useSkillProfile';
import { skillService } from '@/services/skill';
import { FrameworkService } from '@/services/FrameworkService';
import { CompetencyFrameworkService } from '@/services/CompetencyFrameworkService';

// lern's role/list answers 404 when a framework has no roles yet; that must read as "no roles".
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

const httpError = (status: number) => Object.assign(new Error(`Request failed (${status})`), { status });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(FrameworkService.prototype, 'read').mockResolvedValue({ data: {}, status: 200, headers: {} } as never);
});

describe('useSkillFrameworks with role/list', () => {
  it('reads roles and role names', async () => {
    vi.spyOn(skillService, 'frameworkRead').mockResolvedValue({
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
    vi.spyOn(skillService, 'frameworkRead').mockRejectedValue(httpError(404));
    const { result } = renderHook(() => useSkillFrameworks(['fw']), { wrapper });
    await waitFor(() => expect(result.current.metas.fw).toBeDefined());
    expect(result.current.metas.fw?.roleCodes).toEqual([]);
    expect(result.current.metas.fw?.roles).toEqual({});
  });

  it('still fails on other errors', async () => {
    vi.spyOn(skillService, 'frameworkRead').mockRejectedValue(httpError(500));
    const { result } = renderHook(() => useSkillFrameworks(['fw']), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.metas.fw).toBeUndefined();
  });
});

describe('useSkillVocabularies', () => {
  const competencyTree = {
    framework: {
      categories: [
        { code: 'competency', index: 1, terms: [{ identifier: 'c1', code: 'comp', name: 'Comp', category: 'competency', associations: [{ identifier: 's1', category: 'skill' }] }] },
        { code: 'skill', index: 2, terms: [{ identifier: 's1', code: 'hmis', name: 'HMIS Reporting', category: 'skill' }] },
      ],
    },
  };

  it('falls back to the competency framework read when the taxonomy read 404s', async () => {
    vi.spyOn(FrameworkService.prototype, 'read').mockRejectedValue(httpError(404));
    vi.spyOn(CompetencyFrameworkService.prototype, 'read').mockResolvedValue({ data: competencyTree, status: 200, headers: {} } as never);
    const { result } = renderHook(() => useSkillVocabularies(['fw']), { wrapper });
    await waitFor(() => expect(result.current.vocabularies.fw).toBeDefined());
    expect(result.current.vocabularies.fw?.labels.hmis).toBe('HMIS Reporting');
    expect(result.current.vocabularies.fw?.codeByName['hmis reporting']).toBe('hmis');
  });

  it('does not call the competency read for an older taxonomy framework', async () => {
    const competencyRead = vi.spyOn(CompetencyFrameworkService.prototype, 'read');
    const { result } = renderHook(() => useSkillVocabularies(['fw']), { wrapper });
    await waitFor(() => expect(result.current.vocabularies.fw).toBeDefined());
    expect(competencyRead).not.toHaveBeenCalled();
  });
});
