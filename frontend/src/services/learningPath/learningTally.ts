import type { TrackableCollection } from "@/types/TrackableCollections";
import type { ViewerSummaryRecord } from "@/types/viewerServiceTypes";
import { parseCourseContextId } from "@/services/viewer/summaryMapper";
import { withPathProgress } from "@/services/learningPath/enrolmentProgress";
import { isLearningPathCategory } from "@/utils/isLearningPath";

interface Split {
    paths: number;
    courses: number;
}
export interface LearningTally {
    total: Split;
    inProgress: Split;
    completed: Split;
}

const empty = (): Split => ({ paths: 0, courses: 0 });

/**
 * What the learner enrolled in, counted once each: standalone courses and learning paths. The
 * per-course records a path enrolment fans out ("<lpBatchId>:<courseId>" batch ids) are left out,
 * as in the learning list, and a path's progress comes from its Viewer summary. Counting every
 * lern record showed 5 courses, 1 in progress and 3 completed for one finished path.
 */
export function tallyLearning(enrolments: TrackableCollection[], summaries: ViewerSummaryRecord[]): LearningTally {
    const tally: LearningTally = { total: empty(), inProgress: empty(), completed: empty() };
    withPathProgress(enrolments, summaries)
        .filter((e) => !parseCourseContextId(e.batchId))
        .forEach((e) => {
            const kind: keyof Split = isLearningPathCategory(e.content?.primaryCategory) ? "paths" : "courses";
            const pct = e.completionPercentage ?? 0;
            tally.total[kind] += 1;
            if (e.status === 2 || pct >= 100) tally.completed[kind] += 1;
            else if (e.status === 1 || pct > 0) tally.inProgress[kind] += 1;
        });
    return tally;
}

export const sumOf = (split: Split): number => split.paths + split.courses;
