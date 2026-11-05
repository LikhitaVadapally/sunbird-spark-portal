import {
  GAP_STATUS,
  ROLE_STATUS,
  type AuthoredRole,
  type AuthoredRoleWire,
  type CandidateWire,
  type CompetencyFrameworkMeta,
  type CompetencyFrameworkResponse,
  type HeldSkill,
  type HeldSkillWire,
  type RankedCandidate,
  type Recommendation,
  type RecommendResponse,
  type RoleDiff,
  type RoleGap,
  type RoleGapWire,
  type RoleReadResponse,
  type RoleWriteResponse,
  type SkillEvidence,
  type SkillEvidenceWire,
  type SkillGap,
  type SkillGapResponse,
  type SkillProfileResponse,
} from '../../types/skillServiceTypes';

/** Milliseconds for a wire date, or undefined when absent/unparseable. */
function toEpoch(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

function normaliseEvidence(raw: SkillEvidenceWire[] | undefined): SkillEvidence[] {
  const seen = new Set<string>();
  return (raw ?? [])
    .filter((e): e is SkillEvidenceWire => Boolean(e?.evidenceId))
    // Revoked evidence is excluded: revocation is the only way a skill leaves the
    // profile, so showing a revoked row as proof would contradict the profile itself.
    .filter((e) => e.revoked !== true)
    .map((e) => ({
      evidenceId: e.evidenceId ?? '',
      sourceType: e.sourceType ?? '',
      sourceId: e.sourceId ?? '',
      ...(typeof e.score === 'number' ? { score: e.score } : {}),
      ...(typeof e.maxScore === 'number' ? { maxScore: e.maxScore } : {}),
      ...(e.issuerId ? { issuerId: e.issuerId } : {}),
      ...(toEpoch(e.occurredOn) !== undefined ? { occurredOn: toEpoch(e.occurredOn) } : {}),
      revoked: false,
    }))
    // One row per distinct fact. v2 derives the evidence id from occurredOn + source, so a
    // replay rewrites the same row - but the ledger is still append-only and a re-projection
    // with a different timestamp produced many rows for one fact under v1.
    .filter((e) => {
      const key = [e.sourceType, e.sourceId, e.score ?? '', e.maxScore ?? ''].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Wire -> view for `skill/profile/read`.
 *
 * Every entry present IS a held skill: v2 has no level and no status, so presence is the
 * whole claim. Entries with no `skillId` are dropped - nothing to name or match.
 */
export function normaliseProfile(response: SkillProfileResponse | undefined | null): HeldSkill[] {
  const raw = response?.skills ?? response?.result?.skills ?? [];
  return raw
    .filter((e): e is HeldSkillWire => Boolean(e?.skillId))
    .map((e) => ({
      skillId: e.skillId ?? '',
      frameworkId: e.frameworkId ?? '',
      sourceType: e.sourceType ?? '',
      ...(toEpoch(e.attainedOn) !== undefined ? { attainedOn: toEpoch(e.attainedOn) } : {}),
      evidence: normaliseEvidence(e.evidence),
    }));
}

function normaliseRoleGap(raw: RoleGapWire | null | undefined): RoleGap | undefined {
  if (!raw?.role) return undefined;
  const outstanding = (raw.outstanding ?? []).filter((s): s is string => Boolean(s));
  const rowsWith = (status: string) =>
    (raw.gap ?? []).filter((g) => g?.skillId && g.status === status).map((g) => g.skillId as string);
  const gapMissing = rowsWith(GAP_STATUS.missing);
  return {
    role: raw.role,
    // Older builds omit `resolved`; a numeric readiness is then the only evidence it was measured.
    measurable: raw.resolved ?? typeof raw.readiness === 'number',
    readiness: typeof raw.readiness === 'number' ? raw.readiness : 0,
    required: typeof raw.required === 'number' ? raw.required : 0,
    met: typeof raw.met === 'number' ? raw.met : 0,
    // `outstanding` is the service's own ordering; fall back to deriving it from the rows
    // so a build that omits the field still shows the learner what is missing.
    outstanding: outstanding.length > 0 ? outstanding : gapMissing,
    held: rowsWith(GAP_STATUS.met),
  };
}

/**
 * Wire -> view for `skill/gap/read`.
 *
 * `resolved` is the important field. With no framework the service replies with an empty
 * body, and `current` is null for any learner an HR feed has not touched. Rendering either
 * as 0% would tell a fully qualified learner they are unqualified.
 */
export function normaliseGap(response: SkillGapResponse | undefined | null): SkillGap {
  const body = response?.frameworkId !== undefined || response?.targets !== undefined
    ? response
    : response?.result;
  const frameworkId = body?.frameworkId ?? '';
  const current = normaliseRoleGap(body?.current);
  const targets = (body?.targets ?? [])
    .map(normaliseRoleGap)
    .filter((r): r is RoleGap => Boolean(r));
  return {
    frameworkId,
    ...(current ? { current } : {}),
    targets,
    resolved: frameworkId.length > 0,
  };
}

function normaliseCandidate(raw: CandidateWire): RankedCandidate | undefined {
  if (!raw?.identifier) return undefined;
  return {
    identifier: raw.identifier,
    name: raw.name ?? '',
    primaryCategory: raw.primaryCategory ?? '',
    skills: (raw.skills ?? []).filter((s): s is string => Boolean(s)),
    gapCovered: typeof raw.gapCovered === 'number' ? raw.gapCovered : 0,
    alreadyHeld: typeof raw.alreadyHeld === 'number' ? raw.alreadyHeld : 0,
    totalSkills: typeof raw.totalSkills === 'number' ? raw.totalSkills : 0,
  };
}

/**
 * Wire -> view for `skill/recommend`.
 *
 * Candidates arrive ranked by the service (gap closed, then effort). That order is
 * preserved rather than re-sorted here: the ranking accounts for waiving, which the client
 * cannot see. Candidates covering nothing are dropped - they are not a next step.
 */
export function normaliseRecommendation(
  response: RecommendResponse | undefined | null
): Recommendation {
  const body = response?.candidates !== undefined || response?.role !== undefined
    ? response
    : response?.result;
  return {
    role: body?.role ?? '',
    frameworkId: body?.frameworkId ?? '',
    outstanding: (body?.skills ?? []).filter((s): s is string => Boolean(s)),
    candidates: (body?.candidates ?? [])
      .map(normaliseCandidate)
      .filter((c): c is RankedCandidate => Boolean(c))
      .filter((c) => c.gapCovered > 0),
  };
}

/**
 * Wire -> view for the resolved competency framework.
 *
 * `roleCodes` lists only roles requiring at least one skill: a role with none would report
 * 100% readiness for everyone, which on a mis-authored framework is exactly the misleading
 * answer to avoid.
 */
export function normaliseFrameworkMeta(
  response: CompetencyFrameworkResponse | undefined | null
): CompetencyFrameworkMeta | undefined {
  const body = response?.frameworkId ? response : response?.result;
  if (!body?.frameworkId) return undefined;
  const roles = body.roles ?? {};
  return {
    frameworkId: body.frameworkId,
    tierLabels: body.tierLabels ?? [],
    depth: typeof body.depth === 'number' ? body.depth : 0,
    leafSkills: body.leafSkills ?? [],
    roles,
    roleNames: body.roleNames ?? {},
    roleCodes: Object.keys(roles)
      .filter((code) => (roles[code] ?? []).length > 0)
      .sort((a, b) => a.localeCompare(b)),
  };
}

// ---- role authoring ---------------------------------------------------------------------------

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];

/** Authored roles, sorted by name. Rows without a roleId are dropped. */
export function normaliseAuthoredRoles(response: RoleReadResponse | undefined | null): AuthoredRole[] {
  const body = response?.roles ? response : response?.result;
  return (body?.roles ?? [])
    .filter((r): r is AuthoredRoleWire & { roleId: string } => typeof r?.roleId === 'string' && r.roleId !== '')
    .map((r) => {
      const skills = strings(r.skills);
      return {
        roleId: r.roleId,
        name: r.name || r.roleId,
        skills,
        skillCount: typeof r.skillCount === 'number' ? r.skillCount : skills.length,
        status: r.status === ROLE_STATUS.retired ? ROLE_STATUS.retired : ROLE_STATUS.live,
        version: typeof r.version === 'number' ? r.version : 1,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The diff an upsert or retire reports, or undefined when the body has none. */
export function normaliseRoleDiff(response: RoleWriteResponse | undefined | null): RoleDiff | undefined {
  const d = response?.diff ?? response?.result?.diff;
  if (!d?.roleId) return undefined;
  return {
    roleId: d.roleId,
    added: strings(d.added),
    removed: strings(d.removed),
    unchanged: strings(d.unchanged),
    rejected: strings(d.rejected),
    changed: Boolean(d.changed),
    ...(d.retired ? { retired: true } : {}),
  };
}
