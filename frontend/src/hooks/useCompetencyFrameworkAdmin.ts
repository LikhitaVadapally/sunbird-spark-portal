import { useMutation, useQuery } from '@tanstack/react-query';
import {
  competencyFrameworkService,
  SKILL_FRAMEWORK_CATEGORIES,
  type CompetencyFrameworkDetails,
  type CreateCompetencyFrameworkInput,
  type FrameworkLevel,
  type TermCommitResult,
  type TermValidationResult,
} from '@/services/CompetencyFrameworkService';

/** Error thrown by the http client; `errCode`/`result` come from the Sunbird response envelope. */
export type FrameworkApiError = Error & { status?: number; errCode?: string; result?: unknown };

export interface FrameworkOption {
  id: string;
  name?: string;
  status?: string;
}

/**
 * Frameworks to offer in the admin pickers: composite search for objectType CompetencyFramework
 * in the admin's channel. An org can have several. A failed search yields an empty list.
 */
export function useCompetencyFrameworkOptions(channel?: string): FrameworkOption[] {
  const query = useQuery({
    queryKey: ['competencyFrameworkList', channel ?? ''],
    queryFn: async () => (await competencyFrameworkService.list(channel)).data?.CompetencyFramework ?? [],
    retry: false,
  });
  return (query.data ?? [])
    .filter((f) => Boolean(f.identifier))
    .map((f) => ({ id: f.identifier, name: f.name, status: f.status }));
}

export function useReadCompetencyFramework() {
  return useMutation<CompetencyFrameworkDetails, FrameworkApiError, string>({
    mutationFn: async (id) => {
      const framework = (await competencyFrameworkService.read(id)).data?.framework;
      return { ...framework, identifier: framework?.identifier ?? id };
    },
  });
}

export type CreateFrameworkVars = CreateCompetencyFrameworkInput & {
  /** Levels top to bottom; the last one holds the skills. Defaults to SKILL_FRAMEWORK_CATEGORIES. */
  levels?: readonly FrameworkLevel[];
};

const skipDuplicate = (e: FrameworkApiError) => {
  if (e?.errCode !== 'ERR_DUPLICATE_CODE') throw e;
};

/**
 * Attaches one level. A level no framework has used yet isn't a Knowlg master category, so the
 * attach answers ERR_CATEGORY_NOT_FOUND: create the master category, then attach again.
 */
async function attachLevel(frameworkId: string, level: FrameworkLevel): Promise<void> {
  try {
    await competencyFrameworkService.attachCategory(frameworkId, level);
  } catch (e) {
    const err = e as FrameworkApiError;
    if (err?.errCode === 'ERR_DUPLICATE_CODE') return;
    if (err?.errCode !== 'ERR_CATEGORY_NOT_FOUND') throw err;
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
      const id = (await competencyFrameworkService.create(input)).data?.node_id ?? input.code;
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
