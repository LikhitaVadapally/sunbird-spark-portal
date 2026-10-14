import { describe, it, expect } from 'vitest';
import { indexPathNodes, withEvidenceSources } from './evidenceSources';
import type { EvidenceSource } from './evidenceSources';
import type { MySkillEntry, SkillPathRef } from './mySkills';
import type { HierarchyContentNode } from '../../types/collectionTypes';

const ICU: SkillPathRef = { pathId: 'do_icu', contextId: 'b1', pathName: 'ICU Nurse Induction V3' };
const OTHER: SkillPathRef = { pathId: 'do_other', pathName: 'Ward Basics' };

const tree: HierarchyContentNode = {
  identifier: 'do_icu',
  name: 'ICU Nurse Induction V3',
  children: [
    {
      identifier: 'do_level',
      name: 'Level 1',
      children: [{ identifier: 'do_assess', name: 'ICU Final Assessment' }, { identifier: 'do_unnamed' }],
    },
  ],
};

function gained(sourceId: string, paths: SkillPathRef[]): MySkillEntry {
  return {
    code: 'dosage',
    gained: true,
    source: 'assessment',
    evidence: [{ evidenceId: 'e1', sourceType: 'ASSESSMENT', sourceId, revoked: false }],
    paths,
  };
}

describe('indexPathNodes', () => {
  it('indexes every node, at any depth, with its name and the path', () => {
    const index = indexPathNodes(tree, ICU);
    expect(index.get('do_assess')).toEqual({ name: 'ICU Final Assessment', path: ICU });
    expect(index.get('do_icu')).toEqual({ name: 'ICU Nurse Induction V3', path: ICU });
    expect(index.get('do_unnamed')).toEqual({ path: ICU });
  });

  it('survives a node that contains itself', () => {
    const loop: HierarchyContentNode = { identifier: 'a', children: [] };
    loop.children?.push(loop);
    expect(indexPathNodes(loop, ICU).size).toBe(1);
  });
});

describe('withEvidenceSources', () => {
  const sources = indexPathNodes(tree, ICU);

  it('names the source and the path it was earned in', () => {
    const [entry] = withEvidenceSources([gained('do_assess', [ICU])], sources);
    expect(entry?.evidence[0]).toEqual(expect.objectContaining({ sourceName: 'ICU Final Assessment', sourcePath: ICU }));
  });

  it('drops the earning path from the other paths, and keeps the rest', () => {
    const [entry] = withEvidenceSources([gained('do_assess', [ICU, OTHER])], sources);
    expect(entry?.paths).toEqual([OTHER]);
  });

  it('leaves evidence from an unknown source untouched', () => {
    const [entry] = withEvidenceSources([gained('do_elsewhere', [ICU])], sources);
    expect(entry?.evidence[0]?.sourceName).toBeUndefined();
    expect(entry?.evidence[0]?.sourcePath).toBeUndefined();
    expect(entry?.paths).toEqual([ICU]);
  });

  it('names a directly enrolled course without a path', () => {
    const named = new Map<string, EvidenceSource>([['do_course', { name: 'usf skill test' }]]);
    const [entry] = withEvidenceSources([gained('do_course', [])], named);
    expect(entry?.evidence[0]).toEqual(expect.objectContaining({ sourceName: 'usf skill test' }));
    expect(entry?.evidence[0]?.sourcePath).toBeUndefined();
  });
});
