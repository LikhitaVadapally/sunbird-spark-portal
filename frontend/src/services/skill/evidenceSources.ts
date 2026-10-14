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
 * source). The path a skill was earned in is dropped from the entry's paths, so "also taught in"
 * lists only the others.
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
    const earnedIn = new Set(evidence.map((e) => e.sourcePath?.pathId).filter(Boolean));
    return { ...entry, evidence, paths: entry.paths.filter((p) => !earnedIn.has(p.pathId)) };
  });
}
