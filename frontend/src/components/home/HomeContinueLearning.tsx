import { useNavigate } from "react-router-dom";
import { FiArrowRight } from "react-icons/fi";
import { Button } from "@/components/common/Button";
import { useEnrolmentsWithPathProgress } from "@/hooks/useEnrolmentsWithPathProgress";
import { useCollection } from "@/hooks/useCollection";
import { getFirstLeafContentIdFromHierarchy } from "@/services/collection/hierarchyTree";
import type { TrackableCollection } from "@/types/TrackableCollections";
import { useAppI18n } from '@/hooks/useAppI18n';
import { getPlaceholderImage } from '@/utils/getPlaceholderImage';
import { getContentDetailPath } from '@/utils/getContentDetailPath';
import { parseCourseContextId } from '@/services/viewer/summaryMapper';

// Circular progress component
const CircularProgress = ({ progress }: { progress: number }) => {
    const size = 24;
    const strokeWidth = 4;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle (non-completed) */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                className="stroke-sunbird-theme-accent-muted/40"
                strokeWidth={strokeWidth}
            />
            {/* Progress circle (completed) */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                className="stroke-sunbird-theme-accent"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
            />
        </svg>
    );
};

const HomeContinueLearning = () => {
    const { t } = useAppI18n();
    const navigate = useNavigate();
    const { courses, isLoading } = useEnrolmentsWithPathProgress();

    const lastAccessedCourse: TrackableCollection | undefined = courses
        // Enrolling in a Learning Path fans out per-course records with a composite
        // "<lpBatchId>:<courseId>" batchId - strip those, or a course inside an
        // enrolled Learning Path can outrank the path's own record here and get
        // treated as a plain Course (isLearningPath below reads its primaryCategory,
        // which is "Course"), building a broken /collection/.../batch/<composite> URL.
        .filter((c: TrackableCollection) => !parseCourseContextId(c.batchId))
        .filter((c: TrackableCollection) => c.completionPercentage < 100)
        .sort((a: TrackableCollection, b: TrackableCollection) =>
            (b.lastContentAccessTime ?? 0) - (a.lastContentAccessTime ?? 0)
        )[0];

    const isLearningPath = (lastAccessedCourse?.content?.primaryCategory ?? '').toLowerCase() === 'learning path';
    const { data: collectionData } = useCollection(lastAccessedCourse?.courseId);

    if (isLoading || !lastAccessedCourse) return null;

    // A Learning Path resumes to its own Ledger overview - the resume-target
    // logic there (useLearningPath's getResumeTarget) resolves the right
    // inner course/content, which a bare content URL here cannot reach.
    let continueTo: string;
    if (isLearningPath) {
        continueTo = getContentDetailPath(lastAccessedCourse.courseId, lastAccessedCourse.content?.primaryCategory, lastAccessedCourse.batchId);
    } else {
        const contentId = lastAccessedCourse?.lastReadContentId
            ?? getFirstLeafContentIdFromHierarchy(collectionData?.hierarchyRoot ?? null);
        if (!contentId) return null;
        continueTo = `/collection/${lastAccessedCourse.courseId}/batch/${lastAccessedCourse.batchId}/content/${contentId}`;
    }

    const thumbnail = lastAccessedCourse.content?.posterImage || lastAccessedCourse.content?.appIcon || lastAccessedCourse.courseLogoUrl;
    const title = lastAccessedCourse.courseName || lastAccessedCourse.content?.name || "Untitled Course";

    return (
        <div className="home-continue-section">
            <h3 className="home-continue-section-title">{t('homeComponents.continueLearning')}</h3>
            <div className="home-continue-grid">
                <div className="w-full lg:w-[65%]">
                    <div className="home-continue-learning-card">
                        <div className="home-continue-learning-inner">
                            {/* Thumbnail */}
                            <div className="home-continue-learning-thumbnail">
                                <img
                                    src={thumbnail || getPlaceholderImage(lastAccessedCourse.courseId)}
                                    alt={title}
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            {/* Content */}
                            <div className="home-continue-learning-content">
                                <div>
                                    <h4 className="home-continue-learning-title">
                                        {title}
                                    </h4>
                                </div>
                                {/* Progress */}
                                <div className="home-continue-learning-progress">
                                    <CircularProgress progress={lastAccessedCourse.completionPercentage} />
                                    <span className="home-continue-learning-progress-label">
                                        {t("courseDetails.contentStatusCompleted")} : {lastAccessedCourse.completionPercentage}%
                                    </span>
                                </div>

                                {/* CTA Button */}
                                <div className="home-continue-learning-cta">
                                    <Button
                                        onClick={() => navigate(continueTo, { state: { from: '/home' } })}
                                        className="home-continue-learning-btn group"
                                    >
                                        {t("homeComponents.continueLearning")}
                                        <FiArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomeContinueLearning;
