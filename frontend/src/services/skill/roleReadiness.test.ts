import { describe, it, expect } from 'vitest';
import { addableRoles, buildRoleCards, nextTargets, pickRoleFramework } from './roleReadiness';
import type { CompetencyFrameworkMeta, HeldSkill, RoleGap, SkillGap } from '../../types/skillServiceTypes';

const roleGap = (role: string, over: Partial<RoleGap> = {}): RoleGap => ({
  role,
  measurable: true,
  readiness: 50,
  required: 2,
  met: 1,
  outstanding: ['b'],
  ...over,
});

const gap = (over: Partial<SkillGap> = {}): SkillGap => ({
  frameworkId: 'fw',
  current: roleGap('icu-nurse'),
  targets: [roleGap('officer')],
  resolved: true,
  ...over,
});

const meta: CompetencyFrameworkMeta = {
  frameworkId: 'fw',
  tierLabels: [],
  depth: 3,
  leafSkills: ['a', 'b'],
  // `old-role` is retired: named, but absent from the live map.
  roles: { 'icu-nurse': ['a', 'b'], officer: ['a'], supervisor: ['b'] },
  roleNames: { 'icu-nurse': 'ICU Nurse', officer: 'Nursing Officer', supervisor: 'Supervisor', 'old-role': 'Old' },
  roleCodes: ['icu-nurse', 'officer', 'supervisor'],
};

const held = (frameworkId: string): HeldSkill => ({ skillId: 'x', frameworkId, sourceType: 'COURSE', evidence: [] });

describe('pickRoleFramework', () => {
  it('uses the framework the learner roles are stored under', () => {
    expect(pickRoleFramework('fw', [held('other')])).toBe('fw');
  });

  it('falls back to the framework with the most held skills', () => {
    expect(pickRoleFramework('', [held('a'), held('b'), held('b')])).toBe('b');
  });

  it('breaks ties on id and returns undefined with no skills', () => {
    expect(pickRoleFramework('', [held('z'), held('a')])).toBe('a');
    expect(pickRoleFramework('', [])).toBeUndefined();
  });
});

describe('buildRoleCards', () => {
  it('puts the assigned role first and names each role', () => {
    const cards = buildRoleCards(gap(), meta);
    expect(cards.map((c) => [c.code, c.kind, c.name])).toEqual([
      ['icu-nurse', 'assigned', 'ICU Nurse'],
      ['officer', 'target', 'Nursing Officer'],
    ]);
  });

  it('flags a retired role and falls back to the code for an unknown one', () => {
    const cards = buildRoleCards(gap({ current: roleGap('old-role'), targets: [roleGap('mystery')] }), meta);
    expect(cards[0]).toMatchObject({ retired: true, name: 'Old' });
    expect(cards[1]).toMatchObject({ retired: false, name: 'mystery' });
  });

  it('flags nothing before the framework loads, and is empty without a gap', () => {
    expect(buildRoleCards(gap({ current: roleGap('old-role') }), undefined)[0]!.retired).toBe(false);
    expect(buildRoleCards(undefined, meta)).toEqual([]);
  });
});

describe('addableRoles', () => {
  it('offers live roles that are neither assigned nor targeted', () => {
    expect(addableRoles(meta, gap())).toEqual(['supervisor']);
  });

  it('offers every live role to a learner with no roles, and nothing without a framework', () => {
    expect(addableRoles(meta, undefined)).toEqual(meta.roleCodes);
    expect(addableRoles(undefined, gap())).toEqual([]);
  });
});

describe('nextTargets', () => {
  it('keeps the existing targets when adding one', () => {
    expect(nextTargets(gap(), { add: 'supervisor' })).toEqual(['officer', 'supervisor']);
  });

  it('removes only the one target', () => {
    expect(nextTargets(gap({ targets: [roleGap('officer'), roleGap('supervisor')] }), { remove: 'officer' })).toEqual([
      'supervisor',
    ]);
  });

  it('does not duplicate a target and works with no gap yet', () => {
    expect(nextTargets(gap(), { add: 'officer' })).toEqual(['officer']);
    expect(nextTargets(undefined, { add: 'officer' })).toEqual(['officer']);
  });
});
