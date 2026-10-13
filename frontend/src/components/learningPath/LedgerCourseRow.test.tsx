import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LedgerCourseRow } from './LedgerCourseRow';
import type { LPCourseNode } from '../../types/learningPathTypes';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({ t: (key: string) => key }),
}));

function buildCourse(): LPCourseNode {
  return {
    identifier: 'course_1',
    name: 'LP-Course-1',
    leafNodesCount: 1,
    leafIds: ['leaf_1'],
    skills: [], skillCodes: [],
    isAssessmentCourse: false,
  };
}

// Regression: an unenrolled visitor saw a "Start" CTA (and could click straight
// into course content) from the ledger/rail's course row, despite never having
// joined the Learning Path - see plan Part B, `LedgerCourseRow`'s `isEnrolled`.
describe('LedgerCourseRow isEnrolled', () => {
  it('defaults to enrolled, so every existing caller renders exactly as before', () => {
    render(
      <LedgerCourseRow
        course={buildCourse()}
        progress={{ pct: 0, completed: 0, total: 1, status: 'notStarted' }}
        onOpen={vi.fn()}
      />
    );
    expect(screen.getByText('learningPath.start')).toBeInTheDocument();
    expect(screen.queryByText('learningPath.enrolToStart')).not.toBeInTheDocument();
  });

  it('shows "Enrol to start" instead of the Start/Resume/Revisit CTA when not enrolled', () => {
    render(
      <LedgerCourseRow
        course={buildCourse()}
        progress={{ pct: 0, completed: 0, total: 1, status: 'notStarted' }}
        onOpen={vi.fn()}
        isEnrolled={false}
      />
    );
    expect(screen.getByText('learningPath.enrolToStart')).toBeInTheDocument();
    expect(screen.queryByText('learningPath.start')).not.toBeInTheDocument();
  });

  it('is not clickable when not enrolled', () => {
    const onOpen = vi.fn();
    render(
      <LedgerCourseRow
        course={buildCourse()}
        progress={{ pct: 0, completed: 0, total: 1, status: 'notStarted' }}
        onOpen={onOpen}
        isEnrolled={false}
      />
    );
    fireEvent.click(screen.getByTestId('ledger-course-row'));
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByTestId('ledger-course-row')).not.toHaveAttribute('role');
  });

  it('is still clickable when enrolled', () => {
    const onOpen = vi.fn();
    render(
      <LedgerCourseRow
        course={buildCourse()}
        progress={{ pct: 0, completed: 0, total: 1, status: 'notStarted' }}
        onOpen={onOpen}
        isEnrolled
      />
    );
    fireEvent.click(screen.getByTestId('ledger-course-row'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  // An "Optional" badge alone gives no reason. Naming the skills the learner already holds turns
  // the label into an explanation of WHY the entry assessment waived it.
  it('explains a waived course by naming the skills already held', () => {
    const held = (c: string) => ({ code: c, state: 'held' as const });
    render(
      <LedgerCourseRow
        course={{ ...buildCourse(), skillCodes: ['hand-hygiene', 'ppe-use'] }}
        progress={{ pct: 0, completed: 0, total: 2, status: 'notStarted' }}
        onOpen={() => {}}
        isOptional
        stateOf={held}
        skillName={(c) => c.replace(/-/g, ' ')}
      />
    );
    expect(screen.getByTestId('course-skill-line')).toHaveTextContent('alreadyHold');
  });

  it('says what an unheld course grants', () => {
    render(
      <LedgerCourseRow
        course={{ ...buildCourse(), skillCodes: ['hand-hygiene'] }}
        progress={{ pct: 0, completed: 0, total: 2, status: 'notStarted' }}
        onOpen={() => {}}
        stateOf={() => undefined}
        skillName={(c) => c}
      />
    );
    expect(screen.getByTestId('course-skill-line')).toHaveTextContent('givesYou');
  });

  it('shows no skill line for an untagged course', () => {
    render(
      <LedgerCourseRow
        course={buildCourse()}
        progress={{ pct: 0, completed: 0, total: 2, status: 'notStarted' }}
        onOpen={() => {}}
      />
    );
    expect(screen.queryByTestId('course-skill-line')).not.toBeInTheDocument();
  });
});
