import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMySkills } from './useMySkills';
import { LP_HIERARCHY_NO_ASSESSMENTS } from '../services/learningPath/__fixtures__/lpHierarchyNoAssessments.fixture';
import type { TrackableCollection } from '../types/TrackableCollections';
import type { HeldSkill } from '../types/skillServiceTypes';

const LP_ID = LP_HIERARCHY_NO_ASSESSMENTS.identifier;

let mockCourses: TrackableCollection[] = [];

vi.mock('./useUserEnrolledCollections', () => ({
  useUserEnrolledCollections: () => ({
    data: { data: { courses: mockCourses } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('./useViewerSummary', () => ({
  useViewerSummary: () => ({ data: [], isLoading: false }),
}));

let mockHeld: HeldSkill[] = [];
// USF names -> codes, as the framework vocabulary would resolve them.
const USF_CODES: Record<string, string> = { 'python programming': 'pp', 'java programming': 'jp', javascript: 'js' };
let mockProfileError = false;
vi.mock('./useSkillProfile', () => ({
  useSkillProfile: () => ({
    skills: mockHeld,
    frameworkIds: [],
    isLoading: false,
    isError: mockProfileError,
    refetch: vi.fn(),
  }),
  useSkillLabels: () => ({
    labelOf: (code: string) => ({ name: code, resolved: false }),
    codeOf: (tag: string) => USF_CODES[tag.toLowerCase()] ?? tag,
    isLoading: false,
  }),
}));

vi.mock('../services/collection', () => ({
  collectionService: {
    getHierarchy: vi.fn(async () => ({ data: { content: LP_HIERARCHY_NO_ASSESSMENTS } })),
  },
  mapToCollectionData: (content: typeof LP_HIERARCHY_NO_ASSESSMENTS) => ({
    id: content.identifier,
    title: content.name ?? '',
    hierarchyRoot: content,
    children: content.children ?? [],
  }),
}));

function learningPathEnrollment(overrides: Partial<TrackableCollection>): TrackableCollection {
  return {
    courseId: LP_ID,
    courseName: 'TLP-1',
    collectionId: LP_ID,
    contentId: LP_ID,
    batchId: 'batch-1',
    userId: 'u1',
    addedBy: 'u1',
    active: true,
    status: 1,
    completionPercentage: 0,
    progress: 0,
    leafNodesCount: 3,
    description: '',
    courseLogoUrl: '',
    dateTime: 0,
    enrolledDate: 0,
    content: { primaryCategory: 'Learning Path', name: 'TLP-1' } as TrackableCollection['content'],
    ...overrides,
  } as TrackableCollection;
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useMySkills', () => {
  beforeEach(() => {
    mockCourses = [];
    mockHeld = [];
    mockProfileError = false;
  });

  // A skill from a standalone course or an external certificate needs no Learning Path.
  it('lists profile skills as gained even with no enrolled paths', () => {
    mockHeld = [{ skillId: 'nrp', frameworkId: 'fw', sourceType: 'EXTERNAL', evidence: [] }];
    const { result } = renderHook(() => useMySkills(), { wrapper });
    expect(result.current.skills).toEqual([expect.objectContaining({ code: 'nrp', gained: true, source: 'external' })]);
    expect(result.current.aggregate.gainedSkills).toBe(1);
    expect(result.current.heldCodes.has('nrp')).toBe(true);
  });

  it('surfaces a profile failure without failing the whole page', () => {
    mockProfileError = true;
    const { result } = renderHook(() => useMySkills(), { wrapper });
    expect(result.current.profileError).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('returns no paths when there are no enrollments', () => {
    const { result } = renderHook(() => useMySkills(), { wrapper });
    expect(result.current.totalCount).toBe(0);
    expect(result.current.entries).toEqual([]);
  });

  it('excludes non-Learning-Path enrollments', () => {
    mockCourses = [
      learningPathEnrollment({
        courseId: 'course-1',
        batchId: 'batch-2',
        content: { primaryCategory: 'Course', name: 'A Course' } as TrackableCollection['content'],
      }),
    ];
    const { result } = renderHook(() => useMySkills(), { wrapper });
    expect(result.current.totalCount).toBe(0);
  });

  it('excludes the composite per-course records a Learning Path enrolment fans out', () => {
    mockCourses = [learningPathEnrollment({ batchId: 'lp-batch:course-x' })];
    const { result } = renderHook(() => useMySkills(), { wrapper });
    expect(result.current.totalCount).toBe(0);
  });

  it('fetches the hierarchy for an enrolled Learning Path and builds its skill summary', async () => {
    mockCourses = [learningPathEnrollment({})];
    const { result } = renderHook(() => useMySkills(), { wrapper });

    expect(result.current.totalCount).toBe(1);
    await waitFor(() => expect(result.current.analyzedCount).toBe(1));

    expect(result.current.entries[0]?.summary?.pathId).toBe(LP_ID);
    expect(result.current.entries[0]?.summary?.taughtCodes.length).toBeGreaterThan(0);
  });

  // USF paths are tagged by NAME; the profile holds the CODE the skill service awarded.
  it('matches a USF path tag to the held code, so an earned skill is gained, not pending', async () => {
    mockCourses = [learningPathEnrollment({})];
    mockHeld = [{ skillId: 'pp', frameworkId: 'USF', sourceType: 'COURSE', evidence: [] }];
    const { result } = renderHook(() => useMySkills(), { wrapper });
    await waitFor(() => expect(result.current.analyzedCount).toBe(1));

    expect(result.current.entries[0]?.summary?.taughtCodes).toEqual(expect.arrayContaining(['pp', 'jp', 'js']));
    const pp = result.current.skills.filter((s) => s.code === 'pp');
    expect(pp).toEqual([expect.objectContaining({ gained: true })]);
    expect(result.current.skills.some((s) => s.code === 'Python Programming')).toBe(false);
  });

  it('names course evidence by the course, not its id', () => {
    mockCourses = [
      learningPathEnrollment({
        courseId: 'do_course',
        content: { primaryCategory: 'Course', name: 'skill course' } as TrackableCollection['content'],
      }),
    ];
    mockHeld = [
      {
        skillId: 'dv',
        frameworkId: 'USF',
        sourceType: 'COURSE',
        evidence: [{ evidenceId: 'e1', sourceType: 'COURSE', sourceId: 'do_course', revoked: false }],
      },
    ];
    const { result } = renderHook(() => useMySkills(), { wrapper });
    expect(result.current.skills[0]?.evidence[0]?.sourceName).toBe('skill course');
  });
});
