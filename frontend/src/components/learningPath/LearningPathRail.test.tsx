import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LearningPathRail } from './LearningPathRail';
import type { LearningPathModel, LevelProgressInfo, LevelStatusKey } from '../../types/learningPathTypes';
import type { ViewerSummaryRecord } from '../../types/viewerServiceTypes';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}));

function buildModel(): LearningPathModel {
  return {
    identifier: 'lp_1',
    name: 'Data Foundations',
    policy: 'Fixed',
    levels: [
      {
        identifier: 'level_1',
        name: 'Level-1',
        index: 0,
        skills: [], skillCodes: [],
        courses: [
          {
            identifier: 'course_1',
            name: 'LP-Course-1-JP-PP',
            leafNodesCount: 2,
            leafIds: ['leaf_1', 'leaf_2'],
            units: [
              {
                identifier: 'unit_1',
                name: 'Unit-1',
                isUnit: true,
                leafIds: ['leaf_1'],
                children: [
                  { identifier: 'leaf_1', name: 'LP-Content-1', isUnit: false, leafIds: ['leaf_1'], children: [] },
                ],
              },
              {
                identifier: 'unit_2',
                name: 'Unit-2',
                isUnit: true,
                leafIds: ['leaf_2'],
                children: [
                  { identifier: 'leaf_2', name: 'LP-Content-2', isUnit: false, leafIds: ['leaf_2'], children: [] },
                ],
              },
            ],
            skills: [], skillCodes: [],
            isAssessmentCourse: false,
          },
        ],
      },
      {
        identifier: 'level_2',
        name: 'Level-2',
        index: 1,
        skills: [], skillCodes: [],
        courses: [
          {
            identifier: 'course_2',
            name: 'LP-Course-2',
            leafNodesCount: 1,
            leafIds: ['leaf_3'],
            skills: [], skillCodes: [],
            isAssessmentCourse: false,
          },
        ],
      },
    ],
    allSkills: [], allSkillCodes: [],
    courseTotal: 2,
    leafTotal: 3,
  };
}

const levelProgress: LevelProgressInfo[] = [
  { pct: 100, completed: 1, total: 1, doneCourses: 1 },
  { pct: 0, completed: 0, total: 1, doneCourses: 0 },
];
const levelStatuses: LevelStatusKey[] = ['completed', 'locked'];

function renderRail(overrides: Partial<Parameters<typeof LearningPathRail>[0]> = {}) {
  const onOpenCourse = vi.fn();
  const props = {
    pathTitle: 'Data Foundations',
    model: buildModel(),
    progress: { pct: 50, completed: 1, total: 3, doneLevels: 1, levelCount: 2 },
    levelProgress,
    levelStatuses,
    priorDone: true,
    outcomeUnlocked: false,
    summaryByCollectionId: new Map<string, ViewerSummaryRecord>(),
    pathSummary: undefined,
    onBackToPath: vi.fn(),
    onOpenLevel: vi.fn(),
    onOpenPrior: vi.fn(),
    onOpenCourse,
    ...overrides,
  };
  render(<LearningPathRail {...props} />);
  return { onOpenCourse };
}

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

describe('LearningPathRail prior row', () => {
  // Regression: an unenrolled visitor saw "In progress" on the prior
  // assessment row here too (same binary check as the Ledger's prior row).
  it('shows Locked, not "In progress", when the learner is not enrolled', () => {
    renderRail({ model: buildModelWithPrior(), priorDone: false, isEnrolled: false });
    expect(screen.getByText('learningPath.statusLocked')).toBeInTheDocument();
    expect(screen.queryByText('learningPath.statusInProgress')).not.toBeInTheDocument();
  });

  it('is not clickable when not enrolled', () => {
    const onOpenPrior = vi.fn();
    renderRail({ model: buildModelWithPrior(), priorDone: false, isEnrolled: false, onOpenPrior });
    fireEvent.click(screen.getByText('LP-PriorAssess-Course'));
    expect(onOpenPrior).not.toHaveBeenCalled();
  });

  it('opens the prior assessment when clicked while enrolled', () => {
    const onOpenPrior = vi.fn();
    renderRail({ model: buildModelWithPrior(), priorDone: false, isEnrolled: true, onOpenPrior });
    fireEvent.click(screen.getByText('LP-PriorAssess-Course'));
    expect(onOpenPrior).toHaveBeenCalledTimes(1);
  });
});

describe('LearningPathRail', () => {
  it('shows the child courses of an unlocked Level', () => {
    renderRail();
    expect(screen.getByText('LP-Course-1-JP-PP')).toBeInTheDocument();
  });

  it('does not show child courses of a locked Level', () => {
    renderRail();
    expect(screen.queryByText('LP-Course-2')).not.toBeInTheDocument();
  });

  // Regression: a Level's own course row must open that course, not the Level itself -
  // clicking it should not also trigger the parent Level row's onOpenLevel handler.
  it('opens the course at its first leaf id when a child course row is clicked, without opening the Level', () => {
    const onOpenLevel = vi.fn();
    const { onOpenCourse } = renderRail({ onOpenLevel });
    fireEvent.click(screen.getByText('LP-Course-1-JP-PP'));
    expect(onOpenCourse).toHaveBeenCalledWith('course_1', 'leaf_1');
    expect(onOpenLevel).not.toHaveBeenCalled();
  });

  describe('course units', () => {
    it('keeps a course collapsed until its chevron is clicked, then lists its units and leaves', () => {
      renderRail();
      expect(screen.queryByText('Unit-1')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('ledger-course-row-toggle'));

      expect(screen.getByText('Unit-1')).toBeInTheDocument();
      expect(screen.getByText('Unit-2')).toBeInTheDocument();
      expect(screen.getByText('LP-Content-1')).toBeInTheDocument();
    });

    // Regression: the chevron must not fall through to the row's own navigate handler.
    it('does not open the course when the expand chevron is clicked', () => {
      const { onOpenCourse } = renderRail();
      fireEvent.click(screen.getByTestId('ledger-course-row-toggle'));
      expect(onOpenCourse).not.toHaveBeenCalled();
    });

    it('collapses again on a second chevron click', () => {
      renderRail();
      fireEvent.click(screen.getByTestId('ledger-course-row-toggle'));
      fireEvent.click(screen.getByTestId('ledger-course-row-toggle'));
      expect(screen.queryByText('Unit-1')).not.toBeInTheDocument();
    });

    it('opens the course at the clicked leaf when a unit leaf is clicked', () => {
      const { onOpenCourse } = renderRail();
      fireEvent.click(screen.getByTestId('ledger-course-row-toggle'));
      fireEvent.click(screen.getByText('LP-Content-2'));
      expect(onOpenCourse).toHaveBeenCalledWith('course_1', 'leaf_2');
    });

    it('shows the course being consumed already expanded', () => {
      renderRail({ activeCourseId: 'course_1' });
      expect(screen.getByText('Unit-1')).toBeInTheDocument();
    });

    it('lets the learner collapse the active course', () => {
      renderRail({ activeCourseId: 'course_1' });
      fireEvent.click(screen.getByTestId('ledger-course-row-toggle'));
      expect(screen.queryByText('Unit-1')).not.toBeInTheDocument();
    });

    it('renders no chevron for a course that has no units', () => {
      const model = buildModel();
      model.levels[0]!.courses[0]!.units = [];
      renderRail({ model });
      expect(screen.queryByTestId('ledger-course-row-toggle')).not.toBeInTheDocument();
    });
  });

  // Mirrors the course player's ContentRow, which shows the attempt count next to
  // the title and "Best Score: x/y" once an assessment is complete.
  describe('assessment score and attempts', () => {
    /** Turns leaf_2 into a self-assess questionset with an attempt limit. */
    function assessmentModel() {
      const model = buildModel();
      const leaf = model.levels[0]!.courses[0]!.units![1]!.children[0]!;
      leaf.mimeType = 'application/vnd.sunbird.questionset';
      leaf.maxAttempts = 3;
      return model;
    }

    function summaryWith(
      assessmentStatus?: ViewerSummaryRecord['assessmentStatus'],
      contentStatus: Record<string, number> = { leaf_2: 2 }
    ): ViewerSummaryRecord {
      return {
        userId: 'u1',
        collectionId: 'lp_1',
        active: true,
        status: 1,
        progress: 0,
        contentStatus,
        ...(assessmentStatus ? { assessmentStatus } : {}),
      };
    }

    it('shows the best score on a completed assessment leaf', () => {
      renderRail({
        model: assessmentModel(),
        pathSummary: summaryWith({ leaf_2: { score: 8, max_score: 10, attempts: 1 } }),
      });
      fireEvent.click(screen.getByTestId('ledger-course-row-toggle'));
      expect(screen.getByTestId('course-unit-leaf-score')).toHaveTextContent(
        'courseDetails.scoreLabel:{"score":8,"max":10}'
      );
    });

    it('shows the attempt count against the attempt limit', () => {
      renderRail({
        model: assessmentModel(),
        pathSummary: summaryWith({ leaf_2: { score: 8, max_score: 10, attempts: 2 } }),
      });
      fireEvent.click(screen.getByTestId('ledger-course-row-toggle'));
      expect(screen.getByTestId('course-unit-leaf-attempts')).toHaveTextContent('2/3');
    });

    it('omits attempts when the entry carries no attempt count', () => {
      renderRail({
        model: assessmentModel(),
        pathSummary: summaryWith({ leaf_2: { score: 8, max_score: 10 } }),
      });
      fireEvent.click(screen.getByTestId('ledger-course-row-toggle'));
      expect(screen.queryByTestId('course-unit-leaf-attempts')).not.toBeInTheDocument();
    });

    it('shows no score when the assessment has no entry yet', () => {
      renderRail({ model: assessmentModel(), pathSummary: summaryWith() });
      fireEvent.click(screen.getByTestId('ledger-course-row-toggle'));
      expect(screen.queryByTestId('course-unit-leaf-score')).not.toBeInTheDocument();
    });

    // A score before completion would contradict the tick, so it is gated on status 2.
    it('shows no score while the assessment is incomplete', () => {
      renderRail({
        model: assessmentModel(),
        pathSummary: summaryWith({ leaf_2: { score: 8, max_score: 10 } }, { leaf_2: 1 }),
      });
      fireEvent.click(screen.getByTestId('ledger-course-row-toggle'));
      expect(screen.queryByTestId('course-unit-leaf-score')).not.toBeInTheDocument();
    });

    it('shows no score for a non-assessment leaf even if an entry exists', () => {
      renderRail({
        model: buildModel(),
        pathSummary: summaryWith({ leaf_2: { score: 8, max_score: 10, attempts: 1 } }),
      });
      fireEvent.click(screen.getByTestId('ledger-course-row-toggle'));
      expect(screen.queryByTestId('course-unit-leaf-score')).not.toBeInTheDocument();
    });
  });
});

describe('LearningPathRail course skills', () => {
  const modelWithSkills = (): LearningPathModel => {
    const model = buildModel();
    const course = model.levels[0]!.courses[0]!;
    model.levels[0]!.courses[0] = { ...course, skillCodes: ['fe_sk_es6', 'fe_sk_dom'] };
    return model;
  };

  // Regression: the player's rail passed no skillName, so the row read "Gives you: fe_sk_es6, fe_sk_dom".
  it("names a course's skills with the framework names it is given", () => {
    const names: Record<string, string> = { fe_sk_es6: 'Use ES6 Syntax', fe_sk_dom: 'Manipulate the DOM' };
    renderRail({ model: modelWithSkills(), skillName: (c) => names[c] ?? c });
    expect(screen.getByText(/Use ES6 Syntax, Manipulate the DOM/)).toBeInTheDocument();
    expect(screen.queryByText(/fe_sk_es6/)).not.toBeInTheDocument();
  });

  it('says the learner already holds them when every skill is held', () => {
    renderRail({
      model: modelWithSkills(),
      skillName: (c) => c.toUpperCase(),
      stateOf: (code) => ({ code, state: 'held' }) as never,
    });
    expect(screen.getByText(/learningPath\.alreadyHold/)).toBeInTheDocument();
  });
});
