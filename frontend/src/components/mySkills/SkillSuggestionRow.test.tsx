import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SkillSuggestionRow } from './SkillSuggestionRow';
import type { SkillSuggestion } from '@/hooks/useSkillSuggestions';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

function suggestion(overrides: Partial<SkillSuggestion> & { pathId: string }): SkillSuggestion {
  return {
    pathName: 'Data Foundations',
    source: 'enrolled',
    progressPct: 40,
    newSkills: ['SQL', 'Python'],
    totalSkills: 2,
    ...overrides,
  };
}

function renderRow(suggestions: SkillSuggestion[]) {
  return render(
    <MemoryRouter>
      <SkillSuggestionRow suggestions={suggestions} nameOf={(code) => code} />
    </MemoryRouter>
  );
}

describe('SkillSuggestionRow', () => {
  it('renders nothing when there are no suggestions', () => {
    const { container } = renderRow([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a card per suggestion with its new skills', () => {
    renderRow([
      suggestion({ pathId: 'p1', pathName: 'Data Foundations', newSkills: ['SQL', 'Python'] }),
      suggestion({ pathId: 'p2', pathName: 'Cloud Basics', source: 'discover', newSkills: ['Cloud'] }),
    ]);

    expect(screen.getByText('Data Foundations')).toBeInTheDocument();
    expect(screen.getByText('Cloud Basics')).toBeInTheDocument();
    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(screen.getByTestId('skill-suggestion-card-enrolled')).toBeInTheDocument();
    expect(screen.getByTestId('skill-suggestion-card-discover')).toBeInTheDocument();
  });

  it('shows resolved skill names rather than codes', () => {
    render(
      <MemoryRouter>
        <SkillSuggestionRow
          suggestions={[suggestion({ pathId: 'p1', newSkills: ['hand-hygiene'] })]}
          nameOf={(code) => (code === 'hand-hygiene' ? 'Hand Hygiene' : code)}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Hand Hygiene')).toBeInTheDocument();
    expect(screen.queryByText('hand-hygiene')).not.toBeInTheDocument();
  });

  it('collapses extra skills into a "+N more" label beyond the preview count', () => {
    renderRow([suggestion({ pathId: 'p1', newSkills: ['SQL', 'Python', 'ML', 'Cloud', 'Docker'] })]);
    expect(screen.getByText(/mySkills.moreSkills/)).toHaveTextContent('mySkills.moreSkills {"count":2}');
  });

  it('links an enrolled suggestion to its batch context via the Ledger route', () => {
    renderRow([suggestion({ pathId: 'p1', contextId: 'ctx-1' })]);
    expect(screen.getByTestId('skill-suggestion-card-enrolled')).toHaveAttribute(
      'href',
      '/learning-path/p1/batch/ctx-1'
    );
  });

  it('links a discover suggestion without a batch context', () => {
    renderRow([suggestion({ pathId: 'p1', source: 'discover', contextId: undefined })]);
    expect(screen.getByTestId('skill-suggestion-card-discover')).toHaveAttribute('href', '/learning-path/p1');
  });
});
