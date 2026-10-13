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

  it('expands to "how I earned this" with the evidence source, id and score', () => {
    render(
      <MemoryRouter>
        <SkillCard entry={gainedEntry()} label={LABEL} isExpanded onToggle={vi.fn()} />
      </MemoryRouter>
    );

    const evidence = screen.getByTestId('skill-evidence');
    expect(evidence).toHaveTextContent('mySkills.howEarned');
    expect(evidence).toHaveTextContent('nrp-cert-42');
    expect(evidence).toHaveTextContent('18/20');
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
