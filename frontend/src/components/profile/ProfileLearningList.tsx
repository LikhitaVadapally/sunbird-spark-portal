import { useState } from "react";
import { orderBy } from "lodash";
import { FiChevronDown } from "react-icons/fi";
import { useUserEnrolledCollections } from "@/hooks/useUserEnrolledCollections";
import { useViewerSummary } from "@/hooks/useViewerSummary";
import { withPathProgress } from "@/services/learningPath/enrolmentProgress";
import PageLoader from "@/components/common/PageLoader";
import { useCertificateDownload } from "@/hooks/useCertificateDownload";
import { useAppI18n } from "@/hooks/useAppI18n";
import { parseCourseContextId } from "@/services/viewer/summaryMapper";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/common/DropdownMenu";
import { getCompletionStatus } from "./profileLearningStatus";
import CourseRow from "./ProfileLearningCourseRow";

type FilterType = "all" | "not-started" | "ongoing" | "completed";

const VIEW_LIMIT = 6;

const ProfileLearningList = () => {
    const { t } = useAppI18n();
    const [filter, setFilter] = useState<FilterType>("all");
    const [showAll, setShowAll] = useState(false);

    const { data, isLoading: enrolmentsLoading, isError, refetch } = useUserEnrolledCollections();
    // A path's completion comes from its Viewer summary, as on the path page and My Learning.
    const { data: summaries = [], isLoading: summariesLoading } = useViewerSummary();
    const isLoading = enrolmentsLoading || summariesLoading;
    const courses = withPathProgress(data?.data?.courses ?? [], summaries);

    const { downloadCertificate, hasCertificate, downloadingCourseId } = useCertificateDownload();

    const filtered = courses
        .filter((c) => filter === "all" || getCompletionStatus(c.status, c.completionPercentage ?? 0) === filter)
        // Hide the per-course records a Learning Path enrolment fans out (composite
        // "<lpBatchId>:<courseId>" batchId) - the Learning Path's own record represents it.
        .filter((c) => !parseCourseContextId(c.batchId));
    const filteredCourses = orderBy(filtered, [(c) => c.lastContentAccessTime ?? c.enrolledDate ?? 0], ["desc"]);

    const hasMore = filteredCourses.length > VIEW_LIMIT;
    const visibleCourses = hasMore && !showAll
        ? filteredCourses.slice(0, VIEW_LIMIT)
        : filteredCourses;

    return (
        <div className="learning-list-card">
            {/* Header with Filter */}
            <div className="learning-header">
                <div className="learning-title-wrapper">
                    <div className="learning-title-accent" />
                    <h2 className="learning-title">{t('profileLearning.myLearning')}</h2>
                </div>

                <div className="learning-filter-container">
                    <span className="learning-filter-label">{t('profileLearning.filter')} :</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm font-normal text-foreground hover:bg-gray-50 transition-colors min-w-[8rem] justify-between"
                                aria-label="Filter courses by status"
                            >
                                <span className="capitalize">
                                    {filter === 'all'
                                        ? t('tabs.all')
                                        : filter === 'ongoing'
                                            ? t('status.ongoing')
                                            : filter === 'not-started'
                                                ? t('status.notStarted')
                                                : t('status.completed')}
                                </span>
                                <FiChevronDown className="w-4 h-4 text-sunbird-theme-accent" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[8.75rem] bg-white z-50">
                            <DropdownMenuItem
                                className="cursor-pointer hover:bg-sunbird-theme-accent-muted/10 hover:text-sunbird-theme-accent-muted"
                                onClick={() => {
                                    setFilter("all");
                                    setShowAll(false);
                                }}
                            >
                                {t('tabs.all')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer hover:bg-sunbird-theme-accent-muted/10 hover:text-sunbird-theme-accent-muted"
                                onClick={() => {
                                    setFilter("not-started");
                                    setShowAll(false);
                                }}
                            >
                                {t('status.notStarted')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer hover:bg-sunbird-theme-accent-muted/10 hover:text-sunbird-theme-accent-muted"
                                onClick={() => {
                                    setFilter("ongoing");
                                    setShowAll(false);
                                }}
                            >
                                {t('status.ongoing')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer hover:bg-sunbird-theme-accent-muted/10 hover:text-sunbird-theme-accent-muted"
                                onClick={() => {
                                    setFilter("completed");
                                    setShowAll(false);
                                }}
                            >
                                {t('status.completed')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Course List */}
            <div className="learning-list-container">
                {isLoading ? (
                    <PageLoader message={t('profileLearning.loadingCourses')} fullPage={false} />
                ) : isError ? (
                    <PageLoader
                        error={t('profileLearning.failedToLoadCourses')}
                        onRetry={() => refetch()}
                        fullPage={false}
                    />
                ) : filteredCourses.length === 0 ? (
                    <div className="flex flex-1 min-h-[200px] items-center justify-center">
                        <p className="text-sunbird-gray-75 text-sm">
                            {filter === "all"
                                ? t('profileLearning.noCoursesEnrolled')
                                : t('profileLearning.noFilteredCourses', {
                                    filter: filter === 'ongoing' ? t('status.ongoing')
                                        : filter === 'not-started' ? t('status.notStarted') : t('status.completed')
                                })}
                        </p>
                    </div>
                ) : (
                    visibleCourses.map((course, index) => (
                        <CourseRow
                            key={`${course.batchId || "course"}-${index}`}
                            course={course}
                            downloadCertificate={downloadCertificate}
                            hasCertificate={hasCertificate}
                            downloadingCourseId={downloadingCourseId}
                            t={t}
                        />
                    ))
                )}
            </div>

            {/* View More / View Less */}
            {!isLoading && !isError && hasMore && (
                <div className="learning-view-more-container">
                    <button
                        onClick={() => setShowAll((prev) => !prev)}
                        className="learning-view-more-link"
                    >
                        {showAll ? t('profileLearning.viewLess') : t('profileLearning.viewMoreCourses')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfileLearningList;
