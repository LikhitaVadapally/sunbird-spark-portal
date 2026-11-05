/** Anything that can be gained on a date - a My Skills entry, in practice. */
export interface DatedSkill {
  gained: boolean;
  gainedAt?: number;
}

/** One point on the cumulative skills-gained trend — a day, and the running total through it. */
export interface SkillGrowthPoint {
  date: number;
  label: string;
  cumulative: number;
}

export interface SkillGrowthSeries {
  points: SkillGrowthPoint[];
  /** Gained skills with no usable `gainedAt` — omitted from the line, never silently dropped. */
  undatedCount: number;
}

const DAY_MS = 86_400_000;

function dayLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * A cumulative "skills gained over time" trend — the honest substitute for a
 * numeric skill score, which our data doesn't have. Buckets every gained
 * skill's `gainedAt` by day, then accumulates.
 *
 * Renders no points when fewer than two distinct days are represented: a
 * single-point "trend" would be noise, not a line.
 */
export function buildSkillGrowthSeries(entries: DatedSkill[]): SkillGrowthSeries {
  const dated = entries.filter(
    (entry): entry is DatedSkill & { gainedAt: number } => entry.gained && entry.gainedAt !== undefined
  );
  const undatedCount = entries.filter((entry) => entry.gained && entry.gainedAt === undefined).length;

  const countByDay = new Map<number, number>();
  dated.forEach((entry) => {
    const day = Math.floor(entry.gainedAt / DAY_MS) * DAY_MS;
    countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
  });

  const days = [...countByDay.keys()].sort((a, b) => a - b);
  if (days.length < 2) return { points: [], undatedCount };

  let cumulative = 0;
  const points: SkillGrowthPoint[] = days.map((day) => {
    cumulative += countByDay.get(day) ?? 0;
    return { date: day, label: dayLabel(day), cumulative };
  });

  return { points, undatedCount };
}
