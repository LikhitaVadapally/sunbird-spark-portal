import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SkillPathAccordion } from './SkillPathAccordion';
import type { ComponentProps } from 'react';
import type { PathSkillSummary } from '@/services/learningPath/skillAggregation';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

function summary(overrides: Partial<PathSkillSummary> = {}): PathSkillSummary {
  return {
    pathId: 'path-1',
    contextId: 'ctx-1',
    pathName: 'Data Foundations',
    progressPct: 50,
    status: 'ongoing',
    taughtCodes: ['sql', 'python'],
    unfinishedCodes: ['python'],
    ...overrides,
  };
}

const HELD: ReadonlySet<string> = new Set(['sql']);
const nameOf = (code: string) => code.toUpperCase();

function renderAccordion(props: Partial<ComponentProps<typeof SkillPathAccordion>> = {}) {
  return render(
    <MemoryRouter>
      <SkillPathAccordion
        pathName="Data Foundations"
        summary={summary()}
        heldCodes={HELD}
        nameOf={nameOf}
        isLoading={false}
        isExpanded={false}
        onToggle={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );
}

describe('SkillPathAccordion', () => {
  it('shows a skeleton while the path is still loading', () => {
    renderAccordion({ summary: undefined, isLoading: true });
    expect(screen.getByTestId('skill-path-skeleton')).toBeInTheDocument();
  });

  it('renders the collapsed summary without skill tags', () => {
    renderAccordion();
    expect(screen.getByText('Data Foundations')).toBeInTheDocument();
    expect(screen.queryByTestId('skill-chip-gained')).not.toBeInTheDocument();
  });

  it('expands to show gained and pending skill groups plus the status link', () => {
    renderAccordion({ isExpanded: true });

    const gained = screen.getAllByTestId('skill-chip-gained');
    const pending = screen.getAllByTestId('skill-chip-pending');
    expect(gained).toHaveLength(1);
    expect(pending).toHaveLength(1);
    // Names, not codes.
    expect(gained[0]).toHaveTextContent('SQL');

    const link = screen.getByText('mySkills.viewPathStatus').closest('a');
    expect(link).toHaveAttribute('href', '/learning-path/path-1/batch/ctx-1/status');
  });

  // Held from any source counts: a skill gained outside this path is gained here too.
  it('counts a skill held from elsewhere as gained, never pending', () => {
    renderAccordion({ isExpanded: true, heldCodes: new Set(['sql', 'python']) });
    expect(screen.getAllByTestId('skill-chip-gained')).toHaveLength(2);
    expect(screen.queryByTestId('skill-chip-pending')).not.toBeInTheDocument();
  });

  it('toggles expansion on click', () => {
    const onToggle = vi.fn();
    renderAccordion({ onToggle });
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // Regression: the "View path status" link didn't set `state.from`, so
  // useLearningPathBackNavigation's Go Back always fell through to its
  // /explore default instead of returning to My Skills (see bug: Go Back
  // from a Learning Path opened via My Skills lands on Explore).
  it('sets state.from to the current page so Go Back can return to My Skills', () => {
    function LocationState() {
      const location = useLocation();
      return <div data-testid="location-state">{JSON.stringify(location.state)}</div>;
    }

    render(
      <MemoryRouter initialEntries={['/my-skills']}>
        <Routes>
          <Route
            path="/my-skills"
            element={
              <SkillPathAccordion
                pathName="Data Foundations"
                summary={summary()}
                heldCodes={HELD}
                nameOf={nameOf}
                isLoading={false}
                isExpanded
                onToggle={vi.fn()}
              />
            }
          />
          <Route path="/learning-path/:pathId/batch/:contextId/status" element={<LocationState />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('mySkills.viewPathStatus'));
    expect(screen.getByTestId('location-state')).toHaveTextContent('{"from":"/my-skills"}');
  });
});
