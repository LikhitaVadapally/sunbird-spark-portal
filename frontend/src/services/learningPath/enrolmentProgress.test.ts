import { describe, it, expect } from 'vitest';
import { withPathProgress } from './enrolmentProgress';
import type { TrackableCollection } from '@/types/TrackableCollections';
import type { ViewerSummaryRecord } from '@/types/viewerServiceTypes';

const enrolment = (courseId: string, primaryCategory: string, completionPercentage: number) =>
  ({ courseId, batchId: 'b1', completionPercentage, leafNodesCount: 4, content: { primaryCategory } }) as unknown as TrackableCollection;
const summary = (collectionId: string, completionPercentage?: number, contentStatus: Record<string, number> = {}) =>
  ({ userId: 'u', collectionId, contextId: 'b1', active: true, status: 1, progress: 0, completionPercentage, contentStatus }) as ViewerSummaryRecord;

describe('withPathProgress', () => {
  // Regression: My Learning showed lern's 25% for a path whose own page showed 75%.
  it("takes a learning path's completion from its Viewer summary", () => {
    const [path] = withPathProgress([enrolment('lp1', 'Learning Path', 25)], [summary('lp1', 75)]);
    expect(path?.completionPercentage).toBe(75);
  });

  // The live service sends no completionPercentage: count completed leaves, as the path page does.
  it('counts completed leaves when the summary has no percentage', () => {
    const [path] = withPathProgress(
      [enrolment('lp1', 'Learning Path', 25)],
      [summary('lp1', undefined, { a: 2, b: 2, c: 2, d: 1 })],
    );
    expect(path?.completionPercentage).toBe(75);
  });

  it("leaves courses on lern's figure", () => {
    const course = enrolment('c1', 'Course', 40);
    expect(withPathProgress([course], [summary('c1', 90)])[0]).toBe(course);
  });

  it("keeps lern's figure when the path has no summary record", () => {
    const path = enrolment('lp1', 'Learning Path', 25);
    expect(withPathProgress([path], [])[0]).toBe(path);
    expect(withPathProgress([path], [summary('other', 80)])[0]).toBe(path);
  });
});
