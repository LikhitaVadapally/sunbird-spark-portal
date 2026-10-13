import type { HeldSkill } from '../../types/skillServiceTypes';

/** A term in the nested `competency` category of a taxonomy framework read. */
export interface TreeTermWire {
  code?: string;
  name?: string;
  children?: TreeTermWire[];
}

export interface FrameworkCategoryLike {
  code?: string;
  terms?: TreeTermWire[];
}

/** A taxonomy framework read, in either the enveloped or the adapter-unwrapped shape. */
export interface TaxonomyFrameworkBody {
  framework?: { categories?: FrameworkCategoryLike[] };
}
export interface TaxonomyFrameworkResponse extends TaxonomyFrameworkBody {
  result?: TaxonomyFrameworkBody;
}

/** One ancestor on a leaf's path, outermost first. */
export interface TierNode {
  code: string;
  name: string;
  /** 0-based, so it indexes `tierLabels` directly. */
  depth: number;
}

export interface LeafSkill {
  code: string;
  name: string;
  /** Ancestors from the outermost tier down to (and excluding) the leaf itself. */
  path: TierNode[];
}

export interface SkillVocabulary {
  frameworkId: string;
  /** Every term code -> display name, at any depth. */
  labels: Record<string, string>;
  /** Leaf code -> its resolved position in the tree. */
  leaves: Record<string, LeafSkill>;
}

/**
 * Categories out of a taxonomy framework read, whichever shape arrives.
 *
 * `AxiosAdapter.mapResponse` strips `result` before a caller sees the body, so the
 * unwrapped form is the normal one. Reading `result.framework` returned undefined and
 * silently emptied every label - twice - during the v1 work, so both are handled here
 * rather than at each call site.
 */
export function frameworkCategories(
  body: TaxonomyFrameworkResponse | undefined | null
): FrameworkCategoryLike[] {
  return body?.framework?.categories ?? body?.result?.framework?.categories ?? [];
}

/**
 * Walks the nested `competency` category into a flat leaf index.
 *
 * WHY A RECURSIVE WALK: v2 sets a three-tier minimum and NO maximum, and does not require
 * uniform leaf depth - one branch may stop at tier 3 while its neighbour goes to tier 5.
 * Fixed nesting would silently drop the deeper branches.
 *
 * A leaf is a term with no children, which is the only thing tagged, required by a role or
 * held by a learner. Interior terms are navigation only, so they contribute labels and a
 * path but never appear as skills.
 *
 * `seen` guards against a cycle in the authored data: `children` is a graph relation, and a
 * term that (directly or transitively) contains itself would otherwise recurse until the
 * stack blows - taking the whole profile page with it.
 */
export function buildSkillVocabulary(
  frameworkId: string,
  body: TaxonomyFrameworkResponse | undefined | null
): SkillVocabulary {
  const labels: Record<string, string> = {};
  const leaves: Record<string, LeafSkill> = {};
  const categories = frameworkCategories(body);

  categories.forEach((category) => {
    (category.terms ?? []).forEach((term) => collect(term, [], new Set<string>()));
  });

  function collect(term: TreeTermWire, ancestors: TierNode[], seen: Set<string>): void {
    const code = term.code;
    if (!code || seen.has(code)) return;
    const name = term.name ?? code;
    labels[code] = name;

    const children = term.children ?? [];
    if (children.length === 0) {
      // only leaves are skills
      leaves[code] = { code, name, path: ancestors };
      return;
    }
    const nextSeen = new Set(seen);
    nextSeen.add(code);
    const nextAncestors = [...ancestors, { code, name, depth: ancestors.length }];
    children.forEach((child) => collect(child, nextAncestors, nextSeen));
  }

  return { frameworkId, labels, leaves };
}

export interface TierGroup {
  /** Ancestor code at the grouping depth, or '' for skills the tree does not place. */
  tierCode: string;
  tierName: string;
  skills: HeldSkill[];
}

/**
 * Groups held skills by an ancestor tier.
 *
 * `depth` selects which tier heads each group - 0 is the outermost, which `tierLabels[0]`
 * names. A skill whose branch is shallower than `depth`, or which the framework does not
 * place at all, falls into a trailing unclassified group rather than being dropped: the
 * learner earned it either way, and a retagged framework should not make it vanish.
 */
export function groupSkillsByTier(
  skills: HeldSkill[],
  vocabulary: SkillVocabulary | undefined,
  depth = 0
): TierGroup[] {
  const byTier = new Map<string, HeldSkill[]>();
  skills.forEach((skill) => {
    const tier = vocabulary?.leaves[skill.skillId]?.path[depth];
    const key = tier?.code ?? '';
    const bucket = byTier.get(key);
    if (bucket) bucket.push(skill);
    else byTier.set(key, [skill]);
  });

  const nameOf = (code: string) => vocabulary?.labels[code] ?? code;

  return Array.from(byTier.entries())
    .map(([tierCode, groupSkills]) => ({
      tierCode,
      tierName: tierCode ? nameOf(tierCode) : '',
      skills: [...groupSkills].sort((a, b) =>
        skillName(vocabulary, a.skillId).localeCompare(skillName(vocabulary, b.skillId))
      ),
    }))
    .sort((a, b) => {
      if (!a.tierCode) return 1; // unclassified last
      if (!b.tierCode) return -1;
      return a.tierName.localeCompare(b.tierName);
    });
}

/**
 * Human label for a skill code, from the framework; falls back to a de-slugged code so a
 * term missing from the framework still reads as words rather than a slug.
 */
export function skillName(vocabulary: SkillVocabulary | undefined, code: string): string {
  const hit = vocabulary?.labels[code];
  if (hit) return hit;
  const words = code.replace(/[_-]+/g, ' ').trim();
  if (!words) return code;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A skill as the learner sees it: its name and the term it sits under. */
export interface SkillLabel {
  name: string;
  /** Name of the leaf's parent term ("Infection Prevention"); undefined when the tree does not place it. */
  group?: string;
  /** False when no framework knew the code and `name` is only a de-slugged guess. */
  resolved: boolean;
}

/** The name of a leaf's immediate parent term - the small group label on a skill card. */
export function skillGroupName(vocabulary: SkillVocabulary | undefined, code: string): string | undefined {
  const path = vocabulary?.leaves[code]?.path;
  return path && path.length > 0 ? path[path.length - 1]?.name : undefined;
}

/**
 * Name and group for a code, looked up across every loaded framework.
 *
 * Skills are keyed by CODE everywhere, but a code reaches a page from several places - the
 * profile (which names its framework), a path hierarchy (which may not), a course tag (which
 * never does). So the preferred framework is tried first, then any framework whose tree holds
 * the code as a leaf, then any that merely labels it. Only when none does is it de-slugged.
 */
export function resolveSkillLabel(
  vocabularies: Array<SkillVocabulary | undefined>,
  code: string,
  preferredFrameworkId?: string
): SkillLabel {
  const loaded = vocabularies.filter((v): v is SkillVocabulary => Boolean(v));
  const preferred = loaded.find((v) => v.frameworkId === preferredFrameworkId && v.labels[code]);
  const vocab = preferred ?? loaded.find((v) => v.leaves[code]) ?? loaded.find((v) => v.labels[code]);
  if (!vocab) return { name: skillName(undefined, code), resolved: false };
  const group = skillGroupName(vocab, code);
  return { name: skillName(vocab, code), ...(group ? { group } : {}), resolved: true };
}

/** True when at least one skill resolved to a tier, i.e. grouping is meaningful. */
export function isGrouped(groups: TierGroup[]): boolean {
  return groups.some((g) => g.tierCode !== '');
}
