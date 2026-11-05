import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LearningPathPage from './LearningPathPage';
import type { LPCourseNode, LPLevelNode } from '@/types/learningPathTypes';

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

vi.mock('@/hooks/usePermission', () => ({
  usePermissions: () => ({ isAuthenticated: true }),
}));

vi.mock('@/hooks/useImpression', () => ({
  default: () => undefined,
}));

type StoredScoreMap = Record<string, { score: number; maxScore: number; attempts: number }>;
const mockUseStoredAssessmentScores = vi.fn(
  (_collectionId: string | undefined): StoredScoreMap => ({})
);
vi.mock('@/hooks/useAssessmentScores', () => ({
  useStoredAssessmentScores: (collectionId: string | undefined) => mockUseStoredAssessmentScores(collectionId),
}));

const priorCourse: LPCourseNode = {
  identifier: 'course_prior',
  name: 'Prior check',
  leafNodesCount: 1,
  leafIds: ['qs_prior'],
  skills: ['Data literacy'], skillCodes: [],
  isAssessmentCourse: true,
  questionCount: 10,
};

const outcomeCourse: LPCourseNode = {
  identifier: 'course_outcome',
  name: 'Outcome check',
  leafNodesCount: 1,
  leafIds: ['qs_outcome'],
  skills: ['Data literacy'], skillCodes: [],
  isAssessmentCourse: true,
};

const level1: LPLevelNode = {
  identifier: 'level_1',
  name: 'Foundations',
  index: 1,
  skills: ['Data literacy'], skillCodes: [],
  courses: [
    {
      identifier: 'course_1',
      name: 'Course 1',
      leafNodesCount: 1,
      leafIds: ['res_1'],
      skills: [], skillCodes: [],
      isAssessmentCourse: false,
    },
  ],
};

type LpTestData = {
  model: {
    identifier: string;
    name: string;
    policy: 'Fixed';
    levels: LPLevelNode[];
    priorAssessment: LPCourseNode;
    outcomeAssessment: LPCourseNode;
    allSkills: string[];
    allSkillCodes: string[];
    courseTotal: number;
    leafTotal: number;
  };
  policy: 'Fixed';
  progress: {
    pct: number;
    completed: number;
    total: number;
    doneLevels: number;
    levelCount: number;
  };
  levelProgress: Array<{ pct: number; completed: number; total: number; doneCourses: number }>;
  levelStatuses: Array<'notStarted'>;
  priorState: { progress: null; done: boolean };
  outcomeState: { progress: null; unlocked: boolean };
  enrollment: {
    isEnrolled: boolean;
    effectiveContextId: undefined;
    batches: never[];
    batchListLoading: boolean;
    batchListError: undefined;
    isBatchEnded: boolean;
    isBatchUpcoming: boolean;
    batchEndDate: undefined;
    certificates: undefined;
    enrolLoading: boolean;
    enrolError: string;
    handleEnrol: () => void;
    handleUnenrol: () => void;
  };
  resumeTarget: null;
  pathSummary: undefined;
  summaryByCollectionId: Map<string, unknown>;
  isLoading: boolean;
  isError: boolean;
};

let mockLpData: LpTestData;

function buildLp(overrides: Partial<LpTestData> = {}): LpTestData {
  return {
    model: {
      identifier: 'lp_1',
      name: 'Data Foundations',
      policy: 'Fixed' as const,
      levels: [level1],
      priorAssessment: priorCourse,
      outcomeAssessment: outcomeCourse,
      allSkills: ['Data literacy'],
      allSkillCodes: [],
      courseTotal: 3,
      leafTotal: 3,
    },
    policy: 'Fixed' as const,
    progress: { pct: 0, completed: 0, total: 3, doneLevels: 0, levelCount: 1 },
    levelProgress: [{ pct: 0, completed: 0, total: 1, doneCourses: 0 }],
    levelStatuses: ['notStarted' as const],
    priorState: { progress: null, done: false },
    outcomeState: { progress: null, unlocked: false },
    enrollment: {
      isEnrolled: false,
      effectiveContextId: undefined,
      batches: [],
      batchListLoading: false,
      batchListError: undefined,
      isBatchEnded: false,
      isBatchUpcoming: false,
      batchEndDate: undefined,
      certificates: undefined,
      enrolLoading: false,
      enrolError: '',
      handleEnrol: vi.fn(),
      handleUnenrol: vi.fn(),
    },
    resumeTarget: null,
    pathSummary: undefined,
    summaryByCollectionId: new Map(),
    isLoading: false,
    isError: false,
    ...overrides,
  };
}

vi.mock('@/hooks/useLearningPath', () => ({
  useLearningPath: () => mockLpData,
}));

vi.mock('./LearningPathPlayerView', () => ({
  LearningPathPlayerView: ({ courseId, contentId }: { courseId: string; contentId: string }) => (
    <div data-testid="lp-player-view">{`${courseId}/${contentId}`}</div>
  ),
}));

function renderAt(path: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="/learning-path/:pathId" element={<LearningPathPage />} />
        <Route path="/learning-path/:pathId/level/:levelId" element={<LearningPathPage />} />
        <Route path="/learning-path/:pathId/prior" element={<LearningPathPage />} />
        <Route path="/learning-path/:pathId/outcome" element={<LearningPathPage />} />
        <Route path="/learning-path/:pathId/complete" element={<LearningPathPage />} />
        <Route path="/learning-path/:pathId/status" element={<LearningPathPage />} />
        <Route
          path="/learning-path/:pathId/course/:courseId/content/:contentId"
          element={<LearningPathPage />}
        />
        <Route path="/learning-path/:pathId/batch/:contextId" element={<LearningPathPage />} />
        <Route
          path="/learning-path/:pathId/batch/:contextId/level/:levelId"
          element={<LearningPathPage />}
        />
        <Route
          path="/learning-path/:pathId/batch/:contextId/prior"
          element={<LearningPathPage />}
        />
        <Route
          path="/learning-path/:pathId/batch/:contextId/outcome"
          element={<LearningPathPage />}
        />
        <Route
          path="/learning-path/:pathId/batch/:contextId/complete"
          element={<LearningPathPage />}
        />
        <Route
          path="/learning-path/:pathId/batch/:contextId/status"
          element={<LearningPathPage />}
        />
        <Route
          path="/learning-path/:pathId/batch/:contextId/course/:courseId/content/:contentId"
          element={<LearningPathPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LearningPathPage', () => {
  beforeEach(() => {
    mockUseStoredAssessmentScores.mockReset().mockReturnValue({});
  });

  // Regression: the gate/complete screens used to read the score only from
  // `pathSummary.assessmentStatus`, which is wiped by the next `['viewerSummary']`
  // refetch - the durable local store must fill in when that happens.
  it('shows the prior assessment score from the local store even when pathSummary has no assessmentStatus', () => {
    mockUseStoredAssessmentScores.mockImplementation((collectionId): StoredScoreMap =>
      collectionId === 'course_prior' ? { qs_prior: { score: 8, maxScore: 10, attempts: 1 } } : {}
    );
    mockLpData = buildLp({ pathSummary: undefined, enrollment: { ...buildLp().enrollment, isEnrolled: true } });
    renderAt('/learning-path/lp_1/batch/batch_1/prior');
    expect(screen.getByText('8/10')).toBeInTheDocument();
  });

  it('renders the overview screen (Ledger table) by default', () => {
    mockLpData = buildLp();
    renderAt('/learning-path/lp_1');
    expect(screen.getByText('Data Foundations')).toBeInTheDocument();
  });

  it('renders the prior assessment gate at /prior', () => {
    mockLpData = buildLp({ enrollment: { ...buildLp().enrollment, isEnrolled: true } });
    renderAt('/learning-path/lp_1/batch/batch_1/prior');
    // "Prior check" (the assessment's own name) also appears on the overview's
    // ledger prior row, so assert on gate-specific copy too - otherwise this
    // test can't distinguish the gate from a redirect back to the overview.
    expect(screen.getByText('Prior check')).toBeInTheDocument();
    expect(screen.getByText('learningPath.startAssessment')).toBeInTheDocument();
  });

  // Regression: an unenrolled visitor could reach the prior-assessment gate and
  // press "Start assessment", only to be stopped one screen later by the
  // player's "must join" dialog - see bug: /prior route unguarded.
  it('redirects away from /prior when the learner is not enrolled', () => {
    mockLpData = buildLp({ enrollment: { ...buildLp().enrollment, isEnrolled: false } });
    renderAt('/learning-path/lp_1/batch/batch_1/prior');
    expect(screen.queryByText('learningPath.startAssessment')).not.toBeInTheDocument();
    expect(screen.getByText('Data Foundations')).toBeInTheDocument();
  });

  // Regression: the prior/outcome gate screens had no way back to the path overview.
  it('has a back-to-path link on the prior gate that returns to the overview', () => {
    mockLpData = buildLp({ enrollment: { ...buildLp().enrollment, isEnrolled: true } });
    renderAt('/learning-path/lp_1/batch/batch_1/prior');
    fireEvent.click(screen.getByText(/learningPath\.backToPath/));
    expect(screen.getByText('Data Foundations')).toBeInTheDocument();
    // The overview's ledger row legitimately shows the assessment's own name too,
    // so assert on gate-specific copy instead.
    expect(screen.queryByText('learningPath.beforeThePathOpens')).not.toBeInTheDocument();
  });

  it('has a back-to-path link on the outcome gate that returns to the overview', () => {
    mockLpData = buildLp({ outcomeState: { progress: null, unlocked: true } });
    renderAt('/learning-path/lp_1/batch/batch_1/outcome');
    fireEvent.click(screen.getByText(/learningPath\.backToPath/));
    expect(screen.getByText('Data Foundations')).toBeInTheDocument();
    expect(screen.queryByText('learningPath.beforeTheFinalAssessment')).not.toBeInTheDocument();
  });

  it('renders the outcome assessment gate at /outcome when unlocked', () => {
    mockLpData = buildLp({ outcomeState: { progress: null, unlocked: true } });
    renderAt('/learning-path/lp_1/batch/batch_1/outcome');
    expect(screen.getByText('Outcome check')).toBeInTheDocument();
    expect(screen.queryByText('learningPath.skipAndStartLevel1')).not.toBeInTheDocument();
  });

  // A hand-typed /outcome URL must not show a gate the learner cannot use yet -
  // the rail/ledger rows only ever navigate here once unlocked.
  it('redirects away from /outcome when the outcome assessment is still locked', () => {
    mockLpData = buildLp({ outcomeState: { progress: null, unlocked: false } });
    renderAt('/learning-path/lp_1/batch/batch_1/outcome');
    // The overview's own ledger row legitimately shows the outcome course's name
    // even while locked, so assert on gate-specific copy instead.
    expect(screen.queryByText('learningPath.beforeTheFinalAssessment')).not.toBeInTheDocument();
    expect(screen.getByText('Data Foundations')).toBeInTheDocument();
  });

  it('redirects away from /outcome when the path has no outcome assessment', () => {
    mockLpData = buildLp({
      model: {
        identifier: 'lp_1',
        name: 'Data Foundations',
        policy: 'Fixed' as const,
        levels: [level1],
        priorAssessment: priorCourse,
        outcomeAssessment: undefined as unknown as LPCourseNode,
        allSkills: ['Data literacy'],
      allSkillCodes: [],
        courseTotal: 2,
        leafTotal: 2,
      },
      outcomeState: { progress: null, unlocked: true },
    });
    renderAt('/learning-path/lp_1/batch/batch_1/outcome');
    expect(screen.queryByText('learningPath.beforeTheFinalAssessment')).not.toBeInTheDocument();
    expect(screen.getByText('Data Foundations')).toBeInTheDocument();
  });

  it('renders the level detail view at /level/:levelId', () => {
    mockLpData = buildLp();
    renderAt('/learning-path/lp_1/batch/batch_1/level/level_1');
    expect(screen.getByText(/Foundations/)).toBeInTheDocument();
  });

  it('renders the completion view at /complete', () => {
    mockLpData = buildLp({
      progress: { pct: 100, completed: 3, total: 3, doneLevels: 1, levelCount: 1 },
    });
    renderAt('/learning-path/lp_1/batch/batch_1/complete');
    expect(screen.getByText('learningPath.pathComplete')).toBeInTheDocument();
  });

  // Regression: before enrolment there is no contextId in the URL (overview lives at
  // /learning-path/:pathId, not /learning-path/:pathId/batch/:contextId). Sub-screen
  // links built from that bare URL must still resolve to a route, not fall through to
  // the app's catch-all "*" -> Navigate("/") and bounce the learner to Home.
  it('renders the level detail view at /level/:levelId with no contextId in the URL', () => {
    mockLpData = buildLp();
    renderAt('/learning-path/lp_1/level/level_1');
    expect(screen.getByText(/Foundations/)).toBeInTheDocument();
  });

  it('renders the prior assessment gate at /prior with no contextId in the URL', () => {
    mockLpData = buildLp({ enrollment: { ...buildLp().enrollment, isEnrolled: true } });
    renderAt('/learning-path/lp_1/prior');
    expect(screen.getByText('Prior check')).toBeInTheDocument();
    expect(screen.getByText('learningPath.startAssessment')).toBeInTheDocument();
  });

  it('renders the completion view at /complete with no contextId in the URL', () => {
    mockLpData = buildLp({
      progress: { pct: 100, completed: 3, total: 3, doneLevels: 1, levelCount: 1 },
    });
    renderAt('/learning-path/lp_1/complete');
    expect(screen.getByText('learningPath.pathComplete')).toBeInTheDocument();
  });

  it('renders the Learning Path player view at /course/:courseId/content/:contentId with no contextId in the URL', () => {
    mockLpData = buildLp();
    renderAt('/learning-path/lp_1/course/course_1/content/res_1');
    expect(screen.getByTestId('lp-player-view')).toHaveTextContent('course_1/res_1');
  });

  it('shows a loader while the hierarchy/summary are still loading', () => {
    mockLpData = buildLp({ isLoading: true });
    renderAt('/learning-path/lp_1');
    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
  });

  it('shows an error state when the hierarchy fails to load', () => {
    mockLpData = buildLp({ isError: true });
    renderAt('/learning-path/lp_1');
    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
  });

  it('renders the Learning Path player view at /course/:courseId/content/:contentId', () => {
    mockLpData = buildLp();
    renderAt('/learning-path/lp_1/batch/batch_1/course/course_1/content/res_1');
    expect(screen.getByTestId('lp-player-view')).toHaveTextContent('course_1/res_1');
  });

  // Regression: the overview screen (/learning-path/:pathId) had no way back to
  // wherever the learner came from - every entry point already sets
  // location.state.from (mirrors the Collection detail flow's back button).
  it('shows a back button on the overview screen that returns to location.state.from', () => {
    mockLpData = buildLp();
    renderAt('/learning-path/lp_1', { from: '/my-learning' });
    expect(screen.getByText('button.goBack')).toBeInTheDocument();
  });

  it('renders the status timeline view at /status', () => {
    mockLpData = buildLp();
    renderAt('/learning-path/lp_1/batch/batch_1/status');
    expect(screen.getByTestId('status-path-header-node')).toBeInTheDocument();
    expect(screen.getAllByTestId('status-timeline-node')).toHaveLength(1);
  });

  it('renders the status timeline view at /status with no contextId in the URL', () => {
    mockLpData = buildLp();
    renderAt('/learning-path/lp_1/status');
    expect(screen.getByTestId('status-path-header-node')).toBeInTheDocument();
  });
});
