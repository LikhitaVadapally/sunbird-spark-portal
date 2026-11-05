import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LearningPathOverview } from './LearningPathOverview';

vi.mock('@/hooks/usePathSkills', () => ({
  // The overview now surfaces skill progress, which reaches the competency APIs. These tests are
  // about layout and the creator/enrol panels, so the hook is stubbed to "nothing to show".
  usePathSkills: () => ({
    summary: undefined,
    heldCodes: new Set(),
    stateOf: () => undefined,
    name: (c: string) => c,
    isLoading: false,
  }),
}));
vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/learningPath/LearningPathCreatorPanel', () => ({
  LearningPathCreatorPanel: ({ pathId }: { pathId: string }) => (
    <div data-testid="lp-creator-panel">{pathId}</div>
  ),
}));

const baseModel = {
  identifier: 'lp1',
  name: 'My Path',
  description: '',
  policy: 'Fixed' as const,
  levels: [],
  courseTotal: 0,
  allSkills: [] as string[],
};

const baseEnrollment = {
  isEnrolled: false,
  batches: [],
  batchListLoading: false,
  batchListError: undefined,
  enrolLoading: false,
  enrolError: undefined,
  handleEnrol: vi.fn(),
  batchEndDate: undefined,
};

function buildLp(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    model: baseModel,
    policy: 'Fixed',
    progress: { pct: 0, doneLevels: 0 },
    levelProgress: [],
    levelStatuses: [],
    priorState: { progress: null, done: true },
    outcomeState: { progress: null, unlocked: false },
    enrollment: baseEnrollment,
    pathSummary: undefined,
    summaryByCollectionId: {},
    isTrackable: true,
    isCreatorViewingOwnPath: false,
    isMentorViewingPath: false,
    ...overrides,
  } as any;
}

const noop = () => undefined;

describe('LearningPathOverview', () => {
  it('shows the EnrolCard prompt for a learner who has not enrolled', () => {
    render(
      <MemoryRouter>
        <LearningPathOverview lp={buildLp()} isAuthenticated onOpenLevel={noop} onOpenPrior={noop} onOpenOutcome={noop} onOpenCourse={noop} />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('lp-creator-panel')).not.toBeInTheDocument();
  });

  it('shows the creator panel instead of EnrolCard when the viewer created the path', () => {
    render(
      <MemoryRouter>
        <LearningPathOverview
          lp={buildLp({ isCreatorViewingOwnPath: true })}
          isAuthenticated
          onOpenLevel={noop}
          onOpenPrior={noop}
          onOpenOutcome={noop}
          onOpenCourse={noop}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('lp-creator-panel')).toHaveTextContent('lp1');
  });

  it('shows the creator panel for a batch mentor even when not the creator', () => {
    render(
      <MemoryRouter>
        <LearningPathOverview
          lp={buildLp({ isMentorViewingPath: true })}
          isAuthenticated
          onOpenLevel={noop}
          onOpenPrior={noop}
          onOpenOutcome={noop}
          onOpenCourse={noop}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('lp-creator-panel')).toBeInTheDocument();
  });

  it('does not show the creator panel when the path is not trackable, even for the creator', () => {
    render(
      <MemoryRouter>
        <LearningPathOverview
          lp={buildLp({ isCreatorViewingOwnPath: true, isTrackable: false })}
          isAuthenticated
          onOpenLevel={noop}
          onOpenPrior={noop}
          onOpenOutcome={noop}
          onOpenCourse={noop}
        />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('lp-creator-panel')).not.toBeInTheDocument();
  });

  it('renders Path Progress as a full-width banner above the ledger/side-panel row', () => {
    render(
      <MemoryRouter>
        <LearningPathOverview lp={buildLp()} isAuthenticated onOpenLevel={noop} onOpenPrior={noop} onOpenOutcome={noop} onOpenCourse={noop} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('path-progress-card')).toBeInTheDocument();
  });

  // Regression: the policy explainer used to render as an always-visible,
  // full-width banner below the path progress card - it's now a
  // click-to-reveal info popover inside PathProgressCard itself (see: policy
  // note as click-to-reveal info).
  it('no longer renders the old always-visible policy note banner', () => {
    render(
      <MemoryRouter>
        <LearningPathOverview lp={buildLp()} isAuthenticated onOpenLevel={noop} onOpenPrior={noop} onOpenOutcome={noop} onOpenCourse={noop} />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('policy-note-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('policy-info-trigger')).toBeInTheDocument();
  });
});
