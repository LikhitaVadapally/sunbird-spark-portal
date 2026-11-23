import type { CompetencyFrameworkMeta, HeldSkill, RoleGap, SkillGap } from '../../types/skillServiceTypes';

export type RoleKind = 'assigned' | 'target';

/** One readiness card: the gap plus what the gap response itself does not carry. */
export interface RoleCard {
  code: string;
  kind: RoleKind;
  gap: RoleGap;
  /** Authored display name; the code when the framework names no such role. */
  name: string;
  /** Still measured, but no longer offered: `role/list` names it yet lists it under no live role. */
  retired: boolean;
}

/**
 * The framework the learner's roles belong to.
 *
 * `user_role` holds one framework, and `gap/read` reports it. A learner with no roles yet has none,
 * so fall back to the framework they hold the most skills in - the one most likely to describe
 * their work. Ties break on id so the choice is stable across renders.
 */
export function pickRoleFramework(gapFrameworkId: string, held: HeldSkill[]): string | undefined {
  if (gapFrameworkId) return gapFrameworkId;
  const counts = new Map<string, number>();
  held.forEach((s) => {
    if (s.frameworkId) counts.set(s.frameworkId, (counts.get(s.frameworkId) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

/**
 * `role/list` lists only live roles under `roles` but names retired ones too, so a code with a
 * name and no live entry is retired. Without the meta nothing can be told, so nothing is flagged.
 */
function isRetired(code: string, meta: CompetencyFrameworkMeta | undefined): boolean {
  if (!meta) return false;
  return !(code in meta.roles) && code in meta.roleNames;
}

/** Assigned role first, then targets in the service's order. */
export function buildRoleCards(gap: SkillGap | undefined, meta: CompetencyFrameworkMeta | undefined): RoleCard[] {
  if (!gap) return [];
  const card = (g: RoleGap, kind: RoleKind): RoleCard => ({
    code: g.role,
    kind,
    gap: g,
    name: meta?.roleNames[g.role] ?? g.role,
    retired: isRetired(g.role, meta),
  });
  return [...(gap.current ? [card(gap.current, 'assigned')] : []), ...gap.targets.map((g) => card(g, 'target'))];
}

/** Live roles the learner can still aim at: not their assigned role, not already a target. */
export function addableRoles(meta: CompetencyFrameworkMeta | undefined, gap: SkillGap | undefined): string[] {
  const taken = new Set([...(gap?.current ? [gap.current.role] : []), ...(gap?.targets ?? []).map((t) => t.role)]);
  return (meta?.roleCodes ?? []).filter((code) => !taken.has(code));
}

/**
 * The full target list after one change. `role/update` REPLACES the stored set, so every save must
 * carry all the targets the learner keeps - sending only the changed one would drop the rest.
 */
export function nextTargets(gap: SkillGap | undefined, change: { add?: string; remove?: string }): string[] {
  const current = (gap?.targets ?? []).map((t) => t.role).filter((code) => code !== change.remove);
  return change.add && !current.includes(change.add) ? [...current, change.add] : current;
}
