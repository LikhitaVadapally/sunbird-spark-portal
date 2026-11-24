import { useMemo } from 'react';
import { useUserEnrolledCollections } from './useUserEnrolledCollections';
import { useViewerSummary } from './useViewerSummary';
import { withPathProgress } from '@/services/learningPath/enrolmentProgress';
import type { TrackableCollection } from '@/types/TrackableCollections';

/**
 * The learner's lern enrolments with each learning path's completion taken from its Viewer
 * summary, the source the path page reads. lern's own figure for a path lags (a finished path
 * still read 50%), so anything showing a path's progress should read enrolments through this.
 */
export function useEnrolmentsWithPathProgress(): { courses: TrackableCollection[]; isLoading: boolean } {
  const { data, isLoading: enrolmentsLoading } = useUserEnrolledCollections();
  const { data: summaries = [], isLoading: summariesLoading } = useViewerSummary();
  const courses = useMemo(() => withPathProgress(data?.data?.courses ?? [], summaries), [data, summaries]);
  return { courses, isLoading: enrolmentsLoading || summariesLoading };
}
