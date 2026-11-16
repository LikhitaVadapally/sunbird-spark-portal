import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LedgerTable } from './LedgerTable';
import type { LearningPathModel, LevelProgressInfo, LevelStatusKey } from '../../types/learningPathTypes';
import type { ViewerSummaryRecord } from '../../types/viewerServiceTypes';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}));

function buildModel(): LearningPathModel {
  return {
    identifier: 'lp_1',
    name: 'TLP-3',
    policy: 'Diagnostic',
    levels: [
      {
        identifier: 'level_1',
        name: 'Level-1',
        index: 0,
        skills: [], skillCodes: [],
        courses: [
          {
            identifier: 'course_1',
            name: 'LP-Course-1',
            leafNodesCount: 1,
            leafIds: ['leaf_1'],
            skills: [], skillCodes: [],
            isAssessmentCourse: false,
          },
        ],
      },
    ],
    outcomeAssessment: {
      identifier: 'course_outcome',
      name: 'LP-PostAssess-Course',
      leafNodesCount: 1,
      leafIds: ['leaf_outcome'],
      skills: [], skillCodes: [],
      isAssessmentCourse: true,
    },
    allSkills: [], allSkillCodes: [],
    courseTotal: 2,
    leafTotal: 2,
  };
}

const levelProgress: LevelProgressInfo[] = [{ pct: 100, completed: 1, total: 1, doneCourses: 1 }];
const levelStatuses: LevelStatusKey[] = ['completed'];

function renderTable(overrides: Partial<Parameters<typeof LedgerTable>[0]> = {}) {
  const onOpenOutcome = vi.fn();
  render(
    <LedgerTable
      model={buildModel()}
      levelProgress={levelProgress}
      levelStatuses={levelStatuses}
      priorProgress={null}
      priorDone
      outcomeUnlocked
      outcomeProgress={{ pct: 0, completed: 0, total: 1, status: 'notStarted' }}
      summaryByCollectionId={new Map<string, ViewerSummaryRecord>()}
      isEnrolled
      onOpenLevel={vi.fn()}
      onOpenPrior={vi.fn()}
      onOpenOutcome={onOpenOutcome}
      onOpenCourse={vi.fn()}
      {...overrides}
    />
  );
  return { onOpenOutcome };
}

describe('LedgerTable outcome row', () => {
  // Regression: the row rendered a bare Badge, so an unlocked outcome assessment
  // showed "Start" but clicking it did nothing.
  it('opens the outcome assessment when clicked once every Level is complete', () => {
    const { onOpenOutcome } = renderTable();
    fireEvent.click(screen.getByTestId('ledger-outcome-row'));
    expect(onOpenOutcome).toHaveBeenCalledTimes(1);
  });

  it('does not open the outcome assessment while it is still locked', () => {
    const { onOpenOutcome } = renderTable({ outcomeUnlocked: false });
    fireEvent.click(screen.getByTestId('ledger-outcome-row'));
    expect(onOpenOutcome).not.toHaveBeenCalled();
    expect(screen.getByText('learningPath.locked')).toBeInTheDocument();
  });

  it('shows the outcome assessment as completed once it is done', () => {
    renderTable({ outcomeProgress: { pct: 100, completed: 1, total: 1, status: 'completed' } });
    const row = screen.getByTestId('ledger-outcome-row');
    expect(within(row).getByText('learningPath.statusCompleted')).toBeInTheDocument();
    expect(within(row).getByText('1/1')).toBeInTheDocument();
  });
});

function buildModelWithPrior(): LearningPathModel {
  return {
    ...buildModel(),
    priorAssessment: {
      identifier: 'course_prior',
      name: 'LP-PriorAssess-Course',
      leafNodesCount: 1,
      leafIds: ['leaf_prior'],
      skills: [], skillCodes: [],
      isAssessmentCourse: true,
    },
  };
}

describe('LedgerTable prior row', () => {
  // Regression: an unenrolled visitor saw "In progress" on the prior
  // assessment row (the binary priorDone check has no "not enrolled" state),
  // even though they haven't started - or been allowed to start - anything.
  it('shows Locked, not "In progress", when the learner is not enrolled', () => {
    renderTable({ model: buildModelWithPrior(), priorDone: false, isEnrolled: false });
    const row = screen.getByTestId('ledger-prior-row');
    expect(within(row).getByText('learningPath.statusLocked')).toBeInTheDocument();
    expect(within(row).queryByText('learningPath.statusInProgress')).not.toBeInTheDocument();
  });

  it('is not clickable when not enrolled', () => {
    const onOpenPrior = vi.fn();
    renderTable({ model: buildModelWithPrior(), priorDone: false, isEnrolled: false, onOpenPrior });
    fireEvent.click(screen.getByTestId('ledger-prior-row'));
    expect(onOpenPrior).not.toHaveBeenCalled();
  });

  it('shows Start when enrolled but not yet attempted', () => {
    renderTable({
      model: buildModelWithPrior(),
      priorDone: false,
      priorProgress: { pct: 0, completed: 0, total: 1, status: 'notStarted' },
      isEnrolled: true,
    });
    const row = screen.getByTestId('ledger-prior-row');
    expect(within(row).getByText('learningPath.start')).toBeInTheDocument();
  });

  it('shows In progress when enrolled and partially attempted', () => {
    renderTable({
      model: buildModelWithPrior(),
      priorDone: false,
      priorProgress: { pct: 50, completed: 0, total: 1, status: 'active' },
      isEnrolled: true,
    });
    const row = screen.getByTestId('ledger-prior-row');
    expect(within(row).getByText('learningPath.statusInProgress')).toBeInTheDocument();
  });

  it('shows Completed once the prior assessment is done', () => {
    renderTable({
      model: buildModelWithPrior(),
      priorDone: true,
      priorProgress: { pct: 100, completed: 1, total: 1, status: 'completed' },
      isEnrolled: true,
    });
    const row = screen.getByTestId('ledger-prior-row');
    expect(within(row).getByText('learningPath.statusCompleted')).toBeInTheDocument();
  });

  it('opens the prior assessment when clicked while enrolled', () => {
    const onOpenPrior = vi.fn();
    renderTable({
      model: buildModelWithPrior(),
      priorDone: false,
      priorProgress: { pct: 0, completed: 0, total: 1, status: 'notStarted' },
      isEnrolled: true,
      onOpenPrior,
    });
    fireEvent.click(screen.getByTestId('ledger-prior-row'));
    expect(onOpenPrior).toHaveBeenCalledTimes(1);
  });
});

describe('LedgerTable locked level', () => {
  // The first level starts open, so a click collapses it and a second one reopens it.
  it('still expands, so the learner can see its courses', () => {
    renderTable({ levelStatuses: ['locked'], isEnrolled: false });
    expect(screen.getByText('LP-Course-1')).toBeInTheDocument();
    expect(screen.queryByText(/learningPath.openLevelDetail/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ledger-level-row'));
    expect(screen.queryByText('LP-Course-1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ledger-level-row'));
    expect(screen.getByText('LP-Course-1')).toBeInTheDocument();
  });

  it('lists its courses as Locked and not openable, even for an enrolled learner (negative)', () => {
    const onOpenCourse = vi.fn();
    renderTable({ levelStatuses: ['locked'], isEnrolled: true, onOpenCourse });
    const course = screen.getByTestId('ledger-course-row');
    expect(within(course).getByText('learningPath.locked')).toBeInTheDocument();
    fireEvent.click(course);
    expect(onOpenCourse).not.toHaveBeenCalled();
  });

  it('opens courses of an unlocked level as before', () => {
    const onOpenCourse = vi.fn();
    renderTable({ levelStatuses: ['active'], onOpenCourse });
    fireEvent.click(screen.getByTestId('ledger-course-row'));
    expect(onOpenCourse).toHaveBeenCalledWith('course_1', 'leaf_1');
    expect(screen.getByText(/learningPath.openLevelDetail/)).toBeInTheDocument();
  });
});
