import type { TrackableCollection } from '@/types/TrackableCollections';
import type { ViewerSummaryRecord } from '@/types/viewerServiceTypes';
import { getPathSummary } from '@/services/viewer/summaryMapper';
import { isLearningPathCategory } from '@/utils/isLearningPath';
import { pathCompletionPct } from './learningPathProgress';

/**
 * A learning path's completion from the Viewer summary, the source its own page reads. lern's
 * enrolment record for the path lags or counts differently (25% where the path page showed 75%),
 * so My Learning would disagree with the path page. Same calculation as the path page
 * (pathCompletionPct); courses and paths without a summary record keep lern's figure.
 */
export function withPathProgress(
  enrolments: TrackableCollection[],
  summaries: ViewerSummaryRecord[],
): TrackableCollection[] {
  if (!summaries.length) return enrolments;
  return enrolments.map((e) => {
    if (!isLearningPathCategory(e.content?.primaryCategory)) return e;
    const summary = getPathSummary(summaries, e.courseId, e.batchId);
    if (!summary) return e;
    const pct = pathCompletionPct(summary, e.leafNodesCount);
    return pct !== e.completionPercentage ? { ...e, completionPercentage: pct } : e;
  });
}
