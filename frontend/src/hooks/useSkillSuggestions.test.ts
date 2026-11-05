import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSkillSuggestions } from './useSkillSuggestions';
import type { PathSkillSummary } from '../services/learningPath/skillAggregation';
import type { HierarchyContentNode } from '../types/collectionTypes';

const mockUseContentSearch = vi.fn();
vi.mock('./useContent', () => ({
  useContentSearch: (...args: unknown[]) => mockUseContentSearch(...args),
}));

// Real collectionHierarchyQueryOptions calls collectionService.getHierarchy — stub it with an
// in-memory map keyed by collectionId, so useQueries actually resolves through react-query.
const hierarchyByCollectionId = new Map<string, HierarchyContentNode>();
vi.mock('./useCollection', () => ({
  collectionHierarchyQueryOptions: (collectionId: string | undefined) => ({
    queryKey: ['collection-hierarchy', collectionId],
    queryFn: async () => {
      const root = collectionId ? hierarchyByCollectionId.get(collectionId) : undefined;
      return root ? { hierarchyRoot: root } : null;
    },
    enabled: !!collectionId,
  }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function levelHierarchyNode(id: string, skills: string[]): HierarchyContentNode {
  return {
    identifier: id,
    name: `Level ${id}`,
    mimeType: 'application/vnd.ekstep.content-collection',
    objectType: 'CourseUnit',
    children: [],
    skill: skills,
  } as unknown as HierarchyContentNode;
}

function pathHierarchyRoot(id: string, name: string, skills: string[]): HierarchyContentNode {
  return {
    identifier: id,
    name,
    primaryCategory: 'Learning Path',
    mimeType: 'application/vnd.ekstep.content-collection',
    objectType: 'Collection',
    children: [levelHierarchyNode(`${id}-lvl1`, skills)],
  } as unknown as HierarchyContentNode;
}

function summary(overrides: Partial<PathSkillSummary> & { taughtCodes: string[] }): PathSkillSummary {
  return {
    pathId: 'p1',
    contextId: 'ctx1',
    pathName: 'Path One',
    progressPct: 40,
    status: 'ongoing',
    unfinishedCodes: overrides.taughtCodes,
    ...overrides,
  };
}

const NONE: ReadonlySet<string> = new Set();

describe('useSkillSuggestions', () => {
  beforeEach(() => {
    hierarchyByCollectionId.clear();
    mockUseContentSearch.mockReturnValue({ data: { data: { content: [] } }, isLoading: false });
  });

  it('surfaces enrolled-incomplete paths with their not-yet-gained skills', () => {
    const summaries = [
      summary({ pathId: 'p1', pathName: 'Data Foundations', status: 'ongoing', taughtCodes: ['sql', 'python'] }),
    ];

    const { result } = renderHook(() => useSkillSuggestions(summaries, ['p1'], new Set(['sql'])), { wrapper });

    expect(result.current.suggestions).toEqual([
      expect.objectContaining({ pathId: 'p1', source: 'enrolled', newSkills: ['python'] }),
    ]);
  });

  it('excludes completed enrolled paths', () => {
    const summaries = [
      summary({ pathId: 'p1', status: 'completed', taughtCodes: ['sql'] }),
    ];

    const { result } = renderHook(() => useSkillSuggestions(summaries, ['p1'], NONE), { wrapper });
    expect(result.current.suggestions).toEqual([]);
  });

  it('excludes an enrolled path with no new skills left to gain', () => {
    const summaries = [summary({ pathId: 'p1', status: 'ongoing', taughtCodes: ['sql'] })];

    const { result } = renderHook(() => useSkillSuggestions(summaries, ['p1'], new Set(['sql'])), { wrapper });
    expect(result.current.suggestions).toEqual([]);
  });

  // A skill held from a standalone course or an external certificate is not "new" anywhere.
  it('treats a skill held from any source as already gained for discovered paths', async () => {
    hierarchyByCollectionId.set('disc-1', pathHierarchyRoot('disc-1', 'Cloud Basics', ['cloud', 'networking']));
    mockUseContentSearch.mockReturnValue({
      data: { data: { content: [{ identifier: 'disc-1', name: 'Cloud Basics' }] } },
      isLoading: false,
    });

    const { result } = renderHook(() => useSkillSuggestions([], [], new Set(['cloud'])), { wrapper });

    await waitFor(() => {
      expect(result.current.suggestions).toEqual([
        expect.objectContaining({ pathId: 'disc-1', newSkills: ['networking'], totalSkills: 2 }),
      ]);
    });
  });

  it('fetches hierarchies for discovered unenrolled paths and surfaces their new skills', async () => {
    hierarchyByCollectionId.set('disc-1', pathHierarchyRoot('disc-1', 'Cloud Basics', ['cloud', 'networking']));
    mockUseContentSearch.mockReturnValue({
      data: { data: { content: [{ identifier: 'disc-1', name: 'Cloud Basics' }] } },
      isLoading: false,
    });

    const { result } = renderHook(() => useSkillSuggestions([], [], NONE), { wrapper });

    await waitFor(() => {
      expect(result.current.suggestions).toEqual([
        expect.objectContaining({ pathId: 'disc-1', source: 'discover', newSkills: ['cloud', 'networking'] }),
      ]);
    });
  });

  it('excludes discovered paths the learner is already enrolled in', () => {
    mockUseContentSearch.mockReturnValue({
      data: { data: { content: [{ identifier: 'enrolled-1', name: 'Already In' }] } },
      isLoading: false,
    });

    const { result } = renderHook(() => useSkillSuggestions([], ['enrolled-1'], NONE), { wrapper });
    expect(result.current.suggestions).toEqual([]);
  });

  it('ranks by number of new skills, with enrolled ahead of discover on ties', async () => {
    hierarchyByCollectionId.set('disc-1', pathHierarchyRoot('disc-1', 'Cloud Basics', ['cloud']));
    mockUseContentSearch.mockReturnValue({
      data: { data: { content: [{ identifier: 'disc-1', name: 'Cloud Basics' }] } },
      isLoading: false,
    });

    const summaries = [
      summary({ pathId: 'p1', pathName: 'Data Foundations', taughtCodes: ['sql', 'python'] }),
      summary({ pathId: 'p2', pathName: 'Web Basics', taughtCodes: ['html'] }),
    ];

    const { result } = renderHook(() => useSkillSuggestions(summaries, ['p1', 'p2'], NONE), { wrapper });

    await waitFor(() => {
      expect(result.current.suggestions.map((s) => s.pathId)).toEqual(['p1', 'p2', 'disc-1']);
    });
  });
});
