import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LearningPathRailContainer } from './LearningPathRailContainer';

let mockSearchParams = new URLSearchParams();
let mockParams: Record<string, string | undefined> = {};
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams],
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

let mockLpResult: any;
vi.mock('@/hooks/useLearningPath', () => ({
  useLearningPath: (pathId: string | undefined, contextId: string | undefined) => mockLpResult(pathId, contextId),
}));

vi.mock('@/hooks/usePathSkills', () => ({
  usePathSkills: () => ({ name: (c: string) => c, stateOf: () => undefined }),
}));

vi.mock('./LearningPathRail', () => ({
  LearningPathRail: ({ pathTitle }: { pathTitle: string }) => <div data-testid="lp-rail">{pathTitle}</div>,
}));

describe('LearningPathRailContainer', () => {
  it('renders nothing when there is no ?lp= param', () => {
    mockSearchParams = new URLSearchParams();
    mockLpResult = () => ({ isLoading: false, model: { identifier: '' } });
    const { container } = render(<LearningPathRailContainer courseContextId="lpbatch:course_1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the Learning Path data is loading', () => {
    mockSearchParams = new URLSearchParams('lp=do_lp_1');
    mockLpResult = () => ({ isLoading: true, model: { identifier: '' } });
    const { container } = render(<LearningPathRailContainer courseContextId="lpbatch:course_1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the rail once the Learning Path data resolves, parsing the lpContextId from the composite courseContextId', () => {
    mockSearchParams = new URLSearchParams('lp=do_lp_1');
    mockLpResult = vi.fn((pathId, contextId) => {
      expect(pathId).toBe('do_lp_1');
      expect(contextId).toBe('lpbatch');
      return {
        isLoading: false,
        model: { identifier: 'do_lp_1', name: 'Data Foundations' },
        progress: { pct: 0 },
        levelProgress: [],
        levelStatuses: [],
        priorState: { done: false },
        outcomeState: { unlocked: false },
        enrollment: { isEnrolled: true },
      };
    });

    render(<LearningPathRailContainer courseContextId="lpbatch:course_1" />);
    expect(screen.getByTestId('lp-rail')).toHaveTextContent('Data Foundations');
  });

  it('passes undefined lpContextId when courseContextId is a plain (non-composite) id', () => {
    mockSearchParams = new URLSearchParams('lp=do_lp_1');
    mockLpResult = vi.fn((pathId, contextId) => {
      expect(contextId).toBeUndefined();
      return { isLoading: false, model: { identifier: '' } };
    });

    render(<LearningPathRailContainer courseContextId="plainbatch" />);
    expect(mockLpResult).toHaveBeenCalled();
  });
});
