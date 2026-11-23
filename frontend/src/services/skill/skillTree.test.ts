import { describe, it, expect } from 'vitest';
import { frameworkCategories, skillName, resolveSkillLabel } from './skillTree';
import { frameworkVocabulary } from './skillLeaves';

/** Three tiers nested by `children`: area -> competency -> leaf. */
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

describe('skillName', () => {
  const vocab = frameworkVocabulary('fw', threeTier);

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
  const vocab = frameworkVocabulary('fw', threeTier);

  it("returns the leaf's immediate parent term", () => {
    expect(resolveSkillLabel([vocab], 'dosage-calculation').group).toBe('Medication Administration');
  });

  it('returns undefined for a code the tree does not place', () => {
    expect(resolveSkillLabel([vocab], 'unknown').group).toBeUndefined();
    expect(resolveSkillLabel([], 'dosage-calculation').group).toBeUndefined();
  });
});

describe('resolveSkillLabel', () => {
  const vocab = frameworkVocabulary('fw', threeTier);
  const empty = frameworkVocabulary('other_fw', undefined);

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
