import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SkillCard } from './SkillCard';
import type { MySkillEntry } from '@/services/skill/mySkills';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

const LABEL = { name: 'Hand Hygiene', group: 'Infection Prevention', resolved: true };

function gainedEntry(overrides: Partial<MySkillEntry> = {}): MySkillEntry {
  return {
    code: 'hand-hygiene',
    gained: true,
    source: 'external',
    gainedAt: Date.UTC(2026, 8, 2),
    evidence: [
      {
        evidenceId: 'ev-1',
        sourceType: 'EXTERNAL',
        sourceId: 'nrp-cert-42',
        score: 18,
        maxScore: 20,
        occurredOn: Date.UTC(2026, 8, 2),
        revoked: false,
      },
    ],
    paths: [],
    ...overrides,
  };
}

function pendingEntry(): MySkillEntry {
  return {
    code: 'sterile-field',
    gained: false,
    evidence: [],
    paths: [{ pathId: 'path-1', contextId: 'ctx-1', pathName: 'ICU Nurse Induction' }],
  };
}

describe('SkillCard', () => {
  it('shows the name, the group label, and gained with its source', () => {
    render(
      <MemoryRouter>
        <SkillCard entry={gainedEntry()} label={LABEL} isExpanded={false} onToggle={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText('Hand Hygiene')).toBeInTheDocument();
    expect(screen.getByText('Infection Prevention')).toBeInTheDocument();
    expect(screen.getByTestId('skill-card-gained')).toHaveTextContent('mySkills.source.external');
    expect(screen.queryByTestId('skill-evidence')).not.toBeInTheDocument();
  });

  it('expands to "how I earned this" with the certificate id, and no score', () => {
    render(
      <MemoryRouter>
        <SkillCard entry={gainedEntry()} label={LABEL} isExpanded onToggle={vi.fn()} />
      </MemoryRouter>
    );

    const evidence = screen.getByTestId('skill-evidence');
    expect(evidence).toHaveTextContent('mySkills.howEarned');
    expect(evidence).toHaveTextContent('nrp-cert-42');
    expect(evidence).not.toHaveTextContent('18/20');
  });

  it('shows the path an assessment was earned in, not its id, and no "also taught in" for it', () => {
    const icu = { pathId: 'do_icu', contextId: 'ctx-1', pathName: 'ICU Nurse Induction V3' };
    const entry = gainedEntry({
      source: 'assessment',
      evidence: [
        { evidenceId: 'e1', sourceType: 'ASSESSMENT', sourceId: 'do_2146607650702295041296', sourcePath: icu, revoked: false },
      ],
    });
    render(
      <MemoryRouter>
        <SkillCard entry={entry} label={LABEL} isExpanded onToggle={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('skill-evidence')).not.toHaveTextContent('do_2146607650702295041296');
    expect(screen.getByTestId('skill-evidence-path')).toHaveTextContent('mySkills.earnedIn');
    expect(screen.getByText('ICU Nurse Induction V3').closest('a')).toHaveAttribute(
      'href',
      '/learning-path/do_icu/batch/ctx-1/status'
    );
    expect(screen.queryByText('mySkills.alsoTaughtIn')).not.toBeInTheDocument();
  });

  it('names an assessment when its name is known', () => {
    const entry = gainedEntry({
      evidence: [
        { evidenceId: 'e1', sourceType: 'ASSESSMENT', sourceId: 'do_a', sourceName: 'ICU Final Assessment', revoked: false },
      ],
    });
    render(
      <MemoryRouter>
        <SkillCard entry={entry} label={LABEL} isExpanded onToggle={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByTestId('skill-evidence')).toHaveTextContent('ICU Final Assessment');
  });

  // The header already says "Assessment · Oct 06": the row says only what it does not.
  it('does not repeat the source or date the header already shows', () => {
    const on = Date.UTC(2026, 9, 6);
    const entry = gainedEntry({
      source: 'assessment',
      gainedAt: on,
      evidence: [
        { evidenceId: 'e1', sourceType: 'ASSESSMENT', sourceId: 'do_a', sourceName: 'ICU Entry Assessment V3', occurredOn: on, revoked: false },
      ],
    });
    render(
      <MemoryRouter>
        <SkillCard entry={entry} label={LABEL} isExpanded onToggle={vi.fn()} />
      </MemoryRouter>
    );
    const evidence = screen.getByTestId('skill-evidence');
    expect(evidence).toHaveTextContent('ICU Entry Assessment V3');
    expect(evidence).not.toHaveTextContent('mySkills.source.assessment');
    expect(screen.getAllByText(new Date(on).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }))).toHaveLength(1);
  });

  it('keeps the source and date on a row that differs from the header', () => {
    const entry = gainedEntry({
      source: 'course',
      gainedAt: Date.UTC(2026, 9, 6),
      evidence: [
        { evidenceId: 'e1', sourceType: 'ASSESSMENT', sourceId: 'do_a', sourceName: 'Final', occurredOn: Date.UTC(2026, 9, 13), revoked: false },
      ],
    });
    render(
      <MemoryRouter>
        <SkillCard entry={entry} label={LABEL} isExpanded onToggle={vi.fn()} />
      </MemoryRouter>
    );
    const evidence = screen.getByTestId('skill-evidence');
    expect(evidence).toHaveTextContent('mySkills.source.assessment');
    expect(evidence).toHaveTextContent(new Date(Date.UTC(2026, 9, 13)).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }));
  });

  it('hides an unnamed content id', () => {
    const entry = gainedEntry({
      evidence: [{ evidenceId: 'e1', sourceType: 'COURSE', sourceId: 'do_unknown', revoked: false }],
    });
    render(
      <MemoryRouter>
        <SkillCard entry={entry} label={LABEL} isExpanded onToggle={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByTestId('skill-evidence')).not.toHaveTextContent('do_unknown');
  });

  it('says so when a gained skill has no evidence on record', () => {
    render(
      <MemoryRouter>
        <SkillCard entry={gainedEntry({ evidence: [] })} label={LABEL} isExpanded onToggle={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('mySkills.noEvidence')).toBeInTheDocument();
  });

  it('shows a pending skill with the paths still teaching it', () => {
    render(
      <MemoryRouter>
        <SkillCard entry={pendingEntry()} label={{ name: 'Sterile Field', resolved: true }} isExpanded onToggle={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('skill-card-pending')).toHaveTextContent('mySkills.pending');
    expect(screen.getByText('mySkills.stillToDoIn')).toBeInTheDocument();
    expect(screen.getByText('ICU Nurse Induction').closest('a')).toHaveAttribute(
      'href',
      '/learning-path/path-1/batch/ctx-1/status'
    );
  });

  // Regression: the path link didn't set `state.from`, so useLearningPathBackNavigation's Go Back
  // fell through to its /explore default instead of returning to My Skills.
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
            element={<SkillCard entry={pendingEntry()} label={LABEL} isExpanded onToggle={vi.fn()} />}
          />
          <Route path="/learning-path/:pathId/batch/:contextId/status" element={<LocationState />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('ICU Nurse Induction'));
    expect(screen.getByTestId('location-state')).toHaveTextContent('{"from":"/my-skills"}');
  });
});
