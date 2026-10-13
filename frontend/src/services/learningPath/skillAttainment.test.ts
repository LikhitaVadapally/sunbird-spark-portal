import { describe, it, expect } from 'vitest';
import { getAttainedLevels } from './skillAttainment';
import type { LevelProgressInfo } from '../../types/learningPathTypes';

function progress(pct: number): LevelProgressInfo {
  return { pct, completed: 0, total: 1, doneCourses: 0 };
}

describe('getAttainedLevels', () => {
  it('returns an empty array for no levels', () => {
    expect(getAttainedLevels([], [])).toEqual([]);
  });

  it('attains a level at 100% progress', () => {
    expect(getAttainedLevels([progress(100), progress(99), progress(0)], ['active', 'active', 'notStarted'])).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('attains a waived or credited level regardless of progress', () => {
    expect(getAttainedLevels([progress(0), progress(0), progress(0)], ['waived', 'credited', 'creditedPending'])).toEqual(
      [true, true, false]
    );
  });

  // The status page reports what was earned, so the policy's unlock gate must not hide a
  // level the learner has actually finished.
  it('ignores the locked status when the level is complete', () => {
    expect(getAttainedLevels([progress(100)], ['locked'])).toEqual([true]);
  });

  it('treats a missing status entry as not attained when progress is incomplete', () => {
    expect(getAttainedLevels([progress(50)], [])).toEqual([false]);
  });
});
