import { skillName, type SkillVocabulary } from './skillTree';

export interface SkillOption {
  code: string;
  name: string;
}

export interface SkillOptionGroup {
  /** Top-tier term code, or '' for leaves the tree does not place. */
  groupCode: string;
  groupName: string;
  options: SkillOption[];
}

/**
 * The skills a role may require, grouped for the picker.
 *
 * `leafSkills` comes from the framework (`frameworkLeaves`, lern's own rule) and decides WHICH codes are
 * allowed: lern rejects any non-leaf, so offering only these means `rejected` should stay empty.
 * Names and grouping come from the taxonomy tree, which lern does not return.
 *
 * Grouped by the outermost tier (`path[0]`). Leaves the tree does not place - e.g. the
 * three-category shape, whose terms link by association rather than `children` - fall into a
 * trailing ungrouped bucket rather than being dropped.
 */
export function groupLeafOptions(
  leafSkills: string[],
  vocabulary: SkillVocabulary | undefined
): SkillOptionGroup[] {
  const groups = new Map<string, SkillOption[]>();
  Array.from(new Set(leafSkills)).forEach((code) => {
    const key = vocabulary?.leaves[code]?.path[0]?.code ?? '';
    const option = { code, name: skillName(vocabulary, code) };
    const bucket = groups.get(key);
    if (bucket) bucket.push(option);
    else groups.set(key, [option]);
  });

  return Array.from(groups.entries())
    .map(([groupCode, options]) => ({
      groupCode,
      groupName: groupCode ? skillName(vocabulary, groupCode) : '',
      options: options.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      if (!a.groupCode) return 1;
      if (!b.groupCode) return -1;
      return a.groupName.localeCompare(b.groupName);
    });
}

/** Keeps the groups and options whose name or code contains `query` (case-insensitive). */
export function filterOptionGroups(groups: SkillOptionGroup[], query: string): SkillOptionGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({
      ...g,
      options: g.options.filter(
        (o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)
      ),
    }))
    .filter((g) => g.options.length > 0);
}

/** A role code from a display name: "Staff Nurse (ICU)" -> "staff-nurse-icu". */
export function toRoleCode(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
