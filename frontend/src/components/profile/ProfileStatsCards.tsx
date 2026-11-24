import { useUserEnrolledCollections } from "@/hooks/useUserEnrolledCollections";
import { useViewerSummary } from "@/hooks/useViewerSummary";
import { sumOf, tallyLearning } from "@/services/learningPath/learningTally";
import { useUserCertificates } from "@/hooks/useCertificate";
import { useAppI18n } from "@/hooks/useAppI18n";

import { TotalContentsIcon, InProgressIcon, ContentsCompletedIcon, CertificationsIcon } from "./ProfileIcons";

const ProfileStatsCards = () => {
    const { t } = useAppI18n();
    const { data: enrolledCollections, isLoading: enrollmentsLoading } = useUserEnrolledCollections();
    const { data: certificatesData, isLoading: certificatesLoading } = useUserCertificates();
    const { data: summaries = [], isLoading: summariesLoading } = useViewerSummary();
    const tally = tallyLearning(enrolledCollections?.data?.courses || [], summaries);

    const isLoading = enrollmentsLoading || certificatesLoading || summariesLoading;

    // Get certificate count from the certificate search API
    // The API returns an array of certificates directly
    const certificatesEarned = Array.isArray(certificatesData?.data)
        ? certificatesData.data.length
        : 0;

    const pad = (n: number) => (n === 0 ? '0' : n.toString().padStart(2, '0'));
    const split = (k: keyof typeof tally) =>
        t("statsCards.split", { paths: tally[k].paths, courses: tally[k].courses });

    const statsData: Array<{ id: string; value: string; label: string; sub?: string; icon: typeof TotalContentsIcon }> = [
        {
            id: "total",
            value: pad(sumOf(tally.total)),
            label: t("statsCards.totalLearning"),
            sub: split("total"),
            icon: TotalContentsIcon,
        },
        {
            id: "progress",
            value: pad(sumOf(tally.inProgress)),
            label: t("statsCards.inProgress"),
            sub: split("inProgress"),
            icon: InProgressIcon,
        },
        {
            id: "completed",
            value: pad(sumOf(tally.completed)),
            label: t("statsCards.completed"),
            sub: split("completed"),
            icon: ContentsCompletedIcon,
        },
        {
            id: "certs",
            value: pad(certificatesEarned),
            label: t("statsCards.certificationsEarned"),
            icon: CertificationsIcon,
        },
    ];

    const getStatClass = (id: string) => {
        switch (id) {
            case "total": return "stat-card-time-spent";
            case "progress": return "stat-card-badges";
            case "completed": return "stat-card-completed";
            case "certs": return "stat-card-certs";
            default: return "";
        }
    };

    if (isLoading) {
        return (
            <div className="profile-stats-grid">
                {statsData.map((stat) => {
                    const IconComponent = stat.icon;
                    return (
                        <div
                            key={stat.id}
                            className={`stat-card ${getStatClass(stat.id)} animate-pulse`}
                        >
                            <div className="stat-icon-container">
                                <IconComponent />
                            </div>
                            <div className="stat-value opacity-50">
                                --
                            </div>
                            <div className="stat-label">
                                {stat.label}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="profile-stats-grid">
            {statsData.map((stat) => {
                const IconComponent = stat.icon;
                return (
                    <div
                        key={stat.id}
                        className={`stat-card ${getStatClass(stat.id)}`}
                    >
                        {/* Icon in top-right */}
                        <div className="stat-icon-container">
                            <IconComponent />
                        </div>

                        {/* Value */}
                        <div className="stat-value">
                            {stat.value}
                        </div>

                        {/* Label */}
                        <div className="stat-label">
                            {stat.label}
                        </div>
                        {stat.sub && <div className="stat-sub" data-testid={`stat-sub-${stat.id}`}>{stat.sub}</div>}
                    </div>
                );
            })}
        </div>
    );
};

export default ProfileStatsCards;
