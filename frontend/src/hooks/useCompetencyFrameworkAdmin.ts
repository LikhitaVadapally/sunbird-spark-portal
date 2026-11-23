import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  competencyFrameworkService,
  SKILL_FRAMEWORK_CATEGORIES,
  type CompetencyFrameworkDetails,
  type CreateCompetencyFrameworkInput,
  type FrameworkLevel,
  type TermCommitResult,
  type TermValidationResult,
} from '@/services/CompetencyFrameworkService';
import type { HttpError } from '@/lib/http-client';

/** Error thrown by the http client; `errCode`/`result` come from the Sunbird response envelope. */
export type FrameworkApiError = HttpError;

export interface FrameworkOption {
  id: string;
  name?: string;
  status?: string;
}

export interface FrameworkOptions {
  options: FrameworkOption[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Frameworks retired in this session. Search updates a few seconds after a retire, so a refetch
 * right after it still returns the framework; these ids are dropped from the lists meanwhile.
 */
const retiredFrameworkIds = new Set<string>();

/**
 * Frameworks to offer in the admin pickers: composite search for objectType CompetencyFramework
 * in the admin's channel. An org can have several. Nothing is fetched until the channel is known:
 * an unscoped search would return every tenant's frameworks.
 */
export function useCompetencyFrameworkOptions(channel: string): FrameworkOptions {
  const query = useQuery({
    queryKey: ['competencyFrameworkList', channel],
    queryFn: async () => (await competencyFrameworkService.list(channel)).data?.CompetencyFramework ?? [],
    enabled: Boolean(channel),
    retry: false,
  });
  const options = (query.data ?? [])
    .filter((f) => Boolean(f.identifier) && !retiredFrameworkIds.has(f.identifier))
    .map((f) => ({ id: f.identifier, name: f.name, status: f.status }));
  // Until the channel is known the query is idle, which still counts as loading for the pickers.
  return { options, isLoading: !channel || query.isLoading, isError: query.isError };
}

export function useReadCompetencyFramework() {
  return useMutation<CompetencyFrameworkDetails, FrameworkApiError, string>({
    mutationFn: async (id) => {
      const framework = (await competencyFrameworkService.read(id)).data?.framework;
      if (!framework) throw new Error(`Framework ${id} not found`);
      return framework;
    },
  });
}

export type CreateFrameworkVars = CreateCompetencyFrameworkInput & {
  /** Levels top to bottom; the last one holds the skills. Defaults to SKILL_FRAMEWORK_CATEGORIES. */
  levels?: readonly FrameworkLevel[];
};

const isDuplicate = (e: unknown) => (e as FrameworkApiError)?.errCode === 'ERR_DUPLICATE_CODE';
const skipDuplicate = (e: unknown) => {
  if (!isDuplicate(e)) throw e;
};

/**
 * The attach found no master category with the level's code. knowledge-mw passes Knowlg's
 * NOT_FOUND on as a bare 404 with no errCode, so the status counts too. The framework was
 * created a moment earlier, so a 404 here can only mean the category.
 */
const isMissingCategory = (e: unknown) => {
  const err = e as FrameworkApiError;
  return err?.errCode === 'ERR_CATEGORY_NOT_FOUND' || err?.status === 404;
};

/**
 * Attaches one level. A level no framework has used yet isn't a Knowlg master category, so the
 * attach fails as missing: create the master category, then attach again.
 */
async function attachLevel(frameworkId: string, level: FrameworkLevel): Promise<void> {
  try {
    await competencyFrameworkService.attachCategory(frameworkId, level);
  } catch (e) {
    if (isDuplicate(e)) return;
    if (!isMissingCategory(e)) throw e;
    await competencyFrameworkService.createMasterCategory(level);
    await competencyFrameworkService.attachCategory(frameworkId, level).catch(skipDuplicate);
  }
}

/**
 * Creates the framework, then attaches its levels one by one, top level first (Knowlg keeps them
 * in attach order). A level that is already attached is skipped, so retrying after a partial
 * failure is safe.
 */
export function useCreateCompetencyFramework() {
  return useMutation<string, FrameworkApiError, CreateFrameworkVars>({
    mutationFn: async ({ levels = SKILL_FRAMEWORK_CATEGORIES, ...input }) => {
      const id = (await competencyFrameworkService.create(input)).data?.node_id;
      if (!id) throw new Error('Framework create returned no identifier');
      for (const level of levels) await attachLevel(id, level);
      return id;
    },
  });
}

export function useDownloadTermSheet() {
  return useMutation<string, FrameworkApiError, string>({
    mutationFn: async (id) => {
      const url = (await competencyFrameworkService.downloadTerms(id)).data?.fileUrl;
      if (!url) throw new Error('No download URL returned');
      return url;
    },
  });
}

type SheetVars = { frameworkId: string; file: File };

/**
 * Validate and commit answer a sheet with errors as HTTP 400 but still carry the per-row report
 * in `result`. That report is the useful part, so it is returned as data rather than thrown;
 * only a failure without a report (bad file type, blocked framework, network) is an error.
 */
const reportFromError = <T>(err: unknown): T => {
  const result = (err as FrameworkApiError)?.result as { summary?: unknown } | undefined;
  if (result && typeof result === 'object' && result.summary) return result as T;
  throw err;
};

export function useValidateTermSheet() {
  return useMutation<TermValidationResult, FrameworkApiError, SheetVars>({
    mutationFn: ({ frameworkId, file }) =>
      competencyFrameworkService
        .validateTerms(frameworkId, file)
        .then((r) => r.data)
        .catch((e) => reportFromError<TermValidationResult>(e)),
  });
}

export function useCommitTermSheet() {
  return useMutation<TermCommitResult & { errCode?: string }, FrameworkApiError, SheetVars>({
    mutationFn: ({ frameworkId, file }) =>
      competencyFrameworkService
        .commitTerms(frameworkId, file)
        .then((r) => r.data)
        .catch((e) => ({ ...reportFromError<TermCommitResult>(e), committed: false, errCode: (e as FrameworkApiError).errCode })),
  });
}

export function usePublishCompetencyFramework() {
  return useMutation<unknown, FrameworkApiError, string>({
    mutationFn: async (id) => (await competencyFrameworkService.publish(id)).data,
  });
}

/**
 * Retires a framework and drops it from the cached framework lists straight away. Not a refetch:
 * search still returns the framework for a few seconds after the retire.
 */
export function useRetireCompetencyFramework() {
  const queryClient = useQueryClient();
  return useMutation<unknown, FrameworkApiError, string>({
    mutationFn: async (id) => (await competencyFrameworkService.retire(id)).data,
    onSuccess: (_data, id) => {
      retiredFrameworkIds.add(id);
      queryClient.setQueriesData<CompetencyFrameworkDetails[]>(
        { queryKey: ['competencyFrameworkList'] },
        (list) => list?.filter((f) => f.identifier !== id),
      );
    },
  });
}
