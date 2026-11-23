import { describe, it, expect } from 'vitest';
import {
  buildSkillVocabulary,
  frameworkCategories,
  skillName,
  resolveSkillLabel,
} from './skillTree';

/** Three tiers: area -> competency -> leaf, as the health framework is authored. */
const threeTier = {
  framework: {
    categories: [
      {
        code: 'competency',
        terms: [
          {
            code: 'domain',
            name: 'Domain',
            children: [
              {
                code: 'medication-administration',
                name: 'Medication Administration',
                children: [
                  { code: 'dosage-calculation', name: 'Dosage Calculation' },
                  { code: 'iv-administration', name: 'IV Administration' },
                ],
              },
            ],
          },
          {
            code: 'behavioural',
            name: 'Behavioural',
            children: [
              {
                code: 'communication',
                name: 'Communication',
                children: [{ code: 'patient-counselling', name: 'Patient Counselling' }],
              },
            ],
          },
        ],
      },
    ],
  },
};

describe('frameworkCategories', () => {
  // AxiosAdapter.mapResponse strips `result`, so the unwrapped form is what arrives.
  // Reading `result.framework` silently emptied every label twice during the v1 work.
  it('reads the unwrapped shape the adapter delivers', () => {
    expect(frameworkCategories(threeTier)).toHaveLength(1);
  });

  it('still reads the enveloped shape', () => {
    expect(frameworkCategories({ result: threeTier })).toHaveLength(1);
  });

  it('returns [] rather than throwing on an unexpected body', () => {
    expect(frameworkCategories(undefined)).toEqual([]);
    expect(frameworkCategories(null)).toEqual([]);
    expect(frameworkCategories({})).toEqual([]);
  });
});

describe('buildSkillVocabulary', () => {
  it('indexes only LEAVES as skills, with their ancestor path', () => {
    const v = buildSkillVocabulary('fw', threeTier);
    expect(Object.keys(v.leaves).sort()).toEqual([
      'dosage-calculation',
      'iv-administration',
      'patient-counselling',
    ]);
    // interior terms are navigation only - never tagged, never held
    expect(v.leaves['domain']).toBeUndefined();
    expect(v.leaves['medication-administration']).toBeUndefined();
  });

  it('records the full ancestor chain, outermost first, with 0-based depth', () => {
    const v = buildSkillVocabulary('fw', threeTier);
    expect(v.leaves['dosage-calculation']?.path).toEqual([
      { code: 'domain', name: 'Domain', depth: 0 },
      { code: 'medication-administration', name: 'Medication Administration', depth: 1 },
    ]);
  });

  it('labels every term at any depth, not just leaves', () => {
    const v = buildSkillVocabulary('fw', threeTier);
    expect(v.labels['domain']).toBe('Domain');
    expect(v.labels['medication-administration']).toBe('Medication Administration');
    expect(v.labels['dosage-calculation']).toBe('Dosage Calculation');
  });

  // v2 sets a 3-tier minimum and NO maximum, and does not require uniform leaf depth.
  it('handles uneven depth - one branch deeper than its neighbour', () => {
    const uneven = {
      framework: {
        categories: [
          {
            code: 'competency',
            terms: [
              {
                code: 'a',
                name: 'A',
                children: [
                  { code: 'shallow', name: 'Shallow' },
                  { code: 'b', name: 'B', children: [{ code: 'deep', name: 'Deep' }] },
                ],
              },
            ],
          },
        ],
      },
    };
    const v = buildSkillVocabulary('fw', uneven);
    expect(Object.keys(v.leaves).sort()).toEqual(['deep', 'shallow']);
    expect(v.leaves['shallow']?.path.map((p) => p.code)).toEqual(['a']);
    expect(v.leaves['deep']?.path.map((p) => p.code)).toEqual(['a', 'b']);
  });

  it('descends arbitrarily deep', () => {
    const deep = {
      framework: {
        categories: [
          {
            code: 'competency',
            terms: [
              { code: 't1', children: [{ code: 't2', children: [{ code: 't3', children: [{ code: 't4' }] }] }] },
            ],
          },
        ],
      },
    };
    const v = buildSkillVocabulary('fw', deep);
    expect(Object.keys(v.leaves)).toEqual(['t4']);
    expect(v.leaves['t4']?.path.map((p) => p.code)).toEqual(['t1', 't2', 't3']);
  });

  // `children` is a graph relation; a term containing itself would recurse until the
  // stack blows, taking the whole page with it.
  it('does not recurse forever on a cycle in the authored data', () => {
    const cyclic: Record<string, unknown> = { code: 'a', name: 'A' };
    cyclic.children = [{ code: 'b', name: 'B', children: [cyclic] }];
    const v = buildSkillVocabulary('fw', {
      framework: { categories: [{ code: 'competency', terms: [cyclic] }] },
    } as never);
    // terminates, and the repeated node is not re-entered
    expect(v.labels['a']).toBe('A');
    expect(v.labels['b']).toBe('B');
  });

  it('falls back to the code when a term has no name', () => {
    const v = buildSkillVocabulary('fw', {
      framework: { categories: [{ code: 'competency', terms: [{ code: 'x', children: [{ code: 'y' }] }] }] },
    });
    expect(v.leaves['y']?.name).toBe('y');
  });

  it('is empty for a framework that does not resolve', () => {
    const v = buildSkillVocabulary('fw', undefined);
    expect(v.leaves).toEqual({});
    expect(v.labels).toEqual({});
  });
});

describe('skillName', () => {
  const vocab = buildSkillVocabulary('fw', threeTier);

  it('prefers the framework name', () => {
    expect(skillName(vocab, 'dosage-calculation')).toBe('Dosage Calculation');
  });

  it.each([
    ['iv-administration-extra', 'Iv administration extra'],
    ['hand_hygiene', 'Hand hygiene'],
  ])('de-slugs %s when the framework has no term', (code, expected) => {
    expect(skillName(undefined, code)).toBe(expected);
  });

  it('returns the input for an empty or separator-only code', () => {
    expect(skillName(vocab, '')).toBe('');
    expect(skillName(vocab, '--')).toBe('--');
  });
});

describe('resolveSkillLabel group', () => {
  const vocab = buildSkillVocabulary('fw', threeTier);

  it("returns the leaf's immediate parent term", () => {
    expect(resolveSkillLabel([vocab], 'dosage-calculation').group).toBe('Medication Administration');
  });

  it('returns undefined for a code the tree does not place', () => {
    expect(resolveSkillLabel([vocab], 'unknown').group).toBeUndefined();
    expect(resolveSkillLabel([], 'dosage-calculation').group).toBeUndefined();
  });
});

describe('resolveSkillLabel', () => {
  const vocab = buildSkillVocabulary('fw', threeTier);
  const empty = buildSkillVocabulary('other_fw', undefined);

  it('finds the name and group in whichever framework holds the code', () => {
    expect(resolveSkillLabel([empty, vocab], 'dosage-calculation')).toEqual({
      name: 'Dosage Calculation',
      group: 'Medication Administration',
      resolved: true,
    });
  });

  it('prefers the named framework', () => {
    expect(resolveSkillLabel([vocab], 'dosage-calculation', 'fw').resolved).toBe(true);
  });

  it('de-slugs, unresolved, when no framework knows the code', () => {
    expect(resolveSkillLabel([empty, undefined], 'hand-hygiene')).toEqual({ name: 'Hand hygiene', resolved: false });
  });
});
