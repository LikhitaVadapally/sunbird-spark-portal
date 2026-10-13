import type { HeldSkill, SkillEvidence } from '../../types/skillServiceTypes';
import type { PathSkillSummary, SkillAggregate } from '../learningPath/skillAggregation';

/**
 * THE MY SKILLS RULE - one pure place, so My Skills, the Learning Path pages and the mobile app
 * all count the same thing.
 *
 *   GAINED  = every skill in the learner's skill profile (`profile/read`), whatever earned it:
 *             a path course, a standalone course, an assessment or an external certificate.
 *   PENDING = codes tagged on courses the learner has not finished, in Learning Paths they are
 *             enrolled in (an untagged course falls back to its Level's tags), MINUS every
 *             gained code. A skill held from anywhere is never pending.
 *
 * Everything is keyed by skill CODE. Display names come from the framework afterwards.
 */

export type SkillSourceKind = 'course' | 'assessment' | 'learningPath' | 'external' | 'other';

const SOURCE_KINDS: Record<string, SkillSourceKind> = {
  COURSE: 'course',
  ASSESSMENT: 'assessment',
  LEARNING_PATH: 'learningPath',
  EXTERNAL: 'external',
};

/** Profile `sourceType` -> the kind the card labels. Unknown values stay visible as 'other'. */
export function toSourceKind(sourceType: string | undefined): SkillSourceKind {
  return SOURCE_KINDS[(sourceType ?? '').toUpperCase()] ?? 'other';
}

/** A path a skill belongs to - enough to link to its status page. */
export interface SkillPathRef {
  pathId: string;
  contextId?: string;
  pathName: string;
}

export interface MySkillEntry {
  code: string;
  /** From the profile for a gained skill, else from the path that teaches it. Names only. */
  frameworkId?: string;
  gained: boolean;
  /** Gained only: how the profile says it was earned. */
  source?: SkillSourceKind;
  /** Gained only: when it was attained, falling back to the earliest evidence. */
  gainedAt?: number;
  /** Gained only: what proved it. */
  evidence: SkillEvidence[];
  /**
   * Enrolled paths involved. For a pending skill: the paths where it is still to do. For a gained
   * skill: every enrolled path that also teaches it.
   */
  paths: SkillPathRef[];
}

function earliest(...values: Array<number | undefined>): number | undefined {
  const defined = values.filter((v): v is number => typeof v === 'number');
  return defined.length > 0 ? Math.min(...defined) : undefined;
}

function pathRef(summary: PathSkillSummary): SkillPathRef {
  return {
    pathId: summary.pathId,
    ...(summary.contextId ? { contextId: summary.contextId } : {}),
    pathName: summary.pathName,
  };
}

/** The set of codes the learner holds - the "already gained" baseline everywhere. */
export function heldCodeSet(held: HeldSkill[]): Set<string> {
  return new Set(held.map((skill) => skill.skillId).filter(Boolean));
}

/**
 * Applies the rule. Gained skills first (most recent first), then pending ones by code.
 *
 * A code held under two frameworks is one skill: its evidence is merged and the earliest date
 * wins. A code pending in two paths is one skill carrying both paths.
 */
export function buildMySkills(held: HeldSkill[], paths: PathSkillSummary[]): MySkillEntry[] {
  const byCode = new Map<string, MySkillEntry>();

  held.forEach((skill) => {
    if (!skill.skillId) return;
    const attained = earliest(skill.attainedOn, ...skill.evidence.map((e) => e.occurredOn));
    const existing = byCode.get(skill.skillId);
    if (existing) {
      existing.evidence = [...existing.evidence, ...skill.evidence];
      existing.gainedAt = earliest(existing.gainedAt, attained);
      return;
    }
    byCode.set(skill.skillId, {
      code: skill.skillId,
      ...(skill.frameworkId ? { frameworkId: skill.frameworkId } : {}),
      gained: true,
      source: toSourceKind(skill.sourceType),
      ...(attained !== undefined ? { gainedAt: attained } : {}),
      evidence: skill.evidence,
      paths: [],
    });
  });

  paths.forEach((summary) => {
    const ref = pathRef(summary);
    const unfinished = new Set(summary.unfinishedCodes);
    summary.taughtCodes.forEach((code) => {
      const entry = byCode.get(code);
      if (entry?.gained && !entry.paths.some((p) => p.pathId === ref.pathId)) entry.paths.push(ref);
    });
    unfinished.forEach((code) => {
      const entry = byCode.get(code);
      if (entry?.gained) return;
      if (entry) {
        if (!entry.paths.some((p) => p.pathId === ref.pathId)) entry.paths.push(ref);
        return;
      }
      byCode.set(code, {
        code,
        ...(summary.frameworkId ? { frameworkId: summary.frameworkId } : {}),
        gained: false,
        evidence: [],
        paths: [ref],
      });
    });
  });

  return [...byCode.values()].sort(
    (a, b) =>
      Number(b.gained) - Number(a.gained) || (b.gainedAt ?? 0) - (a.gainedAt ?? 0) || a.code.localeCompare(b.code)
  );
}

/** Hero tallies. "X of Y" is gained / (gained + pending). */
export function aggregateMySkills(entries: MySkillEntry[], paths: PathSkillSummary[]): SkillAggregate {
  const gained = entries.filter((e) => e.gained).length;
  const pending = entries.length - gained;
  return {
    totalSkills: entries.length,
    gainedSkills: gained,
    pendingSkills: pending,
    pathsCompleted: paths.filter((p) => p.status === 'completed').length,
    pathsOngoing: paths.filter((p) => p.status === 'ongoing').length,
  };
}

export type SkillStatusFilter = 'all' | 'gained' | 'pending';

export interface MySkillFilters {
  query?: string;
  status?: SkillStatusFilter;
  /** Group label to narrow to; empty/undefined for all groups. */
  group?: string;
  /** Resolved name and group for a code - search and the group filter work on what is shown. */
  labelOf: (entry: MySkillEntry) => { name: string; group?: string };
}

/** Narrows the list by free text (skill name, group or path), status and group. */
export function filterMySkills(entries: MySkillEntry[], filters: MySkillFilters): MySkillEntry[] {
  const query = (filters.query ?? '').trim().toLowerCase();
  const status = filters.status ?? 'all';

  return entries.filter((entry) => {
    if (status === 'gained' && !entry.gained) return false;
    if (status === 'pending' && entry.gained) return false;
    const label = filters.labelOf(entry);
    if (filters.group && label.group !== filters.group) return false;
    if (!query) return true;
    return (
      label.name.toLowerCase().includes(query) ||
      entry.code.toLowerCase().includes(query) ||
      (label.group ?? '').toLowerCase().includes(query) ||
      entry.paths.some((p) => p.pathName.toLowerCase().includes(query))
    );
  });
}

/** Most recently gained first. Skills with no date are omitted - their order would be a guess. */
export function getRecentlyGainedSkills(entries: MySkillEntry[], limit = 5): MySkillEntry[] {
  return entries
    .filter((entry) => entry.gained && entry.gainedAt !== undefined)
    .sort((a, b) => (b.gainedAt ?? 0) - (a.gainedAt ?? 0))
    .slice(0, limit);
}

/** Skills taught by more than one enrolled path - what the learner's plan reinforces most. */
export function getMostReinforcedSkills(entries: MySkillEntry[], limit = 5): MySkillEntry[] {
  return entries
    .filter((entry) => entry.paths.length > 1)
    .sort((a, b) => b.paths.length - a.paths.length || a.code.localeCompare(b.code))
    .slice(0, limit);
}
