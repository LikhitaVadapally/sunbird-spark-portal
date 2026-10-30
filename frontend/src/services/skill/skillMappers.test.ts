import { describe, it, expect } from 'vitest';
import {
  normaliseProfile,
  normaliseGap,
  normaliseRecommendation,
  normaliseFrameworkMeta,
} from './skillMappers';

describe('normaliseProfile', () => {
  // AxiosAdapter.mapResponse strips `result` before a mapper sees the body, so this - not
  // the enveloped form - is what actually arrives. Getting it wrong rendered an empty
  // passbook against a good 200, twice, during the v1 work.
  it('reads the unwrapped shape the adapter delivers', () => {
    const out = normaliseProfile({
      count: 1,
      skills: [
        {
          skillId: 'dosage-calculation',
          frameworkId: 'fw',
          sourceType: 'COURSE',
          attainedOn: '2026-09-08T07:20:02.000Z',
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.skillId).toBe('dosage-calculation');
    expect(out[0]!.attainedOn).toBe(Date.parse('2026-09-08T07:20:02.000Z'));
  });

  it('still reads the enveloped shape', () => {
    expect(normaliseProfile({ result: { skills: [{ skillId: 'a' }] } })).toHaveLength(1);
  });

  it('drops entries with no skillId', () => {
    const out = normaliseProfile({ skills: [{ sourceType: 'COURSE' }, { skillId: 'a' }] });
    expect(out.map((s) => s.skillId)).toEqual(['a']);
  });

  // Revocation is the only way a skill leaves the profile, so a revoked row must not be
  // shown as proof of one that remains.
  it('excludes revoked evidence', () => {
    const out = normaliseProfile({
      skills: [
        {
          skillId: 'a',
          evidence: [
            { evidenceId: 'e1', sourceType: 'COURSE', sourceId: 'c1' },
            { evidenceId: 'e2', sourceType: 'COURSE', sourceId: 'c2', revoked: true },
          ],
        },
      ],
    });
    expect(out[0]!.evidence.map((e) => e.evidenceId)).toEqual(['e1']);
  });

  it('collapses many rows describing one fact', () => {
    const out = normaliseProfile({
      skills: [
        {
          skillId: 'a',
          evidence: [
            { evidenceId: 'e1', sourceType: 'COURSE', sourceId: 'c1' },
            { evidenceId: 'e2', sourceType: 'COURSE', sourceId: 'c1' },
            { evidenceId: 'e3', sourceType: 'ASSESSMENT', sourceId: 'qs1', score: 1, maxScore: 1 },
          ],
        },
      ],
    });
    expect(out[0]!.evidence).toHaveLength(2);
  });

  it('ignores an unparseable date instead of emitting NaN', () => {
    expect(normaliseProfile({ skills: [{ skillId: 'a', attainedOn: 'nope' }] })[0]!.attainedOn).toBeUndefined();
  });

  it.each([undefined, null, {}, { result: {} }])('returns [] for %s', (input) => {
    expect(normaliseProfile(input as never)).toEqual([]);
  });
});

describe('normaliseGap', () => {
  const full = {
    frameworkId: 'fw',
    current: { role: 'staff-nurse', readiness: 100, required: 3, met: 3, gap: [], outstanding: [] },
    targets: [
      {
        role: 'nursing-officer',
        readiness: 50,
        required: 4,
        met: 2,
        gap: [
          { skillId: 'a', status: 'MET' },
          { skillId: 'b', status: 'MISSING' },
        ],
        outstanding: ['b', 'c'],
      },
    ],
  };

  it('maps current and targets from the unwrapped shape', () => {
    const g = normaliseGap(full);
    expect(g.resolved).toBe(true);
    expect(g.current?.role).toBe('staff-nurse');
    expect(g.targets).toHaveLength(1);
    expect(g.targets[0]!.outstanding).toEqual(['b', 'c']);
  });

  it('still reads the enveloped shape', () => {
    expect(normaliseGap({ result: full }).current?.role).toBe('staff-nurse');
  });

  // current is null for any learner an HR feed has not touched - it is an assignment, not
  // a choice - and that is distinct from a role at 0%.
  it('leaves current undefined when the service returns null', () => {
    const g = normaliseGap({ frameworkId: 'fw', current: null, targets: [] });
    expect(g.current).toBeUndefined();
    expect(g.resolved).toBe(true);
  });

  // No framework resolved means "unknown", which must never render as 0% ready.
  it('marks an unresolved response so nothing is shown as a score', () => {
    const g = normaliseGap({ frameworkId: '', current: null, targets: [] });
    expect(g.resolved).toBe(false);
    expect(g.current).toBeUndefined();
    expect(g.targets).toEqual([]);
  });

  it('keeps resolved=true for a genuine 0% against a real role', () => {
    const g = normaliseGap({
      frameworkId: 'fw',
      current: { role: 'r', readiness: 0, required: 5, met: 0, outstanding: ['a'] },
      targets: [],
    });
    expect(g.resolved).toBe(true);
    expect(g.current?.readiness).toBe(0);
  });

  // A retired or skill-less role comes back unresolved with a null readiness: not 0%, not 100%.
  it('marks a role the service could not measure', () => {
    const g = normaliseGap({
      frameworkId: 'fw',
      current: { role: 'gone', resolved: false, readiness: null, required: 0, met: 0, gap: [], outstanding: [] },
      targets: [{ role: 'r', resolved: true, readiness: 40, required: 5, met: 2, outstanding: ['a'] }],
    });
    expect(g.current?.measurable).toBe(false);
    expect(g.current?.readiness).toBe(0);
    expect(g.targets[0]!.measurable).toBe(true);
  });

  it('treats a numeric readiness as measured when an older build omits resolved', () => {
    expect(normaliseGap(full).current?.measurable).toBe(true);
  });

  it('lists the skills already held from the MET rows', () => {
    const g = normaliseGap({
      frameworkId: 'fw',
      targets: [
        {
          role: 'r',
          resolved: true,
          readiness: 50,
          required: 2,
          met: 1,
          gap: [
            { skillId: 'a', status: 'MET' },
            { skillId: 'b', status: 'MISSING' },
          ],
          outstanding: ['b'],
        },
      ],
    });
    expect(g.targets[0]!.held).toEqual(['a']);
  });

  // A build that omits `outstanding` should still tell the learner what is missing.
  it('derives outstanding from the gap rows when the field is absent', () => {
    const g = normaliseGap({
      frameworkId: 'fw',
      current: { role: 'r', gap: [{ skillId: 'a', status: 'MET' }, { skillId: 'b', status: 'MISSING' }] },
      targets: [],
    });
    expect(g.current?.outstanding).toEqual(['b']);
  });

  it('drops a role entry with no role code', () => {
    const g = normaliseGap({ frameworkId: 'fw', targets: [{ readiness: 50 }, { role: 'r' }] });
    expect(g.targets.map((r) => r.role)).toEqual(['r']);
  });

  it.each([undefined, null, {}])('returns an unresolved gap for %s', (input) => {
    expect(normaliseGap(input as never).resolved).toBe(false);
  });
});

describe('normaliseRecommendation', () => {
  it('preserves the service ranking rather than re-sorting', () => {
    const r = normaliseRecommendation({
      role: 'nursing-officer',
      frameworkId: 'fw',
      skills: ['a', 'b'],
      candidates: [
        { identifier: 'c1', name: 'Low cover first', primaryCategory: 'Course', gapCovered: 1, totalSkills: 1 },
        { identifier: 'c2', name: 'High cover second', primaryCategory: 'Course', gapCovered: 5, totalSkills: 5 },
      ],
    });
    // the service weighs effort after waiving, which the client cannot see
    expect(r.candidates.map((c) => c.identifier)).toEqual(['c1', 'c2']);
  });

  it('drops candidates that close nothing', () => {
    const r = normaliseRecommendation({
      candidates: [
        { identifier: 'c1', gapCovered: 0, totalSkills: 3 },
        { identifier: 'c2', gapCovered: 2, totalSkills: 3 },
      ],
      role: 'r',
    });
    expect(r.candidates.map((c) => c.identifier)).toEqual(['c2']);
  });

  it('drops a candidate with no identifier', () => {
    const r = normaliseRecommendation({ candidates: [{ name: 'no id', gapCovered: 2 }], role: 'r' });
    expect(r.candidates).toEqual([]);
  });

  it('still reads the enveloped shape', () => {
    const r = normaliseRecommendation({ result: { role: 'r', candidates: [{ identifier: 'c', gapCovered: 1 }] } });
    expect(r.role).toBe('r');
    expect(r.candidates).toHaveLength(1);
  });

  it.each([undefined, null, {}])('returns an empty recommendation for %s', (input) => {
    const r = normaliseRecommendation(input as never);
    expect(r.candidates).toEqual([]);
    expect(r.outstanding).toEqual([]);
  });
});

describe('normaliseFrameworkMeta', () => {
  const body = {
    frameworkId: 'fw',
    tierLabels: ['Competency area', 'Competency', 'Skill'],
    depth: 3,
    leafSkills: ['a', 'b'],
    roles: { 'staff-nurse': ['a'], 'empty-role': [] },
  };

  it('lists only roles requiring at least one skill, sorted', () => {
    // a role requiring nothing reports 100% ready for everyone
    expect(normaliseFrameworkMeta(body)?.roleCodes).toEqual(['staff-nurse']);
  });

  it('keeps tier labels and depth', () => {
    const m = normaliseFrameworkMeta(body);
    expect(m?.tierLabels[0]).toBe('Competency area');
    expect(m?.depth).toBe(3);
  });

  it('still reads the enveloped shape', () => {
    expect(normaliseFrameworkMeta({ result: body })?.frameworkId).toBe('fw');
  });

  it('is undefined without a frameworkId, so callers can tell it did not resolve', () => {
    expect(normaliseFrameworkMeta({ result: {} })).toBeUndefined();
    expect(normaliseFrameworkMeta(undefined)).toBeUndefined();
  });
});
