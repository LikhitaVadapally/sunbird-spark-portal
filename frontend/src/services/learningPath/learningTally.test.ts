import { describe, it, expect } from 'vitest';
import { tallyLearning, sumOf } from './learningTally';
import type { TrackableCollection } from '@/types/TrackableCollections';

const rec = (over: Partial<TrackableCollection> & { category?: string }) =>
  ({ courseId: 'x', batchId: 'b', status: 0, completionPercentage: 0, leafNodesCount: 1,
     content: { primaryCategory: over.category ?? 'Course' }, ...over }) as unknown as TrackableCollection;

describe('tallyLearning', () => {
  it('counts courses and paths once each, by status', () => {
    const t = tallyLearning([
      rec({ courseId: 'c1', status: 0 }),
      rec({ courseId: 'c2', status: 1, completionPercentage: 40 }),
      rec({ courseId: 'c3', status: 2, completionPercentage: 100 }),
      rec({ courseId: 'lp1', status: 1, completionPercentage: 30, category: 'Learning Path' }),
    ], []);
    expect(t.total).toEqual({ paths: 1, courses: 3 });
    expect(t.inProgress).toEqual({ paths: 1, courses: 1 });
    expect(t.completed).toEqual({ paths: 0, courses: 1 });
    expect(sumOf(t.total)).toBe(4);
  });

  it("leaves out a path enrolment's per-course records", () => {
    const t = tallyLearning([
      rec({ courseId: 'lp1', batchId: 'b1', status: 1, category: 'Learning Path' }),
      rec({ courseId: 'c1', batchId: 'b1:c1', status: 2, completionPercentage: 100 }),
    ], []);
    expect(t.total).toEqual({ paths: 1, courses: 0 });
  });

  it('counts a record with progress but status 0 as in progress', () => {
    expect(tallyLearning([rec({ status: 0, completionPercentage: 20 })], []).inProgress.courses).toBe(1);
  });
});
