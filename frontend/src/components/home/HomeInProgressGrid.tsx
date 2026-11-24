import { Link } from "react-router-dom";
import { useEnrolmentsWithPathProgress } from "@/hooks/useEnrolmentsWithPathProgress";
import type { TrackableCollection } from "../../types/TrackableCollections";
import { useAppI18n } from '@/hooks/useAppI18n';
import { getPlaceholderImage } from '@/utils/getPlaceholderImage';
import { getCategoryLabel } from '@/utils/i18nUtils';
import { getContentDetailPath } from '@/utils/getContentDetailPath';
import { parseCourseContextId } from '@/services/viewer/summaryMapper';

const HomeInProgressGrid = () => {
    const { t } = useAppI18n();
    const { courses, isLoading } = useEnrolmentsWithPathProgress();

    if (isLoading) {
        return (
            <section className="mb-8">
                <h3 className="home-section-title-large mb-4">{t('homeComponents.inProgress')}</h3>
                <div className="text-center py-8 text-sunbird-gray-77">{t('loading')}</div>
            </section>
        );
    }

    const inProgressCourses: TrackableCollection[] = courses
        .filter((course: TrackableCollection) => course.status === 1 && course.completionPercentage < 100)
        // Enrolling in a Learning Path fans out per-course records with a composite
        // "<lpBatchId>:<courseId>" batchId - hide those, the Learning Path's own
        // record (plain batchId) already represents the whole path as one card.
        .filter((course: TrackableCollection) => !parseCourseContextId(course.batchId));

    // Nothing in progress: leave the section out rather than show an empty one.
    if (inProgressCourses.length === 0) return null;

    return (
        <section className="mb-8">
            <h3 className="home-section-title-large mb-4">{t('homeComponents.inProgress')}</h3>

            <div className="home-inprogress-grid">
                {inProgressCourses.map((course: TrackableCollection) => (
                    <Link
                        key={course.courseId || course.contentId}
                        to={
                            (course.content?.primaryCategory ?? '').toLowerCase() === 'learning path'
                                ? getContentDetailPath(course.courseId, course.content?.primaryCategory, course.batchId)
                                : course.lastReadContentId
                                    ? `/collection/${course.courseId}/batch/${course.batchId}/content/${course.lastReadContentId}`
                                    : `/collection/${course.courseId}/batch/${course.batchId}`
                        }
                        state={{ from: '/home' }}
                        className="home-inprogress-card no-underline"
                    >
                        {/* Content */}
                        <div className="home-inprogress-content">
                            <div>
                                <div className="flex-1 min-w-0">
                                    <span className="home-inprogress-badge">
                                        {getCategoryLabel(course.content?.primaryCategory, t, 'Course')}
                                    </span>
                                    <h4 className="home-inprogress-card-title">
                                        {course.courseName || course.content?.name || "Untitled Course"}
                                    </h4>

                                </div>
                            </div>
                            <div className="home-inprogress-progress-container">
                                <div className="home-inprogress-progress-bar-wrapper">
                                    <div className="home-inprogress-progress-bar-bg">
                                        <div
                                            className="home-inprogress-progress-bar-fill"
                                            style={{ width: `${course.completionPercentage}%` }}
                                        />
                                    </div>
                                </div>
                                <span className="home-inprogress-progress-text">{course.completionPercentage}%</span>
                            </div>
                        </div>
                        {/* Thumbnail */}
                        <div className="home-inprogress-thumbnail">
                            <img
                                src={course.content?.posterImage || course.courseLogoUrl || course.content?.appIcon || getPlaceholderImage(course.courseId || course.contentId || '')}
                                alt={course.courseName || "Untitled Course"}
                                className="home-inprogress-thumbnail-img"
                            />
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
};

export default HomeInProgressGrid;
