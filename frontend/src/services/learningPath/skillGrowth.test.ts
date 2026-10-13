import { describe, it, expect } from 'vitest';
import { buildSkillGrowthSeries } from './skillGrowth';
import type { DatedSkill } from './skillGrowth';

function entry(overrides: Partial<DatedSkill> & { skill: string }): DatedSkill & { skill: string } {
  return {
    gained: true,
    ...overrides,
  };
}

const DAY_MS = 86_400_000;

describe('buildSkillGrowthSeries', () => {
  it('returns no points for no entries', () => {
    expect(buildSkillGrowthSeries([])).toEqual({ points: [], undatedCount: 0 });
  });

  it('returns no points when fewer than two distinct days are represented', () => {
    const result = buildSkillGrowthSeries([
      entry({ skill: 'SQL', gainedAt: 1_000 }),
      entry({ skill: 'Python', gainedAt: 2_000 }),
    ]);
    expect(result.points).toEqual([]);
    expect(result.undatedCount).toBe(0);
  });

  it('accumulates across distinct days in order', () => {
    const day1 = 10 * DAY_MS;
    const day2 = 12 * DAY_MS;
    const day3 = 15 * DAY_MS;

    const result = buildSkillGrowthSeries([
      entry({ skill: 'SQL', gainedAt: day1 + 1_000 }),
      entry({ skill: 'Python', gainedAt: day1 + 2_000 }),
      entry({ skill: 'ML', gainedAt: day2 }),
      entry({ skill: 'Cloud', gainedAt: day3 }),
    ]);

    expect(result.points).toEqual([
      { date: day1, label: expect.any(String), cumulative: 2 },
      { date: day2, label: expect.any(String), cumulative: 3 },
      { date: day3, label: expect.any(String), cumulative: 4 },
    ]);
    expect(result.undatedCount).toBe(0);
  });

  it('buckets same-day gains into one point', () => {
    const day1 = 20 * DAY_MS;
    const result = buildSkillGrowthSeries([
      entry({ skill: 'SQL', gainedAt: day1 }),
      entry({ skill: 'Python', gainedAt: day1 + 1_000 }),
      entry({ skill: 'ML', gainedAt: day1 + 90 * 60 * 1000 }),
      entry({ skill: 'Cloud', gainedAt: day1 + DAY_MS }),
    ]);
    expect(result.points).toHaveLength(2);
    expect(result.points[0]?.cumulative).toBe(3);
    expect(result.points[1]?.cumulative).toBe(4);
  });

  it('counts gained skills with no gainedAt as undated, and excludes them from the line', () => {
    const day1 = 5 * DAY_MS;
    const day2 = 6 * DAY_MS;
    const result = buildSkillGrowthSeries([
      entry({ skill: 'SQL', gainedAt: day1 }),
      entry({ skill: 'Python', gainedAt: day2 }),
      entry({ skill: 'Mystery', gainedAt: undefined }),
    ]);
    expect(result.points).toHaveLength(2);
    expect(result.undatedCount).toBe(1);
  });

  it('ignores skills that are not gained at all', () => {
    const day1 = 5 * DAY_MS;
    const day2 = 6 * DAY_MS;
    const result = buildSkillGrowthSeries([
      entry({ skill: 'SQL', gainedAt: day1 }),
      entry({ skill: 'Python', gainedAt: day2 }),
      entry({ skill: 'Pending', gained: false, gainedAt: undefined }),
    ]);
    expect(result.points).toHaveLength(2);
    expect(result.undatedCount).toBe(0);
  });
});
