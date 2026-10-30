import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useValidateTermSheet, useCommitTermSheet, useCompetencyFrameworkOptions } from './useCompetencyFrameworkAdmin';
import { competencyFrameworkService } from '@/services/CompetencyFrameworkService';

vi.mock('@/services/CompetencyFrameworkService', async (orig) => {
  const actual = await orig<typeof import('@/services/CompetencyFrameworkService')>();
  return {
    ...actual,
    competencyFrameworkService: {
      list: vi.fn(),
      validateTerms: vi.fn(),
      commitTerms: vi.fn(),
    },
  };
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

const apiError = (props: Record<string, unknown>) => Object.assign(new Error('One or more rows failed validation'), props);
const file = new File(['x'], 'skills.csv');
const summary = { toCreate: 0, toUpdate: 0, toUpdateLive: 0, toUpdateDraft: 0, toRetire: 0, errors: 1, warnings: 0 };

beforeEach(() => vi.clearAllMocks());

describe('useValidateTermSheet', () => {
  // The 400 for a sheet with bad rows still carries the per-row report; that is what the admin needs.
  it('returns the report carried by a 400 rather than throwing it away', async () => {
    const report = { valid: false, summary, rows: [{ index: 0, rowType: 'create', category: 'skill', code: 'a', status: 'FAILED' }] };
    vi.mocked(competencyFrameworkService.validateTerms).mockRejectedValue(apiError({ status: 400, errCode: 'ERR_VALIDATION_FAILED', result: report }));
    const { result } = renderHook(() => useValidateTermSheet(), { wrapper });
    act(() => result.current.mutate({ frameworkId: 'fw', file }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(report);
  });

  it('surfaces a failure that has no report (bad file, blocked framework) as an error', async () => {
    vi.mocked(competencyFrameworkService.validateTerms).mockRejectedValue(apiError({ status: 400, errCode: 'ERR_FRAMEWORK_REVIEW_IN_PROGRESS' }));
    const { result } = renderHook(() => useValidateTermSheet(), { wrapper });
    act(() => result.current.mutate({ frameworkId: 'fw', file }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.errCode).toBe('ERR_FRAMEWORK_REVIEW_IN_PROGRESS');
  });
});

describe('useCommitTermSheet', () => {
  it('marks a rejected commit as not committed and keeps its error code', async () => {
    vi.mocked(competencyFrameworkService.commitTerms).mockRejectedValue(
      apiError({ status: 400, errCode: 'ERR_COMMIT_FAILED', result: { committed: false, summary: { errors: 1 }, rows: [] } })
    );
    const { result } = renderHook(() => useCommitTermSheet(), { wrapper });
    act(() => result.current.mutate({ frameworkId: 'fw', file }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ committed: false, errCode: 'ERR_COMMIT_FAILED' });
  });
});

describe('useCompetencyFrameworkOptions', () => {
  it('keeps the configured frameworks when the list API returns nothing or fails', async () => {
    vi.mocked(competencyFrameworkService.list).mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useCompetencyFrameworkOptions(['fw_a']), { wrapper });
    await waitFor(() => expect(result.current).toEqual(['fw_a']));
  });

  it('merges listed frameworks without duplicates', async () => {
    vi.mocked(competencyFrameworkService.list).mockResolvedValue({
      data: { frameworks: [{ identifier: 'fw_a' }, { identifier: 'fw_b' }] }, status: 200, headers: {},
    });
    const { result } = renderHook(() => useCompetencyFrameworkOptions(['fw_a']), { wrapper });
    await waitFor(() => expect(result.current).toEqual(['fw_a', 'fw_b']));
  });
});
