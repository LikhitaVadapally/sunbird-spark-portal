import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LearningPathStatusView } from './LearningPathStatusView';
import type { LPLevelNode } from '@/types/learningPathTypes';
import type { UsePathSkillsResult } from '@/hooks/usePathSkills';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({ t: (key: string) => key }),
}));

const level1: LPLevelNode = {
  identifier: 'level_1',
  name: 'Foundations',
  index: 1,
  skills: ['SQL'], skillCodes: ['sql'],
  courses: [
    { identifier: 'course_1', name: 'Intro to SQL', leafNodesCount: 1, leafIds: ['res_1'], skills: [], skillCodes: [], isAssessmentCourse: false },
  ],
};

const level2: LPLevelNode = {
  identifier: 'level_2',
  name: 'Advanced',
  index: 2,
  skills: ['Python'], skillCodes: ['python'],
  courses: [],
};

function buildLp(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    model: {
      identifier: 'lp1',
      name: 'Data Foundations',
      policy: 'Fixed',
      levels: [level1, level2],
      allSkills: ['SQL', 'Python'], allSkillCodes: [],
      courseTotal: 1,
      leafTotal: 1,
    },
    progress: { pct: 50, completed: 1, total: 2, doneLevels: 1, levelCount: 2 },
    levelProgress: [
      { pct: 100, completed: 1, total: 1, doneCourses: 1 },
      { pct: 0, completed: 0, total: 1, doneCourses: 0 },
    ],
    levelStatuses: ['completed', 'locked'],
    pathSummary: undefined,
    summaryByCollectionId: new Map(),
    isCreatorViewingOwnPath: false,
    isMentorViewingPath: false,
    ...overrides,
  } as any;
}

const NAMES: Record<string, string> = { sql: 'SQL', python: 'Python' };

/** Gained comes from the skill profile, not from level completion - so it is passed in. */
function buildPathSkills(held: string[] = ['sql']): UsePathSkillsResult {
  const heldCodes = new Set(held);
  const skills = ['sql', 'python'].map((code) => ({
    code,
    state: heldCodes.has(code) ? ('held' as const) : ('pending' as const),
  }));
  return {
    summary: { skills, held: held.length, total: skills.length },
    heldCodes,
    stateOf: (code) => skills.find((s) => s.code === code),
    name: (code) => NAMES[code] ?? code,
    isLoading: false,
  };
}

function renderView(lp = buildLp(), pathSkills = buildPathSkills()) {
  return render(
    <MemoryRouter>
      <LearningPathStatusView lp={lp} pathLink="/learning-path/lp1/batch/b1" pathSkills={pathSkills} />
    </MemoryRouter>
  );
}

describe('LearningPathStatusView', () => {
  it('renders the path title and one timeline node per level', () => {
    renderView();
    expect(screen.getByText('Data Foundations')).toBeInTheDocument();
    expect(screen.getAllByTestId('status-timeline-node')).toHaveLength(2);
  });

  it('separates gained skills from pending ones in the skill panel', () => {
    renderView();
    const panel = screen.getByTestId('skill-panel');
    expect(panel.querySelector('[data-testid="skill-chip-gained"]')).toHaveTextContent('SQL');
    expect(panel.querySelector('[data-testid="skill-chip-pending"]')).toHaveTextContent('Python');
  });

  // A locked level is still a level the learner should be able to inspect here.
  it('expands every level by default, including one the policy has locked', () => {
    renderView();
    expect(screen.getByText('Intro to SQL')).toBeInTheDocument();
    expect(screen.getAllByText('learningPath.skillsInThisLevel')).toHaveLength(2);
  });

  it('collapses and re-expands a level on click', () => {
    renderView();
    const [node0] = screen.getAllByTestId('status-timeline-node');
    if (!node0) throw new Error('expected a timeline node');
    const toggle = node0.querySelector('button');
    if (!toggle) throw new Error('expected a toggle button');

    fireEvent.click(toggle);
    expect(screen.queryByText('Intro to SQL')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText('Intro to SQL')).toBeInTheDocument();
  });

  it('offers exactly one navigation affordance: the link back into the Learning Path', () => {
    renderView();
    expect(screen.getByTestId('status-open-path-link')).toHaveAttribute('href', '/learning-path/lp1/batch/b1');
    expect(screen.queryByText(/openLevelDetail/)).not.toBeInTheDocument();
  });

  it('filters the timeline to the levels teaching a selected skill', () => {
    renderView();
    const panel = screen.getByTestId('skill-panel');
    const sqlTag = panel.querySelector('[data-testid="skill-chip-gained"]');
    if (!(sqlTag instanceof HTMLElement)) throw new Error('expected a gained skill tag');

    fireEvent.click(sqlTag);
    expect(screen.getByTestId('skill-filter-clear')).toBeInTheDocument();

    const [node0, node1] = screen.getAllByTestId('status-timeline-node');
    expect(node0?.className).not.toContain('opacity-40');
    expect(node1?.className).toContain('opacity-40');

    fireEvent.click(screen.getByTestId('skill-filter-clear'));
    expect(screen.queryByTestId('skill-filter-clear')).not.toBeInTheDocument();
  });

  it('celebrates once every scoped skill is gained', () => {
    renderView(buildLp(), buildPathSkills(['sql', 'python']));
    expect(screen.getByText('learningPath.allSkillsGained')).toBeInTheDocument();
  });

  // Gained follows the skill profile: a level at 100% does not by itself mark its skills gained.
  it('does not count a completed level\'s skills as gained when the profile lacks them', () => {
    renderView(buildLp(), buildPathSkills([]));
    const panel = screen.getByTestId('skill-panel');
    expect(panel.querySelector('[data-testid="skill-chip-gained"]')).toBeNull();
  });

  it("shows the viewer note for a mentor viewing another learner's status", () => {
    renderView(buildLp({ isMentorViewingPath: true }));
    expect(screen.getByTestId('status-viewer-note')).toBeInTheDocument();
  });
});
