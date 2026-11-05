/**
 * Wire and view types for the competency framework v2 skill APIs
 * (`/v1/skill/*`, Kong-fronted as `/skill/v1/*`).
 *
 * THE MODEL IS BINARY. A skill is held or it is not - there is no proficiency scale,
 * no level, no expiry and no status column. "Not held" is the absence of a record.
 * Anything level-shaped belongs to the superseded v1 model.
 *
 * WHO THE RESPONSE IS ABOUT: every learner-facing endpoint takes the user id from the
 * auth token, never the body, so requests must NOT carry a `userId`.
 *
 * ENVELOPE: `AxiosAdapter.mapResponse` strips `result` before a caller sees the body,
 * so the unwrapped form is what actually arrives. Every response type below accepts
 * both shapes - reading `result.x` when the adapter already unwrapped it silently
 * yielded empty data twice during the v1 work.
 */

// ---- wire: profile ---------------------------------------------------------------------------

export interface SkillEvidenceWire {
  evidenceId?: string;
  sourceType?: string;
  sourceId?: string;
  score?: number;
  maxScore?: number;
  issuerId?: string;
  occurredOn?: string;
  revoked?: boolean;
}

export interface HeldSkillWire {
  skillId?: string;
  frameworkId?: string;
  sourceType?: string;
  attainedOn?: string;
  /** Present only when the request asked for `evidence: true`. */
  evidence?: SkillEvidenceWire[];
}

export interface SkillProfileBody {
  skills?: HeldSkillWire[];
  count?: number;
}
export interface SkillProfileResponse extends SkillProfileBody {
  result?: SkillProfileBody;
}

// ---- wire: gap -------------------------------------------------------------------------------

export interface GapRowWire {
  skillId?: string;
  /** MET | MISSING - a set difference, with no level comparison. */
  status?: string;
}

export interface RoleGapWire {
  role?: string;
  /** False when the role cannot be measured: it does not exist, or requires no skills. */
  resolved?: boolean;
  /** Null when `resolved` is false - never a 0 or a 100 the client would show. */
  readiness?: number | null;
  required?: number;
  met?: number;
  gap?: GapRowWire[];
  outstanding?: string[];
}

export interface SkillGapBody {
  frameworkId?: string;
  /** Null when the learner has no current role on record - an HR assignment, not a choice. */
  current?: RoleGapWire | null;
  targets?: RoleGapWire[];
}
export interface SkillGapResponse extends SkillGapBody {
  result?: SkillGapBody;
}

// ---- wire: recommend -------------------------------------------------------------------------

export interface CandidateWire {
  identifier?: string;
  name?: string;
  primaryCategory?: string;
  skills?: string[];
  gapCovered?: number;
  alreadyHeld?: number;
  totalSkills?: number;
}

export interface RecommendBody {
  /** Outstanding skill codes for the role. */
  skills?: string[];
  candidates?: CandidateWire[];
  role?: string;
  frameworkId?: string;
}
export interface RecommendResponse extends RecommendBody {
  result?: RecommendBody;
}

// ---- wire: resolved competency framework -----------------------------------------------------

export interface CompetencyFrameworkBody {
  frameworkId?: string;
  /** Display names for each tier, e.g. ["Competency area", "Competency", "Skill"]. */
  tierLabels?: string[];
  depth?: number;
  /** FLAT list of leaf codes. The tree itself is not returned - see skillTree.ts. */
  leafSkills?: string[];
  leafCount?: number;
  /** role code -> its required leaf skills. */
  roles?: Record<string, string[]>;
  /** role code -> authored display name. Codes are not display strings. */
  roleNames?: Record<string, string>;
}
export interface CompetencyFrameworkResponse extends CompetencyFrameworkBody {
  result?: CompetencyFrameworkBody;
}

// ---- wire: role authoring (admin) ------------------------------------------------------------

export const ROLE_STATUS = { live: 'LIVE', retired: 'RETIRED' } as const;
export type RoleStatus = (typeof ROLE_STATUS)[keyof typeof ROLE_STATUS];

/** A role as authored in lern's `role_skill`, RETIRED included. */
export interface AuthoredRole {
  roleId: string;
  name: string;
  /** The full set of leaf skill codes the role requires. */
  skills: string[];
  skillCount: number;
  status: RoleStatus;
  version: number;
}

/** A role row as lern sends it; `status` is any string until normalised. */
export type AuthoredRoleWire = Partial<Omit<AuthoredRole, 'status'>> & { status?: string };

export interface RoleReadBody {
  frameworkId?: string;
  roles?: AuthoredRoleWire[];
  count?: number;
}
export interface RoleReadResponse extends RoleReadBody {
  result?: RoleReadBody;
}

/** What an upsert or retire changed. `rejected` = codes dropped because they are not leaves. */
export interface RoleDiff {
  roleId: string;
  added: string[];
  removed: string[];
  unchanged: string[];
  rejected: string[];
  changed: boolean;
  retired?: boolean;
}

export interface RoleWriteBody {
  frameworkId?: string;
  diff?: Partial<RoleDiff>;
}
export interface RoleWriteResponse extends RoleWriteBody {
  result?: RoleWriteBody;
}

export interface RoleUpsertRequest {
  frameworkId: string;
  roleId: string;
  name: string;
  /** FULL set: anything left out is removed from the role. */
  skills: string[];
  /** Brings a RETIRED role back to LIVE. */
  reactivate?: boolean;
}

// ---- view types ------------------------------------------------------------------------------

export const GAP_STATUS = { met: 'MET', missing: 'MISSING' } as const;

export interface SkillEvidence {
  evidenceId: string;
  sourceType: string;
  sourceId: string;
  /** Display name of the source (a course's name), when the client knows it. */
  sourceName?: string;
  /** The enrolled Learning Path the source sits in, when it does. */
  sourcePath?: { pathId: string; contextId?: string; pathName: string };
  score?: number;
  maxScore?: number;
  issuerId?: string;
  occurredOn?: number;
  revoked: boolean;
}

/** A skill the learner holds. There is no level: presence in the profile IS the claim. */
export interface HeldSkill {
  skillId: string;
  frameworkId: string;
  sourceType: string;
  attainedOn?: number;
  evidence: SkillEvidence[];
}

export interface RoleGap {
  role: string;
  /**
   * False when the service could not measure the role (unknown, or requires nothing). Such a role
   * has no readiness to show, which is not the same as 0%.
   */
  measurable: boolean;
  readiness: number;
  required: number;
  met: number;
  /** Skill codes still to earn. */
  outstanding: string[];
  /** Skill codes of the role the learner already holds, so the score can be explained. */
  held: string[];
}

export interface SkillGap {
  frameworkId: string;
  /** Undefined when no current role is assigned - distinct from a role with 0% readiness. */
  current?: RoleGap;
  targets: RoleGap[];
  /**
   * False when the service could not resolve a framework at all, which it reports as an
   * empty response. That is "unknown", not "0% ready", and must never render as a score.
   */
  resolved: boolean;
}

export interface RankedCandidate {
  identifier: string;
  name: string;
  primaryCategory: string;
  skills: string[];
  gapCovered: number;
  alreadyHeld: number;
  totalSkills: number;
}

export interface Recommendation {
  role: string;
  frameworkId: string;
  outstanding: string[];
  candidates: RankedCandidate[];
}

export interface CompetencyFrameworkMeta {
  frameworkId: string;
  tierLabels: string[];
  depth: number;
  leafSkills: string[];
  roles: Record<string, string[]>;
  /** role code -> authored display name, so the UI never shows a de-slugged code. */
  roleNames: Record<string, string>;
  /** Role codes that require at least one skill. */
  roleCodes: string[];
}
