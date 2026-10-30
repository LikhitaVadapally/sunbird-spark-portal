import { useMutation, useQuery } from '@tanstack/react-query';
import {
  competencyFrameworkService,
  type CompetencyFrameworkDetails,
  type CreateCompetencyFrameworkInput,
  type TermCommitResult,
  type TermValidationResult,
} from '@/services/CompetencyFrameworkService';

/** Error thrown by the http client; `errCode`/`result` come from the Sunbird response envelope. */
export type FrameworkApiError = Error & { status?: number; errCode?: string; result?: unknown };

/**
 * Frameworks to offer in the picker: the deployment's configured ids plus whatever
 * `/framework/v3/list` returns. On the Knowlg branch that route is still a stub that returns
 * nothing, so failures and empty results are tolerated - the configured ids and the free-text
 * field keep the page usable.
 */
export function useCompetencyFrameworkOptions(configuredIds: string[]): string[] {
  const query = useQuery({
    queryKey: ['competencyFrameworkList'],
    queryFn: async () => (await competencyFrameworkService.list()).data?.frameworks ?? [],
    retry: false,
  });
  const listed = (query.data ?? []).map((f) => f.identifier).filter(Boolean);
  return Array.from(new Set([...configuredIds, ...listed]));
}

export function useReadCompetencyFramework() {
  return useMutation<CompetencyFrameworkDetails, FrameworkApiError, string>({
    mutationFn: async (id) => {
      const framework = (await competencyFrameworkService.read(id)).data?.framework;
      return { ...framework, identifier: framework?.identifier ?? id };
    },
  });
}

export function useCreateCompetencyFramework() {
  return useMutation<string, FrameworkApiError, CreateCompetencyFrameworkInput>({
    mutationFn: async (input) => (await competencyFrameworkService.create(input)).data?.node_id ?? input.code,
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
