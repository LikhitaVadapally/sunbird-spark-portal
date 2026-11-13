import type { FrameworkLevel } from '@/services/CompetencyFrameworkService';

export const MAX_LEVELS = 5;

// A level code becomes a Knowlg category code and, for the last level, the content field courses
// carry skill tags in, so it is kept to a plain field name.
const CODE_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

/**
 * Codes a level may not use: fields a course already has. The last level's code is the field a
 * course's skills are saved in, so e.g. `subject` would write skills over the curriculum subject.
 * `skill` is allowed: it is the default and the field lern has always read.
 */
const RESERVED_CODES = new Set([
  'name', 'code', 'description', 'status', 'identifier', 'channel', 'framework', 'board', 'medium',
  'gradelevel', 'subject', 'topic', 'industry', 'domain', 'keywords', 'language', 'audience',
  'competencies', 'competencyframework', 'targetrole', 'primarycategory', 'contenttype',
  'objecttype', 'mimetype', 'author', 'creator', 'license',
]);

export type LevelError = 'empty' | 'invalid' | 'reserved' | 'duplicate';

/** The code a level name suggests: lowercase letters and digits ("Competency Area" -> competencyarea). */
export const levelCodeFromName = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^[0-9]+/, '');

/** One entry per level: what is wrong with it, or undefined. */
export function levelErrors(levels: readonly FrameworkLevel[]): Array<LevelError | undefined> {
  const counts = new Map<string, number>();
  levels.forEach((l) => counts.set(l.code.toLowerCase(), (counts.get(l.code.toLowerCase()) ?? 0) + 1));
  return levels.map((l) => {
    if (!l.name.trim() || !l.code) return 'empty';
    if (!CODE_PATTERN.test(l.code)) return 'invalid';
    if (RESERVED_CODES.has(l.code.toLowerCase())) return 'reserved';
    if ((counts.get(l.code.toLowerCase()) ?? 0) > 1) return 'duplicate';
    return undefined;
  });
}

export const levelsValid = (levels: readonly FrameworkLevel[]): boolean =>
  levels.length > 0 && levels.length <= MAX_LEVELS && levelErrors(levels).every((e) => !e);
