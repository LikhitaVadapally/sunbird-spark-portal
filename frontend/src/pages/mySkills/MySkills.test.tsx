import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MySkills from './MySkills';
import { useMySkills } from '@/hooks/useMySkills';
import { useSkillSuggestions } from '@/hooks/useSkillSuggestions';
import type { PathSkillSummary } from '@/services/learningPath/skillAggregation';
import type { MySkillEntry } from '@/services/skill/mySkills';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

vi.mock('@/hooks/useImpression', () => ({ default: vi.fn() }));

const mockToast = vi.fn();
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ toast: mockToast }) }));

vi.mock('@/hooks/useMySkills', () => ({ useMySkills: vi.fn() }));
vi.mock('@/hooks/useSkillSuggestions', () => ({ useSkillSuggestions: vi.fn() }));

const mockUseMySkills = vi.mocked(useMySkills);
const mockUseSkillSuggestions = vi.mocked(useSkillSuggestions);

const NAMES: Record<string, { name: string; group?: string }> = {
  sql: { name: 'SQL', group: 'Data' },
  aws: { name: 'AWS', group: 'Cloud' },
};
const labelOf = (code: string) => ({ ...(NAMES[code] ?? { name: code }), resolved: Boolean(NAMES[code]) });

function summary(overrides: Partial<PathSkillSummary> = {}): PathSkillSummary {
  return {
    pathId: 'p1',
    contextId: 'ctx1',
    pathName: 'Data Foundations',
    progressPct: 100,
    status: 'completed',
    taughtCodes: ['sql'],
    unfinishedCodes: [],
    ...overrides,
  };
}

const gainedSql: MySkillEntry = { code: 'sql', gained: true, source: 'course', gainedAt: 10 * 86_400_000, evidence: [], paths: [] };
const pendingAws: MySkillEntry = {
  code: 'aws',
  gained: false,
  evidence: [],
  paths: [{ pathId: 'p2', contextId: 'ctx2', pathName: 'Cloud Basics' }],
};

function baseResult(overrides: Partial<ReturnType<typeof useMySkills>> = {}): ReturnType<typeof useMySkills> {
  return {
    entries: [],
    summaries: [],
    skills: [],
    heldCodes: new Set(),
    aggregate: { totalSkills: 0, gainedSkills: 0, pendingSkills: 0, pathsCompleted: 0, pathsOngoing: 0 },
    labelOf,
    labelsLoading: false,
    analyzedCount: 0,
    totalCount: 0,
    isLoading: false,
    isError: false,
    profileError: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function withSkills(skills: MySkillEntry[], overrides: Partial<ReturnType<typeof useMySkills>> = {}) {
  const s = summary();
  return baseResult({
    entries: [{ path: { pathId: 'p1', contextId: 'ctx1', name: 'Data Foundations' }, summary: s, isLoading: false, isError: false }],
    summaries: [s],
    skills,
    heldCodes: new Set(skills.filter((e) => e.gained).map((e) => e.code)),
    analyzedCount: 1,
    totalCount: 1,
    ...overrides,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MySkills />
    </MemoryRouter>
  );
}

describe('MySkills', () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockUseSkillSuggestions.mockReturnValue({ suggestions: [], isLoading: false });
  });

  it('shows a loading state', () => {
    mockUseMySkills.mockReturnValue(baseResult({ isLoading: true }));
    renderPage();
    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
  });

  it('shows an error state with retry', () => {
    mockUseMySkills.mockReturnValue(baseResult({ isError: true }));
    renderPage();
    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
  });

  it('shows an empty state when there are no skills and no enrolled paths', () => {
    mockUseMySkills.mockReturnValue(baseResult());
    renderPage();
    expect(screen.getByText('mySkills.noSkills')).toBeInTheDocument();
  });

  // A standalone course or an external certificate is a skill too - no Learning Path needed.
  it('lists gained skills even with no enrolled Learning Paths', () => {
    mockUseMySkills.mockReturnValue(baseResult({ skills: [gainedSql] }));
    renderPage();
    expect(screen.getByTestId('skill-card-gained')).toHaveTextContent('SQL');
  });

  it('shows one card per skill with its resolved name and group', () => {
    mockUseMySkills.mockReturnValue(withSkills([gainedSql, pendingAws]));
    renderPage();

    expect(screen.getByTestId('my-skills-hero')).toBeInTheDocument();
    expect(screen.getByTestId('skill-card-gained')).toHaveTextContent('SQL');
    expect(screen.getByTestId('skill-card-gained')).toHaveTextContent('Data');
    expect(screen.getByTestId('skill-card-pending')).toHaveTextContent('AWS');
  });

  it('holds skeletons instead of slugs while framework names load', () => {
    mockUseMySkills.mockReturnValue(withSkills([gainedSql], { labelsLoading: true }));
    renderPage();
    expect(screen.getByTestId('skill-card-skeletons')).toBeInTheDocument();
    expect(screen.queryByTestId('skill-card-gained')).not.toBeInTheDocument();
  });

  it('reveals which path a pending skill is still in when its card is expanded', () => {
    mockUseMySkills.mockReturnValue(withSkills([pendingAws]));
    renderPage();

    fireEvent.click(screen.getByText('AWS'));
    expect(screen.getByText('Cloud Basics').closest('a')).toHaveAttribute('href', '/learning-path/p2/batch/ctx2/status');
  });

  it('switches to the path view and lists the enrolled paths', () => {
    mockUseMySkills.mockReturnValue(withSkills([gainedSql]));
    renderPage();

    fireEvent.click(screen.getByText('mySkills.viewByPath'));
    expect(screen.getByTestId('skill-path-accordion')).toBeInTheDocument();
    expect(screen.getByText('Data Foundations')).toBeInTheDocument();
  });

  it('narrows the skill list by search query on the displayed name', () => {
    mockUseMySkills.mockReturnValue(withSkills([gainedSql, pendingAws]));
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('mySkills.searchPlaceholder'), { target: { value: 'aws' } });

    expect(screen.queryByTestId('skill-card-gained')).not.toBeInTheDocument();
    expect(screen.getByTestId('skill-card-pending')).toHaveTextContent('AWS');
  });

  it('offers a group filter built from the skills shown', () => {
    mockUseMySkills.mockReturnValue(withSkills([gainedSql, pendingAws]));
    renderPage();
    expect(screen.getByLabelText('mySkills.groupFilterLabel')).toHaveTextContent('mySkills.allGroups');
  });

  it('reveals more skills via the load more button', () => {
    const many: MySkillEntry[] = Array.from({ length: 30 }, (_, i) => ({
      code: `skill-${String(i).padStart(2, '0')}`,
      gained: false,
      evidence: [],
      paths: [],
    }));
    mockUseMySkills.mockReturnValue(withSkills(many));
    renderPage();

    expect(screen.queryByText('skill-29')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('mySkills.loadMore'));
    expect(screen.getByText('skill-29')).toBeInTheDocument();
  });

  it('shows the skills-you-could-gain-next row with resolved names', () => {
    mockUseMySkills.mockReturnValue(withSkills([gainedSql]));
    mockUseSkillSuggestions.mockReturnValue({
      suggestions: [{ pathId: 'p2', pathName: 'Cloud Basics', source: 'discover', progressPct: 0, newSkills: ['aws'], totalSkills: 1 }],
      isLoading: false,
    });
    renderPage();

    expect(screen.getByTestId('skill-suggestion-row')).toHaveTextContent('AWS');
    // Held codes from the profile are what suggestions measure against.
    expect(mockUseSkillSuggestions).toHaveBeenCalledWith(expect.anything(), ['p1'], new Set(['sql']));
  });

  it('shows the skill growth chart once at least two distinct gained days exist', () => {
    mockUseMySkills.mockReturnValue(
      withSkills([gainedSql, { ...gainedSql, code: 'python', gainedAt: 12 * 86_400_000 }])
    );
    renderPage();
    expect(screen.getByTestId('skill-growth-chart')).toBeInTheDocument();
  });

  it('warns with a banner and a toast when the skill profile fails to load', () => {
    mockUseMySkills.mockReturnValue(withSkills([pendingAws], { profileError: true }));
    renderPage();
    expect(screen.getByTestId('my-skills-profile-error')).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'mySkills.profileError' }));
  });
});
