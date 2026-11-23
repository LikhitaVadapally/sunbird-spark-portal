/** A term of a competency framework read; terms may nest through `children`. */
export interface TreeTermWire {
  code?: string;
  name?: string;
  children?: TreeTermWire[];
}

export interface FrameworkCategoryLike {
  code?: string;
  terms?: TreeTermWire[];
}

/** A competency framework read (`/competency-framework/v3/read`), enveloped or adapter-unwrapped. */
export interface FrameworkReadBody {
  framework?: { categories?: FrameworkCategoryLike[] };
}
export interface FrameworkReadResponse extends FrameworkReadBody {
  result?: FrameworkReadBody;
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
  /**
   * The content field this framework's skill tags live in: its last category's code (`skill`,
   * `cuisine`, ...), as lern reads it. Unset when the framework has no categories.
   */
  skillField?: string;
}

/**
 * Categories out of a framework read, whichever shape arrives.
 *
 * `AxiosAdapter.mapResponse` strips `result` before a caller sees the body, so the
 * unwrapped form is the normal one. Reading `result.framework` returned undefined and
 * silently emptied every label - twice - during the v1 work, so both are handled here
 * rather than at each call site.
 */
export function frameworkCategories(
  body: FrameworkReadResponse | undefined | null
): FrameworkCategoryLike[] {
  return body?.framework?.categories ?? body?.result?.framework?.categories ?? [];
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
function skillGroupName(vocabulary: SkillVocabulary | undefined, code: string): string | undefined {
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
