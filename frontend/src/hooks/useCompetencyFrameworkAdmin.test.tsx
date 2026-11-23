import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useValidateTermSheet, useCommitTermSheet, useCompetencyFrameworkOptions, useCreateCompetencyFramework, useRetireCompetencyFramework } from './useCompetencyFrameworkAdmin';
import { competencyFrameworkService } from '@/services/CompetencyFrameworkService';

vi.mock('@/services/CompetencyFrameworkService', async (orig) => {
  const actual = await orig<typeof import('@/services/CompetencyFrameworkService')>();
  return {
    ...actual,
    competencyFrameworkService: {
      list: vi.fn(),
      create: vi.fn(),
      attachCategory: vi.fn(),
      createMasterCategory: vi.fn(),
      validateTerms: vi.fn(),
      commitTerms: vi.fn(),
      retire: vi.fn(),
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
  it('reports a failed search as an error, not as "no frameworks"', async () => {
    vi.mocked(competencyFrameworkService.list).mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useCompetencyFrameworkOptions('ch1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.options).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('maps listed frameworks to id, name and status', async () => {
    vi.mocked(competencyFrameworkService.list).mockResolvedValue({
      data: { CompetencyFramework: [{ identifier: 'fw_a', name: 'Agri', status: 'Live' }, { identifier: 'fw_b' }] }, status: 200, headers: {},
    });
    const { result } = renderHook(() => useCompetencyFrameworkOptions('ch1'), { wrapper });
    await waitFor(() => expect(result.current.options).toEqual([{ id: 'fw_a', name: 'Agri', status: 'Live' }, { id: 'fw_b', name: undefined, status: undefined }]));
    expect(result.current.isLoading).toBe(false);
  });

  // Without a channel the search would return every tenant's frameworks.
  it('does not search until the channel is known, and reports loading meanwhile', () => {
    const { result } = renderHook(() => useCompetencyFrameworkOptions(''), { wrapper });
    expect(competencyFrameworkService.list).not.toHaveBeenCalled();
    expect(result.current).toEqual({ options: [], isLoading: true, isError: false });
  });
});

describe('useCreateCompetencyFramework', () => {
  const input = { name: 'Agri', code: 'fw_agri', channel: 'ch1' };
  const ok = { data: {}, status: 200, headers: {} };

  it('attaches competencyarea, competency and skill in that order after creating', async () => {
    vi.mocked(competencyFrameworkService.create).mockResolvedValue({ data: { node_id: 'fw_agri' }, status: 200, headers: {} });
    vi.mocked(competencyFrameworkService.attachCategory).mockResolvedValue(ok);
    const { result } = renderHook(() => useCreateCompetencyFramework(), { wrapper });
    act(() => result.current.mutate(input));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('fw_agri');
    expect(vi.mocked(competencyFrameworkService.attachCategory).mock.calls.map(([id, c]) => `${id}:${c.code}`)).toEqual([
      'fw_agri:competencyarea', 'fw_agri:competency', 'fw_agri:skill',
    ]);
  });

  it('skips a level that is already attached', async () => {
    vi.mocked(competencyFrameworkService.create).mockResolvedValue({ data: { node_id: 'fw_agri' }, status: 200, headers: {} });
    vi.mocked(competencyFrameworkService.attachCategory)
      .mockRejectedValueOnce(apiError({ status: 400, errCode: 'ERR_DUPLICATE_CODE' }))
      .mockResolvedValue(ok);
    const { result } = renderHook(() => useCreateCompetencyFramework(), { wrapper });
    act(() => result.current.mutate(input));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(competencyFrameworkService.attachCategory).toHaveBeenCalledTimes(3);
  });

  it('fails when a level cannot be attached', async () => {
    vi.mocked(competencyFrameworkService.create).mockResolvedValue({ data: { node_id: 'fw_agri' }, status: 200, headers: {} });
    vi.mocked(competencyFrameworkService.attachCategory).mockRejectedValue(apiError({ status: 400, errCode: 'ERR_FRAMEWORK_NOT_FOUND' }));
    const { result } = renderHook(() => useCreateCompetencyFramework(), { wrapper });
    act(() => result.current.mutate(input));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.errCode).toBe('ERR_FRAMEWORK_NOT_FOUND');
  });

  it('attaches the admin\'s own levels in order and never sends them to the create call', async () => {
    vi.mocked(competencyFrameworkService.create).mockResolvedValue({ data: { node_id: 'fw_cook' }, status: 200, headers: {} });
    vi.mocked(competencyFrameworkService.attachCategory).mockResolvedValue(ok);
    const levels = [{ code: 'technique', name: 'Technique' }, { code: 'cuisine', name: 'Cuisine' }];
    const { result } = renderHook(() => useCreateCompetencyFramework(), { wrapper });
    act(() => result.current.mutate({ ...input, levels }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(competencyFrameworkService.create).toHaveBeenCalledWith(input);
    expect(vi.mocked(competencyFrameworkService.attachCategory).mock.calls.map(([, c]) => c.code)).toEqual(['technique', 'cuisine']);
    expect(competencyFrameworkService.createMasterCategory).not.toHaveBeenCalled();
  });

  // A level no framework has used yet is not a master category until it is created.
  it('creates a missing master category, then attaches it', async () => {
    vi.mocked(competencyFrameworkService.create).mockResolvedValue({ data: { node_id: 'fw_cook' }, status: 200, headers: {} });
    vi.mocked(competencyFrameworkService.attachCategory)
      .mockRejectedValueOnce(apiError({ status: 400, errCode: 'ERR_CATEGORY_NOT_FOUND' }))
      .mockResolvedValue(ok);
    vi.mocked(competencyFrameworkService.createMasterCategory).mockResolvedValue(ok);
    const { result } = renderHook(() => useCreateCompetencyFramework(), { wrapper });
    act(() => result.current.mutate({ ...input, levels: [{ code: 'cuisine', name: 'Cuisine' }] }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(competencyFrameworkService.createMasterCategory).toHaveBeenCalledWith({ code: 'cuisine', name: 'Cuisine' });
    expect(competencyFrameworkService.attachCategory).toHaveBeenCalledTimes(2);
  });

  // knowledge-mw drops Knowlg's error code and answers a missing category with a bare 404.
  it('creates a missing master category when the attach answers a bare 404', async () => {
    vi.mocked(competencyFrameworkService.create).mockResolvedValue({ data: { node_id: 'fw_fe' }, status: 200, headers: {} });
    vi.mocked(competencyFrameworkService.attachCategory)
      .mockRejectedValueOnce(apiError({ status: 404, errCode: undefined }))
      .mockResolvedValue(ok);
    vi.mocked(competencyFrameworkService.createMasterCategory).mockResolvedValue(ok);
    const { result } = renderHook(() => useCreateCompetencyFramework(), { wrapper });
    act(() => result.current.mutate({ ...input, levels: [{ code: 'track', name: 'Track' }] }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(competencyFrameworkService.createMasterCategory).toHaveBeenCalledWith({ code: 'track', name: 'Track' });
    expect(competencyFrameworkService.attachCategory).toHaveBeenCalledTimes(2);
  });

  it('fails when the missing master category cannot be created', async () => {
    vi.mocked(competencyFrameworkService.create).mockResolvedValue({ data: { node_id: 'fw_cook' }, status: 200, headers: {} });
    vi.mocked(competencyFrameworkService.attachCategory).mockRejectedValue(apiError({ status: 400, errCode: 'ERR_CATEGORY_NOT_FOUND' }));
    vi.mocked(competencyFrameworkService.createMasterCategory).mockRejectedValue(apiError({ status: 403, errCode: 'ERR_FORBIDDEN' }));
    const { result } = renderHook(() => useCreateCompetencyFramework(), { wrapper });
    act(() => result.current.mutate({ ...input, levels: [{ code: 'cuisine', name: 'Cuisine' }] }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.errCode).toBe('ERR_FORBIDDEN');
  });
});

describe('useRetireCompetencyFramework', () => {
  it('retires the framework and drops it from the cached lists without a refetch', async () => {
    vi.mocked(competencyFrameworkService.retire).mockResolvedValue({ data: { identifier: 'fw_gone' }, status: 200, headers: {} });
    const client = new QueryClient();
    client.setQueryData(['competencyFrameworkList', 'ch1'], [{ identifier: 'fw_keep' }, { identifier: 'fw_gone' }]);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const own = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useRetireCompetencyFramework(), { wrapper: own });
    act(() => result.current.mutate('fw_gone'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(competencyFrameworkService.retire).toHaveBeenCalledWith('fw_gone');
    expect(client.getQueryData(['competencyFrameworkList', 'ch1'])).toEqual([{ identifier: 'fw_keep' }]);
    expect(invalidate).not.toHaveBeenCalled();
  });

  // Search lags the retire, so a later refetch can still return the framework.
  it('keeps a retired framework out of the options even when search still returns it', async () => {
    vi.mocked(competencyFrameworkService.retire).mockResolvedValue({ data: {}, status: 200, headers: {} });
    vi.mocked(competencyFrameworkService.list).mockResolvedValue({
      data: { CompetencyFramework: [{ identifier: 'fw_keep' }, { identifier: 'fw_stale' }] }, status: 200, headers: {},
    } as never);
    const { result } = renderHook(() => ({ retire: useRetireCompetencyFramework(), opts: useCompetencyFrameworkOptions('ch1') }), { wrapper });
    await waitFor(() => expect(result.current.opts.options).toHaveLength(2));
    act(() => result.current.retire.mutate('fw_stale'));
    await waitFor(() => expect(result.current.opts.options.map((o) => o.id)).toEqual(['fw_keep']));
  });

  it('surfaces a failed retire', async () => {
    vi.mocked(competencyFrameworkService.retire).mockRejectedValue(apiError({ status: 403, errCode: 'ERR_FORBIDDEN' }));
    const { result } = renderHook(() => useRetireCompetencyFramework(), { wrapper });
    act(() => result.current.mutate('fw_a'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.errCode).toBe('ERR_FORBIDDEN');
  });
});
