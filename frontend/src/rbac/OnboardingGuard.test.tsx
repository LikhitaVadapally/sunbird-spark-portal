import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OnboardingGuard from './OnboardingGuard';

const mockUseFormRead = vi.fn();
const mockUseUserRead = vi.fn();
const mockUseIsAuthenticated = vi.fn();

vi.mock('@/hooks/useForm', () => ({
  useFormRead: () => mockUseFormRead(),
}));

vi.mock('@/hooks/useUserRead', () => ({
  useUserRead: () => mockUseUserRead(),
}));

vi.mock('@/hooks/useAuthInfo', () => ({
  useIsAuthenticated: () => mockUseIsAuthenticated(),
}));

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderGuard = (children = <div>Protected Content</div>) =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <OnboardingGuard>{children}</OnboardingGuard>
      </MemoryRouter>
    </QueryClientProvider>
  );

const formEnabled = {
  data: { data: { form: { data: { isEnabled: true, initialScreenId: 'role', screens: {} } } } },
  isLoading: false,
};

const formDisabled = {
  data: { data: { form: { data: { isEnabled: false, initialScreenId: 'role', screens: {} } } } },
  isLoading: false,
};

const userWithOnboarding = (onboardingDetails: any) => ({
  data: { data: { response: { framework: { onboardingDetails } } } },
  isLoading: false,
  isFetching: false,
  isError: false,
});

const userWithoutOnboarding = {
  data: { data: { response: { framework: {} } } },
  isLoading: false,
  isFetching: false,
  isError: false,
};

describe('OnboardingGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsAuthenticated.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseFormRead.mockReturnValue(formEnabled);
    mockUseUserRead.mockReturnValue(userWithoutOnboarding);
  });

  // ── Authentication ────────────────────────────────────────────────────────

  it('renders children immediately for unauthenticated users without any checks', () => {
    mockUseIsAuthenticated.mockReturnValue({ isAuthenticated: false, isLoading: false });

    renderGuard();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  // ── Loading states ────────────────────────────────────────────────────────

  it('shows spinner while form data is loading', () => {
    mockUseFormRead.mockReturnValue({ data: null, isLoading: true });
    mockUseUserRead.mockReturnValue({ data: null, isLoading: false, isFetching: false, isError: false });

    const { container } = renderGuard();
    expect(container.querySelector('.onboarding-spinner')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows spinner while user data is loading', () => {
    mockUseUserRead.mockReturnValue({ data: null, isLoading: true, isFetching: true, isError: false });

    const { container } = renderGuard();
    expect(container.querySelector('.onboarding-spinner')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows spinner while refetching when user has not yet completed onboarding', () => {
    mockUseUserRead.mockReturnValue({ ...userWithoutOnboarding, isFetching: true });

    const { container } = renderGuard();
    expect(container.querySelector('.onboarding-spinner')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  // ── Redirect behaviour ────────────────────────────────────────────────────

  it('redirects to /onboarding when enabled and onboardingDetails is missing', () => {
    renderGuard();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to /onboarding when enabled and onboardingDetails is an empty array', () => {
    mockUseUserRead.mockReturnValue(userWithOnboarding([]));

    renderGuard();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  // ── Let-through behaviour ─────────────────────────────────────────────────

  it('lets through when userRead API fails (fail open)', () => {
    mockUseUserRead.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
    });

    renderGuard();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children when onboarding is disabled (isEnabled: false)', () => {
    mockUseFormRead.mockReturnValue(formDisabled);

    renderGuard();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children when user has completed onboarding', () => {
    mockUseUserRead.mockReturnValue(
      userWithOnboarding(['{"isSkipped":false,"data":{"role":{"values":["teacher"]}}}'])
    );

    renderGuard();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children when user has skipped onboarding', () => {
    mockUseUserRead.mockReturnValue(
      userWithOnboarding(['{"isSkipped":true,"data":{}}'])
    );

    renderGuard();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('does not block rendering during background refetch when onboarding is already complete', () => {
    mockUseUserRead.mockReturnValue({
      ...userWithOnboarding(['{"isSkipped":true,"data":{}}']),
      isFetching: true,
    });

    const { container } = renderGuard();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(container.querySelector('.onboarding-spinner')).not.toBeInTheDocument();
  });

  it('keeps the page mounted during background refetch when onboarding is disabled', () => {
    // Admins often have no onboardingDetails; a focus refetch must not unmount their page.
    mockUseFormRead.mockReturnValue(formDisabled);
    mockUseUserRead.mockReturnValue({ ...userWithoutOnboarding, isFetching: true });

    const { container } = renderGuard();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(container.querySelector('.onboarding-spinner')).not.toBeInTheDocument();
  });

  it('keeps the page mounted when a failed form read is retried on window focus', () => {
    // Errored queries with no data report isLoading again while refetching.
    mockUseFormRead.mockReturnValue({ data: null, isLoading: true, isFetched: true });
    mockUseUserRead.mockReturnValue({ ...userWithOnboarding(['{"isSkipped":true,"data":{}}']), isFetched: true });

    const { container } = renderGuard();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(container.querySelector('.onboarding-spinner')).not.toBeInTheDocument();
  });

  it('renders children when form API returns no data (fail open)', () => {
    mockUseFormRead.mockReturnValue({ data: null, isLoading: false });

    renderGuard();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
