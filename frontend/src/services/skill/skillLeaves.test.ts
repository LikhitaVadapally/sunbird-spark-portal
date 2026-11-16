import { describe, it, expect } from 'vitest';
import { frameworkLeaves, frameworkSkillField, frameworkVocabulary } from './skillLeaves';

const fw = (categories: unknown[]) => ({ framework: { categories } }) as Parameters<typeof frameworkLeaves>[0];

describe('frameworkLeaves', () => {
  it('returns nothing without categories', () => {
    expect(frameworkLeaves(undefined)).toEqual([]);
    expect(frameworkLeaves(fw([]))).toEqual([]);
  });

  // lern reads the skills from the framework's LAST category, whatever it is named.
  it('takes the skills from the last category by index, even with no "competency" category', () => {
    const body = fw([
      { code: 'cuisine', index: 3, terms: [{ code: 'FR2' }, { code: 'IT1' }] },
      { code: 'ingredient', index: 1, terms: [{ code: 'I1' }] },
      { code: 'technique', index: 2, terms: [{ code: 'T1' }] },
    ]);
    expect(frameworkLeaves(body)).toEqual(['FR2', 'IT1']);
    expect(frameworkLeaves(fw([{ code: 'skill', terms: [{ code: 'x' }] }]))).toEqual(['x']);
  });

  it('reads nested children: only terms with no children are skills', () => {
    const body = fw([
      {
        code: 'competency',
        terms: [
          { code: 'area', children: [{ code: 'comp', children: [{ code: 'dose' }, { code: 'wound' }] }, { code: 'shallow' }] },
        ],
      },
    ]);
    expect(frameworkLeaves(body)).toEqual(['dose', 'shallow', 'wound']);
  });

  it('follows associations into other categories, by identifier', () => {
    const body = fw([
      { code: 'competencyarea', terms: [{ identifier: 'a1', code: 'area', category: 'competencyarea' }] },
      {
        code: 'competency',
        terms: [
          {
            identifier: 'c1',
            code: 'comp',
            category: 'competency',
            associations: [
              { identifier: 's1', category: 'skill' },
              { identifier: 'c2', category: 'competency' }, // same category: ignored
            ],
          },
          { identifier: 'c2', code: 'comp2', category: 'competency', associations: [{ identifier: 's2', category: 'skill' }] },
        ],
      },
      {
        code: 'skill',
        terms: [
          { identifier: 's1', code: 'dose', category: 'skill' },
          { identifier: 's2', code: 'wound', category: 'skill' },
        ],
      },
    ]);
    expect(frameworkLeaves(body)).toEqual(['dose', 'wound']);
  });

  it('does not loop on a cycle', () => {
    const body = fw([
      { code: 'competency', terms: [{ identifier: 'c1', code: 'comp', category: 'competency', associations: [{ identifier: 's1', category: 'skill' }] }] },
      { code: 'skill', terms: [{ identifier: 's1', code: 'dose', category: 'skill', associations: [{ identifier: 'c1', category: 'competency' }] }] },
    ]);
    expect(frameworkLeaves(body)).toEqual(['dose']);
  });

  it('falls back to parentCode for a flat list', () => {
    const body = fw([
      {
        code: 'competency',
        terms: [{ code: 'area' }, { code: 'comp', parentCode: 'area' }, { code: 'dose', parents: [{ code: 'comp' }] }],
      },
    ]);
    expect(frameworkLeaves(body)).toEqual(['dose']);
  });

  it('reads the enveloped response too', () => {
    const body = { result: { framework: { categories: [{ code: 'competency', terms: [{ code: 'a', children: [{ code: 'b' }] }] }] } } };
    expect(frameworkLeaves(body as Parameters<typeof frameworkLeaves>[0])).toEqual(['b']);
  });
});

describe('frameworkSkillField', () => {
  it('is the last category\'s code: the field courses store skill tags in', () => {
    expect(frameworkSkillField(fw([{ code: 'competencyarea', index: 1 }, { code: 'cuisine', index: 3 }, { code: 'competency', index: 2 }]))).toBe('cuisine');
    expect(frameworkSkillField(fw([{ code: 'competency' }, { code: 'skill' }]))).toBe('skill');
    expect(frameworkSkillField(undefined)).toBeUndefined();
  });

  it('is carried on the vocabulary', () => {
    expect(frameworkVocabulary('fw', fw([{ code: 'cuisine', terms: [{ code: 'FR2', name: 'French' }] }])).skillField).toBe('cuisine');
  });
});

describe('frameworkVocabulary', () => {
  // The shape /competency-framework/v3/read returns for a three-category framework.
  const body = fw([
    {
      code: 'competencyarea',
      index: 1,
      terms: [
        {
          identifier: 'a1', code: 'functional', name: 'Functional', category: 'competencyarea',
          associations: [{ identifier: 'c1', category: 'competency' }],
        },
      ],
    },
    {
      code: 'competency',
      index: 2,
      terms: [
        {
          identifier: 'c1', code: 'health-data', name: 'Health Data', category: 'competency',
          associations: [{ identifier: 's1', category: 'skill' }, { identifier: 's2', category: 'skill' }],
        },
      ],
    },
    {
      code: 'skill',
      index: 3,
      terms: [
        { identifier: 's1', code: 'hmis-reporting', name: 'HMIS Reporting', category: 'skill' },
        { identifier: 's2', code: 'register-maintenance', name: 'Register Maintenance', category: 'skill' },
      ],
    },
  ]);

  it('uses the authored names, not the codes', () => {
    const v = frameworkVocabulary('fw', body);
    expect(v.labels['hmis-reporting']).toBe('HMIS Reporting');
    expect(v.leaves['hmis-reporting']?.name).toBe('HMIS Reporting');
  });

  it('places each skill under its competency area', () => {
    const v = frameworkVocabulary('fw', body);
    expect(v.leaves['hmis-reporting']?.path.map((p) => p.name)).toEqual(['Functional', 'Health Data']);
    expect(Object.keys(v.leaves).sort()).toEqual(['hmis-reporting', 'register-maintenance']);
  });

  it('groups by the top category the framework has, even without competency areas', () => {
    const orphan = fw([
      { code: 'competency', index: 1, terms: [{ identifier: 'c1', code: 'comp', name: 'Comp', category: 'competency', associations: [{ identifier: 's1', category: 'skill' }] }] },
      { code: 'skill', index: 2, terms: [{ identifier: 's1', code: 'dose', name: 'Dosage', category: 'skill' }] },
    ]);
    const v = frameworkVocabulary('fw', orphan);
    expect(v.leaves.dose).toEqual({ code: 'dose', name: 'Dosage', path: [{ code: 'comp', name: 'Comp', depth: 0 }] });
  });
});
