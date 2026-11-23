import type { HierarchyContentNode } from '../../types/collectionTypes';
import type { MySkillEntry, SkillPathRef } from './mySkills';

/** What an evidence `sourceId` points at: its name, and the enrolled path it sits in, if any. */
export interface EvidenceSource {
  name?: string;
  path?: SkillPathRef;
}

/**
 * Every node of one path's hierarchy -> its name and that path.
 *
 * An assessment inside a path is never enrolled in directly, so the path's hierarchy is the only
 * place its name is known. A node seen twice is walked once, which also guards a cyclic hierarchy.
 */
export function indexPathNodes(root: HierarchyContentNode, path: SkillPathRef): Map<string, EvidenceSource> {
  const index = new Map<string, EvidenceSource>();
  const walk = (node: HierarchyContentNode) => {
    if (!node.identifier || index.has(node.identifier)) return;
    index.set(node.identifier, { ...(node.name ? { name: node.name } : {}), path });
    (node.children ?? []).forEach(walk);
  };
  walk(root);
  return index;
}

/**
 * Names each evidence row's source and the path it was earned in, from `sources` (source id ->
 * source). `paths` is left whole - counts such as "most reinforced" need every path that teaches
 * the skill; `alsoTaughtIn` drops the earned-in one for display.
 */
export function withEvidenceSources(
  entries: MySkillEntry[],
  sources: ReadonlyMap<string, EvidenceSource>
): MySkillEntry[] {
  if (sources.size === 0) return entries;
  return entries.map((entry) => {
    const evidence = entry.evidence.map((e) => {
      const source = sources.get(e.sourceId);
      if (!source) return e;
      return {
        ...e,
        ...(source.name ? { sourceName: source.name } : {}),
        ...(source.path ? { sourcePath: source.path } : {}),
      };
    });
    return { ...entry, evidence };
  });
}

/** The enrolled paths that teach a gained skill, other than the one(s) it was earned in. */
export function alsoTaughtIn(entry: MySkillEntry): SkillPathRef[] {
  const earnedIn = new Set(entry.evidence.map((e) => e.sourcePath?.pathId).filter(Boolean));
  return entry.paths.filter((p) => !earnedIn.has(p.pathId));
}
