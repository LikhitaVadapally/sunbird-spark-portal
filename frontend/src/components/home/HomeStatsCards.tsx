import { useUserEnrolledCollections } from "@/hooks/useUserEnrolledCollections";
import { useViewerSummary } from "@/hooks/useViewerSummary";
import { sumOf, tallyLearning } from "@/services/learningPath/learningTally";
import { useUserCertificates } from "@/hooks/useCertificate";
import { useAppI18n } from "@/hooks/useAppI18n";

// Custom icons matching the design
const TotalContentsIcon = () => (
    <svg width="25" height="28" viewBox="0 0 25 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.75 15.375H15.375" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <path d="M6.75 9.625H12.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <path d="M6.75 21.125H12.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <path d="M21.125 15.375V18.25C21.125 22.3181 21.125 24.345 19.8614 25.61C18.5993 26.875 16.5653 26.875 12.5 26.875H9.625C5.55975 26.875 3.52568 26.875 2.26356 25.61C0.999997 24.345 1 22.3181 1 18.25V9.625C1 5.55688 0.999997 3.53001 2.26356 2.26501C3.52568 1.00001 5.55975 1 9.625 1" stroke="white" strokeWidth="2" />
        <path d="M19.6875 1V9.625" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 5.3125H15.375" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const InProgressIcon = () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#clip0_387_3558)">
            <path d="M15.6 2.6665C15.4667 2.6665 15.4667 2.6665 15.3334 2.6665C15.3334 2.6665 15.3334 2.6665 15.2 2.6665C14.9334 2.6665 14.8 2.6665 14.5334 2.6665L14.8 5.33317C15.3334 5.33317 16 5.33317 16.5334 5.33317C21.8667 5.73317 26.2667 9.99984 26.5334 15.4665C26.8 21.3332 22.2667 26.3998 16.4001 26.6665C16.4001 26.6665 16.2667 26.6665 16.1334 26.6665C15.7334 26.6665 15.2 26.6665 14.8 26.6665L14.6667 29.3332C15.2 29.3332 15.7334 29.3332 16.4001 29.3332C16.5334 29.3332 16.8 29.3332 16.9334 29.3332C24.1334 28.7998 29.6 22.6665 29.3334 15.4665C29.0667 8.6665 23.6 3.33317 16.9334 2.79984C16.6667 2.79984 16.5334 2.79984 16.2667 2.79984C16 2.6665 15.8667 2.6665 15.6 2.6665ZM10.9334 3.59984C10.2667 3.99984 9.60005 4.2665 8.93338 4.6665L10.4 6.93317C10.8 6.6665 11.3334 6.39984 11.8667 6.13317L10.9334 3.59984ZM6.00005 7.19984C5.46672 7.73317 5.06672 8.39984 4.66672 8.93317L6.93338 10.2665C7.20005 9.8665 7.60005 9.4665 8.00005 8.93317L6.00005 7.19984ZM20.5334 11.1998L14.4001 18.1332L10.8 15.3332L9.33338 17.5998L14.9334 21.8665L22.6667 13.0665L20.5334 11.1998ZM3.20005 11.9998C2.93338 12.6665 2.80005 13.4665 2.80005 14.1332L5.46672 14.5332C5.60005 13.9998 5.60005 13.3332 5.86672 12.7998L3.20005 11.9998ZM5.46672 17.3332L2.80005 17.5998C2.80005 17.7332 2.80005 17.8665 2.80005 17.9998C2.93338 18.5332 3.06672 19.1998 3.20005 19.7332L5.73338 18.9332C5.60005 18.5332 5.46672 17.9998 5.46672 17.4665V17.3332ZM6.93338 21.5998L4.66672 23.0665C5.06672 23.7332 5.46672 24.2665 6.00005 24.7998L8.00005 23.0665C7.60005 22.5332 7.20005 22.1332 6.93338 21.5998ZM10.4 25.0665L8.93338 27.3332C9.60005 27.7332 10.2667 27.9998 10.9334 28.3998L12 25.9998C11.3334 25.5998 10.8 25.3332 10.4 25.0665Z" fill="white" />
        </g>
        <defs>
            <clipPath id="clip0_387_3558">
                <rect width="32" height="32" fill="white" />
            </clipPath>
        </defs>
    </svg>
);

const CompletedIcon = () => (
    <svg width="23" height="25" viewBox="0 0 23 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21.4444 12.5V18.8889C21.4444 21.2988 21.4445 22.5024 20.6906 23.2512C19.9495 24 18.7483 24 16.3333 24H4.19444C2.43111 24 1 22.5702 1 20.8056M21.4444 12.5V6.11111C21.4444 3.70122 21.4445 2.49755 20.6906 1.74878C19.9495 0.999998 18.7483 1 16.3333 1H6.11111C3.69611 1 2.49496 0.999998 1.75385 1.74878C0.999956 2.49755 1 3.70122 1 6.11111V20.8056M21.4444 12.5C21.4444 14.9099 21.4445 16.1136 20.6906 16.8623C19.9495 17.6111 18.7483 17.6111 16.3333 17.6111H4.19444C2.43111 17.6111 1 19.0409 1 20.8056" stroke="white" strokeWidth="2" />
        <path d="M7.38892 9.94423L9.0373 11.5964C9.53563 12.0947 10.3533 12.0947 10.8516 11.5964L15.0556 7.38867" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const CertificationsIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.2 23.2H14.4C14.4 23.503 14.5712 23.78 14.8422 23.9155C15.1133 24.051 15.4376 24.0218 15.68 23.84L15.2 23.2ZM18.4 20.8L18.88 20.16C18.5955 19.9467 18.2045 19.9467 17.92 20.16L18.4 20.8ZM21.6 23.2L21.12 23.84C21.3624 24.0218 21.6867 24.051 21.9578 23.9155C22.2288 23.78 22.4 23.503 22.4 23.2H21.6ZM18.4 17.6C16.1909 17.6 14.4 15.8091 14.4 13.6H12.8C12.8 16.6928 15.3072 19.2 18.4 19.2V17.6ZM22.4 13.6C22.4 15.8091 20.6091 17.6 18.4 17.6V19.2C21.4928 19.2 24 16.6928 24 13.6H22.4ZM18.4 9.6C20.6091 9.6 22.4 11.3909 22.4 13.6H24C24 10.5072 21.4928 8 18.4 8V9.6ZM18.4 8C15.3072 8 12.8 10.5072 12.8 13.6H14.4C14.4 11.3909 16.1909 9.6 18.4 9.6V8ZM14.4 16.8V23.2H16V16.8H14.4ZM15.68 23.84L18.88 21.44L17.92 20.16L14.72 22.56L15.68 23.84ZM17.92 21.44L21.12 23.84L22.08 22.56L18.88 20.16L17.92 21.44ZM22.4 23.2V16.8H20.8V23.2H22.4ZM24 8V2.4H22.4V8H24ZM21.6 0H2.4V1.6H21.6V0ZM0 2.4V21.6H1.6V2.4H0ZM2.4 24H12.8V22.4H2.4V24ZM0 21.6C0 22.9254 1.07452 24 2.4 24V22.4C1.95818 22.4 1.6 22.0418 1.6 21.6H0ZM2.4 0C1.07452 0 0 1.07452 0 2.4H1.6C1.6 1.95818 1.95818 1.6 2.4 1.6V0ZM24 2.4C24 1.07452 22.9254 0 21.6 0V1.6C22.0418 1.6 22.4 1.95818 22.4 2.4H24ZM4.8 8H12.8V6.4H4.8V8ZM4.8 12.8H9.6V11.2H4.8V12.8Z" fill="white" />
    </svg>
);

const HomeStatsCards = () => {
    const { t } = useAppI18n();
    const { data: enrolledCollections, isLoading: enrollmentsLoading } = useUserEnrolledCollections();
    const { data: certificatesData, isLoading: certificatesLoading } = useUserCertificates();
    // Same counting as the profile tiles: each course and path once, a path's progress from Viewer.
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

    const statsData: Array<{ id: string; value: string; label: string; sub?: string; bgColor: string; iconBg: string; icon: typeof TotalContentsIcon }> = [
        {
            id: "total",
            value: pad(sumOf(tally.total)),
            label: t("statsCards.totalLearning"),
            sub: split("total"),
            bgColor: "bg-sunbird-blue-light",
            iconBg: "hsl(var(--sunbird-blue-medium))",
            icon: TotalContentsIcon,
        },
        {
            id: "progress",
            value: pad(sumOf(tally.inProgress)),
            label: t("statsCards.inProgress"),
            sub: split("inProgress"),
            bgColor: "bg-sunbird-ginger",
            iconBg: "hsl(28 53% 38%)",
            icon: InProgressIcon,
        },
        {
            id: "completed",
            value: pad(sumOf(tally.completed)),
            label: t("statsCards.completed"),
            sub: split("completed"),
            bgColor: "bg-sunbird-moss",
            iconBg: "hsl(var(--sunbird-green-dark))",
            icon: CompletedIcon,
        },
        {
            id: "certs",
            value: pad(certificatesEarned),
            label: t("statsCards.certificationsEarned"),
            bgColor: "bg-sunbird-lavender",
            iconBg: "hsl(var(--sunbird-purple-dark))",
            icon: CertificationsIcon,
        },
    ];

    if (isLoading) {
        return (
            <div className="home-stats-grid">
                {statsData.map((stat) => (
                    <div
                        key={stat.id}
                        className={`home-stat-card ${stat.bgColor} animate-pulse`}
                    >
                        <div
                            className="home-stat-icon-wrapper"
                            style={{ backgroundColor: stat.iconBg }}
                        >
                            <stat.icon />
                        </div>
                        <div className="home-stat-value opacity-50">--</div>
                        <div className="home-stat-label">{stat.label}</div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="home-stats-grid">
            {statsData.map((stat) => {
                const Icon = stat.icon;

                return (
                    <div
                        key={stat.id}
                        className={`home-stat-card ${stat.bgColor}`}
                    >
                        {/* Icon in top right */}
                        <div
                            className="home-stat-icon-wrapper"
                            style={{ backgroundColor: stat.iconBg }}
                        >
                            <Icon />
                        </div>

                        {/* Value */}
                        <div className="home-stat-value">
                            {stat.value}
                        </div>

                        {/* Label */}
                        <div className="home-stat-label">
                            {stat.label}
                        </div>
                        {stat.sub && <div className="home-stat-sub" data-testid={`home-stat-sub-${stat.id}`}>{stat.sub}</div>}
                    </div>
                );
            })}
        </div>
    );
};

export default HomeStatsCards;
