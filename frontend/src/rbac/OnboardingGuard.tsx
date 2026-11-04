import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRead } from '@/hooks/useUserRead';
import { useFormRead } from '@/hooks/useForm';
import { OnboardingFormData } from '@/types/formTypes';
import { useIsAuthenticated } from '@/hooks/useAuthInfo';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const { isAuthenticated } = useIsAuthenticated();

  const { data: formApiData, isLoading: formPending, isFetched: formFetched } = useFormRead({
    request: { type: 'user', subType: 'onboarding', action: 'workflow', component: 'portal' },
  });

  const { data: userReadData, isLoading: userPending, isFetched: userFetched, isFetching, isError: userReadError } = useUserRead();
  // A query with no data (e.g. form/read 404s) goes back to `isLoading` on every refetch, such as
  // on window focus. Treat only the first fetch as loading, so a refetch never unmounts the page.
  const formLoading = formPending && !formFetched;
  const userLoading = userPending && !userFetched;

  // Anonymous users are never redirected to onboarding.
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  const onboardingFormData = (formApiData?.data as { form?: { data?: OnboardingFormData } })?.form?.data;
  const isOnboardingEnabled = onboardingFormData?.isEnabled ?? false;

  const userProfile = userReadData?.data?.response as Record<string, any> | undefined;
  const onboardingDetails = userProfile?.framework?.onboardingDetails;
  const hasCompletedOnboarding = Array.isArray(onboardingDetails)
    ? onboardingDetails.length > 0
    : onboardingDetails != null;

  // Wait for initial load. On a background refetch (e.g. window focus), wait only when the stale
  // cache would send the user to onboarding: that prevents a redirect loop right after they finish
  // it. Otherwise keep the page mounted, so a refetch never wipes the user's in-page state.
  const wouldRedirect = isOnboardingEnabled && !hasCompletedOnboarding && !userReadError;
  if (formLoading || userLoading || (isFetching && wouldRedirect)) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <span className="onboarding-spinner" />
      </div>
    );
  }

  // Fail open: if the user profile API failed, let the user through rather than
  // blocking them from the app due to a temporary backend issue.
  if (wouldRedirect) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default OnboardingGuard;
