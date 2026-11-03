import { getClient, ApiResponse } from '../../lib/http-client';
import type {
  SkillProfileResponse,
  SkillGapResponse,
  RecommendResponse,
  CompetencyFrameworkResponse,
  RoleReadResponse,
  RoleUpsertRequest,
  RoleWriteResponse,
} from '../../types/skillServiceTypes';

/**
 * Thin client over the competency framework v2 skill APIs. Proxied through the backend
 * at `/portal/...`, which forwards to Kong, exactly like `services/viewer/ViewerService.ts`.
 *
 * ROUTING: Kong exposes `<SKILL>/...` and rewrites onto the service's own `/v1/skill/...`.
 * The resolved-framework read keeps the `competency` prefix because it describes the
 * framework rather than a learner.
 *
 *   POST /skill/v1/profile/read
 *   POST /skill/v1/gap/read
 *   POST /skill/v1/recommend
 *   POST /skill/v1/role/update
 *   GET  /competency/v1/framework/read/:frameworkId
 *   POST /competency/v1/role/{assign,read,upsert,retire}   (admin only, checked by lern)
 *
 * `/skill/v1/coverage/read` also exists but is authoring-time, not learner-facing, so it
 * is not wired here. The `/private/*` admin routes are deliberately absent: the
 * interceptor skips token validation for any path containing "private", so routing them
 * through a learner-facing client would be wrong.
 *
 * NO userId IN THE BODY - every learner-facing operation reads the user from the token.
 */
const SKILL = '/skill/v1';
const COMPETENCY = '/competency/v1';

export class SkillService {
  /** The learner's held skills. `evidence: true` expands what proved each one. */
  public profileRead(options?: { evidence?: boolean }): Promise<ApiResponse<SkillProfileResponse>> {
    return getClient().post<SkillProfileResponse>(`${SKILL}/profile/read`, {
      request: { evidence: options?.evidence ?? false },
    });
  }

  /**
   * Readiness against the learner's current role AND each target role.
   *
   * Passing `role` explicitly overrides both and returns that single role as `current` -
   * which is how a learner previews a role they have not saved as a target.
   */
  public gapRead(request?: { frameworkId?: string; role?: string }): Promise<ApiResponse<SkillGapResponse>> {
    return getClient().post<SkillGapResponse>(`${SKILL}/gap/read`, { request: request ?? {} });
  }

  /** Outstanding skills plus the courses and paths that close them, best first. */
  public recommend(request?: { frameworkId?: string; role?: string }): Promise<ApiResponse<RecommendResponse>> {
    return getClient().post<RecommendResponse>(`${SKILL}/recommend`, { request: request ?? {} });
  }

  /**
   * Saves the learner's target roles.
   *
   * `currentRole` is dropped server-side on this route by design - who a learner reports
   * as is an assignment from an HR feed, not a preference - so only targets are settable.
   */
  public updateTargetRoles(request: {
    frameworkId: string;
    targetRoles: string[];
  }): Promise<ApiResponse<unknown>> {
    return getClient().post(`${SKILL}/role/update`, { request });
  }

  /** Resolved framework: tier labels, the flat leaf list, and each role's required set. */
  public frameworkRead(frameworkId: string): Promise<ApiResponse<CompetencyFrameworkResponse>> {
    return getClient().get<CompetencyFrameworkResponse>(
      `${COMPETENCY}/framework/read/${encodeURIComponent(frameworkId)}`
    );
  }

  /**
   * Admin assigns a learner's CURRENT role.
   *
   * The only competency write that names another user: `assignUserId` is explicit in the body,
   * because every learner-facing endpoint deliberately takes the user from the token instead.
   */
  public assignRole(request: {
    assignUserId: string;
    frameworkId: string;
    role: string;
  }): Promise<ApiResponse<unknown>> {
    return getClient().post(`${COMPETENCY}/role/assign`, { request });
  }

  // ---- role authoring (admin; lern rejects non-admin tokens) --------------------------------

  /** Roles as authored, RETIRED included - unlike `frameworkRead`, which serves learners. */
  public roleRead(request: { frameworkId: string }): Promise<ApiResponse<RoleReadResponse>> {
    return getClient().post<RoleReadResponse>(`${COMPETENCY}/role/read`, { request });
  }

  /** Creates or replaces a role. `skills` is the FULL set; omitted skills are removed. */
  public roleUpsert(request: RoleUpsertRequest): Promise<ApiResponse<RoleWriteResponse>> {
    return getClient().post<RoleWriteResponse>(`${COMPETENCY}/role/upsert`, { request });
  }

  /** Retires a role. Not a delete: learners holding it keep it. */
  public roleRetire(request: { frameworkId: string; roleId: string }): Promise<ApiResponse<RoleWriteResponse>> {
    return getClient().post<RoleWriteResponse>(`${COMPETENCY}/role/retire`, { request });
  }
}
