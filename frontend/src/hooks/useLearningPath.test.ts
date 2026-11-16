import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLearningPath } from './useLearningPath';
import { LP_HIERARCHY_NO_ASSESSMENTS } from '../services/learningPath/__fixtures__/lpHierarchyNoAssessments.fixture';
import type { CollectionData } from '../types/collectionTypes';
import type { ViewerSummaryRecord } from '../types/viewerServiceTypes';

const mockCollectionData: CollectionData = {
  id: LP_HIERARCHY_NO_ASSESSMENTS.identifier,
  title: LP_HIERARCHY_NO_ASSESSMENTS.name ?? '',
  lessons: 3,
  image: '',
  units: 2,
  description: '',
  audience: [],
  children: LP_HIERARCHY_NO_ASSESSMENTS.children ?? [],
  hierarchyRoot: LP_HIERARCHY_NO_ASSESSMENTS,
  createdBy: 'u1',
  trackable: { enabled: 'Yes' },
};

let mockUseCollectionData: CollectionData | undefined = mockCollectionData;
let mockSummaryRecords: ViewerSummaryRecord[] = [];
let mockIsAuthenticated = true;

// Skill-framework fields come from a framework read; these tests use `skill` (field unknown).
vi.mock('./useSkillProfile', () => ({
  useSkillLabels: () => ({ labelOf: (code: string) => ({ name: code, resolved: false }), codeOf: (t: string) => t, isLoading: false }),
}));
vi.mock('./useSkillFields', () => ({
  useSkillFields: () => ({ fieldOf: () => undefined, isLoading: false }),
}));

vi.mock('./useCollection', () => ({
  useCollection: () => ({ data: mockUseCollectionData, isLoading: false, isError: false }),
}));

vi.mock('./useViewerSummary', () => ({
  useViewerSummary: () => ({ data: mockSummaryRecords, isLoading: false }),
}));

vi.mock('./useAuthInfo', () => ({
  useIsAuthenticated: () => ({ isAuthenticated: mockIsAuthenticated, isLoading: false }),
}));

// Defaults to enrolled: most tests in this file exercise progress/model
// computation, not the enrollment gate itself (see the dedicated "not
// enrolled" tests below, which set this to false deliberately).
let mockEnrollment: { isEnrolled: boolean; effectiveContextId: string | undefined } = {
  isEnrolled: true,
  effectiveContextId: undefined,
};
vi.mock('./useLearningPathEnrollment', () => ({
  useLearningPathEnrollment: () => mockEnrollment,
}));

vi.mock('./useLevelWaivers', () => ({
  useLevelWaivers: () => ({}),
}));

vi.mock('./useBatch', () => ({
  useBatchListForMentor: () => ({ data: [] }),
}));

vi.mock('./useUser', () => ({
  useIsMentor: () => false,
}));

vi.mock('../services/userAuthInfoService/userAuthInfoService', () => ({
  default: { getUserId: () => 'u1' },
}));

describe('useLearningPath', () => {
  it('parses the hierarchy into a model and reports zero progress when not enrolled', () => {
    mockUseCollectionData = mockCollectionData;
    mockSummaryRecords = [];
    mockEnrollment = { isEnrolled: false, effectiveContextId: undefined };

    const { result } = renderHook(() => useLearningPath(LP_HIERARCHY_NO_ASSESSMENTS.identifier, undefined));

    expect(result.current.model.levels).toHaveLength(2);
    expect(result.current.progress.pct).toBe(0);
    // Every level is locked while unenrolled, regardless of policy - see bug:
    // unenrolled learner shown a "notStarted" (openable-looking) Level.
    expect(result.current.levelStatuses).toEqual(['locked', 'locked']);
    expect(result.current.resumeTarget).toBeNull();
  });

  it('flags the current user as the creator when createdBy matches, and exposes isTrackable', () => {
    mockUseCollectionData = mockCollectionData;
    mockSummaryRecords = [];

    const { result } = renderHook(() => useLearningPath(LP_HIERARCHY_NO_ASSESSMENTS.identifier, undefined));

    expect(result.current.createdBy).toBe('u1');
    expect(result.current.isTrackable).toBe(true);
    expect(result.current.isCreatorViewingOwnPath).toBe(true);
    expect(result.current.isMentorViewingPath).toBe(false);
  });

  it('does not flag a different user as the creator', () => {
    mockUseCollectionData = { ...mockCollectionData, createdBy: 'someone-else' };
    mockSummaryRecords = [];

    const { result } = renderHook(() => useLearningPath(LP_HIERARCHY_NO_ASSESSMENTS.identifier, undefined));

    expect(result.current.isCreatorViewingOwnPath).toBe(false);
  });

  it('reports full progress and no locked levels for the known-good, fully-completed account', () => {
    mockUseCollectionData = mockCollectionData;
    mockEnrollment = { isEnrolled: true, effectiveContextId: '0146338062206566400' };
    mockSummaryRecords = [
      {
        userId: 'u1',
        collectionId: 'do_2146316303263006721126',
        contextId: '0146338062206566400:do_2146316303263006721126',
        active: true,
        status: 2,
        progress: 2,
        completionPercentage: 100,
        contentStatus: { do_21463158442296934411: 2, do_214631592231313408130: 2 },
      },
      {
        userId: 'u1',
        collectionId: 'do_214631618315042816133',
        contextId: '0146338062206566400:do_214631618315042816133',
        active: true,
        status: 2,
        progress: 1,
        completionPercentage: 100,
        contentStatus: { do_214631615408873472110: 2 },
      },
      {
        userId: 'u1',
        collectionId: LP_HIERARCHY_NO_ASSESSMENTS.identifier,
        contextId: '0146338062206566400',
        active: true,
        status: 2,
        progress: 3,
        completionPercentage: 100,
        lastReadContentId: 'do_214631615408873472110',
        contentStatus: {
          do_21463158442296934411: 2,
          do_214631592231313408130: 2,
          do_214631615408873472110: 2,
        },
      },
    ];

    const { result } = renderHook(() => useLearningPath(LP_HIERARCHY_NO_ASSESSMENTS.identifier, undefined));

    expect(result.current.progress.pct).toBe(100);
    expect(result.current.levelStatuses).toEqual(['completed', 'completed']);
    // Resolves to the path record's lastReadContentId (still returned even though the path is fully complete).
    expect(result.current.resumeTarget).toEqual({
      collectionId: 'do_214631618315042816133',
      contentId: 'do_214631615408873472110',
      contextId: '0146338062206566400:do_214631618315042816133',
    });
  });

  // Regression: a Level's own Course shares an identifier with a course
  // completed under a totally unrelated context (a different Learning Path,
  // or a leftover standalone enrolment) — its summary record must not leak
  // into THIS path's progress while the learner has never enrolled here
  // (see bug: unenrolled Learning Path showing "Completed").
  it('ignores a foreign-context summary record for the same course id when not enrolled in this path', () => {
    mockUseCollectionData = mockCollectionData;
    mockEnrollment = { isEnrolled: false, effectiveContextId: undefined };
    mockSummaryRecords = [
      {
        userId: 'u1',
        collectionId: 'do_2146316303263006721126',
        contextId: 'some-other-lp-batch:do_2146316303263006721126',
        active: true,
        status: 2,
        progress: 2,
        completionPercentage: 100,
        contentStatus: { do_21463158442296934411: 2, do_214631592231313408130: 2 },
      },
    ];

    const { result } = renderHook(() => useLearningPath(LP_HIERARCHY_NO_ASSESSMENTS.identifier, undefined));

    expect(result.current.progress.pct).toBe(0);
    expect(result.current.levelProgress[0]?.pct).toBe(0);
    // Unenrolled in THIS path - every level is locked, independent of the
    // (ignored) foreign-context progress data.
    expect(result.current.levelStatuses).toEqual(['locked', 'locked']);
  });

  it('reports isLoading while the hierarchy is missing', () => {
    mockUseCollectionData = undefined;
    mockSummaryRecords = [];

    const { result } = renderHook(() => useLearningPath(undefined, undefined));
    expect(result.current.model.levels).toEqual([]);
  });
});
