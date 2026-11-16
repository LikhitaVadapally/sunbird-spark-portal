import { frameworkCategories, type SkillVocabulary, type TierNode, type TaxonomyFrameworkResponse } from './skillTree';

/** A term as the competency framework read returns it; only the fields the walks need. */
interface LeafTermWire {
  identifier?: string;
  code?: string;
  name?: string;
  category?: string;
  children?: LeafTermWire[];
  associations?: Array<{ identifier?: string; category?: string }>;
  parentCode?: string;
  parents?: Array<{ code?: string }>;
}

type CategoryWire = { code?: string; index?: number; terms?: LeafTermWire[] };

/** The way down from a term: `children`, else associations that leave its own category. */
function treeOf(categories: CategoryWire[]) {
  const index = new Map<string, LeafTermWire>();
  categories.forEach((c) => (c.terms ?? []).forEach((t) => t.identifier && index.set(t.identifier, t)));
  const resolve = (t: LeafTermWire) => (t.identifier && index.get(t.identifier)) || t;
  const descendants = (t: LeafTermWire, seen: Set<string>): LeafTermWire[] => {
    if (t.children?.length) return t.children.map(resolve);
    const own = t.category ?? '';
    return (t.associations ?? []).flatMap((a) => {
      if (!a.category || a.category === own || !a.identifier || seen.has(a.identifier)) return [];
      const target = index.get(a.identifier);
      return target ? [target] : [];
    });
  };
  return { descendants };
}

/** Categories in authored order: by `index`, falling back to their position in the response. */
function ordered(categories: CategoryWire[]): CategoryWire[] {
  return categories
    .map((c, pos) => ({ c, key: typeof c.index === 'number' ? c.index : pos }))
    .sort((x, y) => x.key - y.key)
    .map((x) => x.c);
}

/**
 * The content field a framework's skill tags live in: the code of its LAST category by `index`
 * (lern `CompetencyFrameworkUtil.parseSkillField`). `skill` for most frameworks, but an admin can
 * name the last level anything, e.g. `cuisine`.
 */
export function frameworkSkillField(body: TaxonomyFrameworkResponse | undefined | null): string | undefined {
  const cats = ordered(frameworkCategories(body) as CategoryWire[]);
  return cats[cats.length - 1]?.code || undefined;
}

/**
 * The framework's skills (leaf codes), worked out the way lern does it
 * (`CompetencyFrameworkUtil.parseTree`), so the role editor offers exactly what lern accepts.
 *
 * The skills are the terms of the framework's LAST category, whatever it is named. Inside it, terms
 * may still nest by `children` or name a `parentCode`/`parents` in the same category; then only a
 * term nobody descends from is a skill. Categories above it are grouping only.
 */
export function frameworkLeaves(body: TaxonomyFrameworkResponse | undefined | null): string[] {
  const cats = ordered(frameworkCategories(body) as CategoryWire[]);
  const flatten = (terms: LeafTermWire[]): LeafTermWire[] => terms.flatMap((t) => [t, ...flatten(t.children ?? [])]);
  const all = flatten(cats[cats.length - 1]?.terms ?? []);
  const codes = new Set(all.map((t) => t.code).filter((c): c is string => Boolean(c)));
  const parents = new Set(
    all
      .map((t) => t.parentCode ?? t.parents?.find((p) => p.code)?.code)
      .filter((p): p is string => Boolean(p) && codes.has(p as string))
  );
  const leaves = all.filter((t) => t.code && !t.children?.length && !parents.has(t.code)).map((t) => t.code as string);
  return [...new Set(leaves)].sort();
}

/**
 * Names and grouping for the role editor, from the same `/competency-framework/v3/read` response.
 *
 * `buildSkillVocabulary` reads `/framework/v1/read`, which answers 404 for `CompetencyFramework`
 * objects, and follows only `children`. Here every term contributes its authored name, and each
 * skill's path is walked from the TOP category (e.g. competency area) through associations or
 * children, so `path[0]` is the outermost tier the picker groups by.
 */
export function frameworkVocabulary(
  frameworkId: string,
  body: TaxonomyFrameworkResponse | undefined | null
): SkillVocabulary {
  const categories = frameworkCategories(body) as CategoryWire[];
  const labels: Record<string, string> = {};
  const record = (t: LeafTermWire) => {
    if (t.code && t.name) labels[t.code] = t.name;
    (t.children ?? []).forEach(record);
  };
  categories.forEach((c) => (c.terms ?? []).forEach(record));

  const leafCodes = new Set(frameworkLeaves(body));
  const leaves: SkillVocabulary['leaves'] = {};
  const top = [...categories].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
  const { descendants } = treeOf(categories);
  const walk = (t: LeafTermWire, ancestors: TierNode[], seen: Set<string>) => {
    if (!t.code || (t.identifier && seen.has(t.identifier))) return;
    const nextSeen = t.identifier ? new Set(seen).add(t.identifier) : seen;
    if (leafCodes.has(t.code)) {
      if (!leaves[t.code]) leaves[t.code] = { code: t.code, name: labels[t.code] ?? t.code, path: ancestors };
      return;
    }
    const node = { code: t.code, name: labels[t.code] ?? t.code, depth: ancestors.length };
    descendants(t, nextSeen).forEach((n) => walk(n, [...ancestors, node], nextSeen));
  };
  (top?.terms ?? []).forEach((t) => walk(t, [], new Set()));
  // Skills the top-down walk did not reach still get their name, just no group.
  leafCodes.forEach((code) => {
    if (!leaves[code]) leaves[code] = { code, name: labels[code] ?? code, path: [] };
  });
  // Lower-cased skill name -> code, for content tagged by name; a name two skills share maps to neither.
  const names: Record<string, string | null> = {};
  Object.values(leaves).forEach(({ code, name }) => {
    const key = name.trim().toLowerCase();
    names[key] = names[key] === undefined || names[key] === code ? code : null;
  });
  const codeByName: Record<string, string> = {};
  Object.entries(names).forEach(([key, code]) => code && (codeByName[key] = code));
  return { frameworkId, labels, leaves, codeByName, skillField: frameworkSkillField(body) };
}
