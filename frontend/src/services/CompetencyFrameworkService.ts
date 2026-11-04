import { getClient, ApiResponse } from '../lib/http-client';

/**
 * Admin client for authoring a competency (skill) framework through the Knowlg taxonomy
 * service. Proxied through the backend at `/portal/...`, which forwards to Kong, the same way
 * `FrameworkService` reaches `/framework/v1/read`. The backend additionally restricts every
 * write route here to ORG_ADMIN (see `backend/src/routes/portalProxyRoutes.ts`).
 *
 * Source of truth for the shapes below (Knowlg `feat/competency-framework`):
 *   taxonomy-service/conf/routes
 *   taxonomy-controllers/.../v3/CompetencyFrameworkController.scala + FrameworkControllerBase.scala
 *   taxonomy-controllers/.../v3/FrameworkTermController.scala
 *   taxonomy-actors/.../managers/TermBulkManager.scala, TermSheetReader.scala, TermSheetClassifier.scala
 *
 *   POST  /competency-framework/v3/create              { request: { competencyFramework: {...} } }
 *   GET   /competency-framework/v3/read/:id            -> result.framework
 *   POST  /competency-framework/v3/publish/:id         channel comes from X-Channel-Id
 *   POST  /framework/v1/category/create?framework=  attach a master category (knowledge-mw -> Knowlg)
 *   POST  /composite/v1/search                         objectType CompetencyFramework -> result.CompetencyFramework
 *   GET   /framework/v3/term/download/:framework       -> result.fileUrl (a cloud-storage CSV link)
 *   POST  /framework/v3/term/validate                  multipart: framework + file (dry run)
 *   POST  /framework/v3/term/commit                    multipart: framework + file (writes)
 *
 * Not wired: PATCH /competency-framework/v3/update/:id and the review/reject transitions.
 * Publish works straight from Draft, so the review step is left out until a reviewer flow is
 * designed; add `review`/`reject` here when it is.
 */
const COMPETENCY_FRAMEWORK = '/competency-framework/v3';
const FRAMEWORK = '/framework/v3';

/** The exact columns TermSheetReader.REQUIRED_HEADERS expects, in download order. */
export const TERM_SHEET_HEADERS = ['Category', 'Name', 'Code', 'Associated Terms', 'Description'] as const;

/**
 * Levels a new skill framework gets, top to bottom. Each must exist as a Knowlg master category;
 * a term sheet row is rejected ("Category ... is not attached") unless its category is attached.
 */
export const SKILL_FRAMEWORK_CATEGORIES = [
  { code: 'competencyarea', name: 'Competency Area' },
  { code: 'competency', name: 'Competency' },
  { code: 'skill', name: 'Skill' },
] as const;

/** Statuses during which Knowlg rejects term validate/commit (FrameworkManager.assertFrameworkEditable). */
export const FRAMEWORK_EDIT_BLOCKED_STATUSES = ['Review', 'Processing'];

export interface CompetencyFrameworkDetails {
  identifier: string;
  name?: string;
  code?: string;
  description?: string;
  channel?: string;
  status?: string;
  categories?: Array<{ code?: string; name?: string; terms?: unknown[] }>;
  [key: string]: unknown;
}

export interface CreateCompetencyFrameworkInput {
  name: string;
  code: string;
  channel: string;
  description?: string;
}

export interface TermIssue {
  code: string;
  msg: string;
}

/** One row of a validate/commit report. Only rows with an error or a warning are returned. */
export interface TermRowOutcome {
  /** 0-based position among the sheet's non-blank data rows (blank rows are not counted). */
  index: number;
  rowType: 'create' | 'update';
  category: string;
  code: string;
  /** "OK" | "FAILED" on validate; "SUCCESS" | "FAILED" on commit. */
  status: string;
  errCode?: string;
  errMsg?: string;
  warnings?: TermIssue[];
  termStatus?: string;
}

export interface TermValidationSummary {
  toCreate: number;
  toUpdate: number;
  toUpdateLive: number;
  /** Updates to terms still in Draft/Review. */
  toUpdateDraft: number;
  toRetire: number;
  errors: number;
  warnings: number;
}

export interface TermValidationResult {
  valid: boolean;
  summary: TermValidationSummary;
  rows: TermRowOutcome[];
  fileWarnings?: TermIssue[];
}

export interface TermCommitResult {
  committed: boolean;
  /** On success: created/updated/retired. On failure: errors/warnings. */
  summary: Partial<Record<'created' | 'updated' | 'retired' | 'errors' | 'warnings', number>>;
  rows: TermRowOutcome[];
  fileWarnings?: TermIssue[];
}

export interface TermDownloadResult {
  fileUrl: string;
  ttl?: string;
}

const termSheetForm = (frameworkId: string, file: File): FormData => {
  const form = new FormData();
  form.append('framework', frameworkId);
  form.append('file', file, file.name);
  return form;
};

export class CompetencyFrameworkService {
  public create(input: CreateCompetencyFrameworkInput): Promise<ApiResponse<{ node_id: string; versionKey?: string }>> {
    return getClient().post(`${COMPETENCY_FRAMEWORK}/create`, { request: { competencyFramework: input } });
  }

  /** Attaches a master category to the framework (creates the framework's own category instance). */
  public attachCategory(frameworkId: string, category: { code: string; name: string }): Promise<ApiResponse<{ identifier?: string }>> {
    return getClient().post(`/framework/v1/category/create?framework=${encodeURIComponent(frameworkId)}`, {
      request: { category },
    });
  }

  public read(frameworkId: string): Promise<ApiResponse<{ framework: CompetencyFrameworkDetails }>> {
    return getClient().get(`${COMPETENCY_FRAMEWORK}/read/${encodeURIComponent(frameworkId)}`);
  }

  public publish(frameworkId: string): Promise<ApiResponse<{ identifier?: string; status?: string; version?: number }>> {
    return getClient().post(`${COMPETENCY_FRAMEWORK}/publish/${encodeURIComponent(frameworkId)}`, { request: {} });
  }

  /**
   * Lists competency frameworks via composite search (not `/framework/v3/list`, per Knowlg).
   * Drafts are included so a newly created framework can still be opened and published.
   * Scoped to the admin's channel when known, so other tenants' and stray test frameworks
   * don't crowd the picker.
   */
  public list(channel?: string): Promise<ApiResponse<{ count?: number; CompetencyFramework?: CompetencyFrameworkDetails[] }>> {
    return getClient().post('/composite/v1/search', {
      request: {
        filters: {
          objectType: ['CompetencyFramework'],
          status: ['Draft', 'Live'],
          ...(channel ? { channel: [channel] } : {}),
        },
        fields: ['identifier', 'name', 'status', 'channel'],
        limit: 100,
        offset: 0,
        query: '',
        sort_by: { lastUpdatedOn: 'desc' },
      },
    });
  }

  public downloadTerms(frameworkId: string): Promise<ApiResponse<TermDownloadResult>> {
    return getClient().get(`${FRAMEWORK}/term/download/${encodeURIComponent(frameworkId)}`);
  }

  /** Dry run: classifies every row against the live framework. Nothing is written. */
  public validateTerms(frameworkId: string, file: File): Promise<ApiResponse<TermValidationResult>> {
    return getClient().post(`${FRAMEWORK}/term/validate`, termSheetForm(frameworkId, file));
  }

  /**
   * Writes the sheet. Every active term in a category the sheet mentions, but whose code is
   * absent from the sheet, is RETIRED - omission is the signal; there is no retire column.
   */
  public commitTerms(frameworkId: string, file: File): Promise<ApiResponse<TermCommitResult>> {
    return getClient().post(`${FRAMEWORK}/term/commit`, termSheetForm(frameworkId, file));
  }
}

export const competencyFrameworkService = new CompetencyFrameworkService();

/** A header-only CSV in the format the bulk upload expects, for authoring from scratch. */
export const buildBlankTermSheet = (): string => `${TERM_SHEET_HEADERS.join(',')}\n`;
