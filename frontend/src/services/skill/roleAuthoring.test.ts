import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillService } from './SkillService';
import { normaliseAuthoredRoles, normaliseRoleDiff } from './skillMappers';
import { groupLeafOptions, filterOptionGroups, toRoleCode } from './roleSkillOptions';
import { buildSkillVocabulary } from './skillTree';
import { IHttpClient, init } from '../../lib/http-client';

describe('SkillService role authoring', () => {
  let client: IHttpClient;
  const service = new SkillService();

  beforeEach(() => {
    client = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ data: {}, status: 200, headers: {} }),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      updateHeaders: vi.fn(),
    };
    init(client);
  });

  it('reads, upserts and retires under /competency/v1/role', async () => {
    await service.roleRead({ frameworkId: 'fw' });
    await service.roleUpsert({ frameworkId: 'fw', roleId: 'r', name: 'R', skills: ['a'], reactivate: true });
    await service.roleRetire({ frameworkId: 'fw', roleId: 'r' });
    expect(client.post).toHaveBeenNthCalledWith(1, '/competency/v1/role/read', { request: { frameworkId: 'fw' } });
    expect(client.post).toHaveBeenNthCalledWith(2, '/competency/v1/role/upsert', {
      request: { frameworkId: 'fw', roleId: 'r', name: 'R', skills: ['a'], reactivate: true },
    });
    expect(client.post).toHaveBeenNthCalledWith(3, '/competency/v1/role/retire', {
      request: { frameworkId: 'fw', roleId: 'r' },
    });
  });
});

describe('normaliseAuthoredRoles', () => {
  it('reads the unwrapped and the result-wrapped body, sorted by name', () => {
    const roles = [
      { roleId: 'b', name: 'Beta', skills: ['x', 'y'], skillCount: 2, status: 'LIVE', version: 3 },
      { roleId: 'a', name: 'Alpha', skills: ['x'], skillCount: 1, status: 'RETIRED', version: 1 },
    ];
    const plain = normaliseAuthoredRoles({ roles });
    expect(plain.map((r) => r.roleId)).toEqual(['a', 'b']);
    expect(plain[0]?.status).toBe('RETIRED');
    expect(normaliseAuthoredRoles({ result: { roles } })).toEqual(plain);
  });

  it('defaults missing fields and drops rows without a roleId', () => {
    const out = normaliseAuthoredRoles({ roles: [{ roleId: 'r' }, { name: 'no id' }] });
    expect(out).toEqual([{ roleId: 'r', name: 'r', skills: [], skillCount: 0, status: 'LIVE', version: 1 }]);
    expect(normaliseAuthoredRoles(undefined)).toEqual([]);
  });
});

describe('normaliseRoleDiff', () => {
  it('reads the diff from either shape', () => {
    const diff = { roleId: 'r', added: ['a'], removed: [], unchanged: ['b'], rejected: ['c'], changed: true };
    expect(normaliseRoleDiff({ diff })).toEqual(diff);
    expect(normaliseRoleDiff({ result: { diff: { ...diff, retired: true } } })).toEqual({ ...diff, retired: true });
  });

  it('is undefined without a diff', () => {
    expect(normaliseRoleDiff({})).toBeUndefined();
    expect(normaliseRoleDiff(null)).toBeUndefined();
  });
});

describe('groupLeafOptions', () => {
  const vocabulary = buildSkillVocabulary('fw', {
    framework: {
      categories: [{
        code: 'competency',
        terms: [
          { code: 'med', name: 'Medication', children: [
            { code: 'dose', name: 'Dosage calculation' },
            { code: 'admin', name: 'Administering drugs' },
          ] },
          { code: 'care', name: 'Patient care', children: [{ code: 'wound', name: 'Wound care' }] },
        ],
      }],
    },
  });

  it('groups leaves under their top tier, with names, alphabetically', () => {
    const groups = groupLeafOptions(['dose', 'wound', 'admin'], vocabulary);
    expect(groups.map((g) => g.groupName)).toEqual(['Medication', 'Patient care']);
    expect(groups[0]?.options.map((o) => o.name)).toEqual(['Administering drugs', 'Dosage calculation']);
  });

  // e.g. the three-category shape, where terms link by association and have no children
  it('puts leaves the tree does not place in a trailing ungrouped bucket', () => {
    const groups = groupLeafOptions(['dose', 'loose-skill'], vocabulary);
    expect(groups[groups.length - 1]).toEqual({ groupCode: '', groupName: '', options: [{ code: 'loose-skill', name: 'Loose skill' }] });
  });

  it('filters by name or code and drops empty groups', () => {
    const groups = groupLeafOptions(['dose', 'wound', 'admin'], vocabulary);
    expect(filterOptionGroups(groups, 'WOUND').map((g) => g.groupName)).toEqual(['Patient care']);
    expect(filterOptionGroups(groups, 'dose')[0]?.options).toEqual([{ code: 'dose', name: 'Dosage calculation' }]);
    expect(filterOptionGroups(groups, '  ')).toBe(groups);
  });
});

describe('toRoleCode', () => {
  it('slugs a display name', () => {
    expect(toRoleCode('Staff Nurse (ICU)')).toBe('staff-nurse-icu');
    expect(toRoleCode('  --Ward  Manager-- ')).toBe('ward-manager');
  });
});
