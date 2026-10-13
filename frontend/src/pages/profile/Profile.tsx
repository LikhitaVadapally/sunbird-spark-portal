import PageLoader from "@/components/common/PageLoader";
import ProfileCard from "@/components/profile/ProfileCard";
import PersonalInformation from "@/components/profile/PersonalInformation";
import ProfileLearningList from "@/components/profile/ProfileLearningList";
import ProfileSkillsLink from "@/components/profile/ProfileSkillsLink";
import ProfileStatsCards from "@/components/profile/ProfileStatsCards";
import AccountManagement from "@/components/profile/AccountManagement";
import { useUserRead } from "@/hooks/useUserRead";
import { useAppI18n } from "@/hooks/useAppI18n";
import useImpression from "@/hooks/useImpression";
import "./profile.css";

const Profile = () => {
    const { t } = useAppI18n();

    useImpression({ type: 'view', pageid: 'profile', env: 'profile' });

    const { data: userResponse, isLoading, isError } = useUserRead({ refetchOnMount: 'always' });
    const userData = userResponse?.data?.response;

    return (
        <main className="profile-main-content">
            {isLoading ? (
                <PageLoader message={t('profilePage.loading')} fullPage={false} />
            ) : isError || !userData ? (
                <PageLoader message={t('profilePage.errorLoading')} fullPage={false} />
            ) : (
                <div className="profile-content-wrapper">
                    {/* Top Section: Profile Card + Personal Information */}
                    <div className="grid grid-cols-1 lg:grid-cols-[19rem_1fr] gap-6 mb-8">
                        {/* Left: Profile Card */}
                        <ProfileCard user={userData} />

                        {/* Right: Personal Information */}
                        <PersonalInformation user={userData} />
                    </div>

                    {/* Stats Cards Section */}
                    <ProfileStatsCards />

                    {/* My Learning Section */}
                    <ProfileLearningList />

                    {/* My Skills entry point */}
                    <ProfileSkillsLink />

                    {/* Account Management Section */}
                    <AccountManagement />
                </div>
            )}
        </main>
    );
};

export default Profile;
