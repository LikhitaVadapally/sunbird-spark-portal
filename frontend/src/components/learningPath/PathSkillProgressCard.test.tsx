import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PathSkillProgressCard } from './PathSkillProgressCard';
import type { PathSkillSummary } from '@/services/learningPath/pathSkillStatus';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({
    t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k),
  }),
}));

const summary: PathSkillSummary = {
  skills: [
    { code: 'ppe-use', state: 'pending' },
    { code: 'dosage-calculation', state: 'held' },
    { code: 'hand-hygiene', state: 'pending' },
  ],
  held: 1,
  total: 3,
};

const name = (c: string) => c.replace(/-/g, ' ');
const renderCard = () =>
  render(
    <MemoryRouter>
      <PathSkillProgressCard summary={summary} name={name} />
    </MemoryRouter>
  );

describe('PathSkillProgressCard', () => {
  it('shows gained of total, the same numbers My Skills counts', () => {
    renderCard();
    expect(screen.getByTestId('path-skill-count')).toHaveTextContent('"held":1');
    expect(screen.getByTestId('path-skill-count')).toHaveTextContent('"total":3');
  });

  // Roles are hidden from learners until they are mapped: no readiness percentage, no role name.
  it('shows no role readiness when no role is given', () => {
    renderCard();
    expect(screen.queryByText(/progressTowardRole/)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByText('learningPath.skillsFromThisPath')).toBeInTheDocument();
  });

  it('orders held first, then pending alphabetically', () => {
    renderCard();
    const ids = screen.getAllByRole('listitem').map((e) => e.getAttribute('data-testid'));
    expect(ids).toEqual(['path-skill-dosage-calculation', 'path-skill-hand-hygiene', 'path-skill-ppe-use']);
  });

  it('links to My Skills, not the removed Competency Profile', () => {
    renderCard();
    expect(screen.getByText('learningPath.viewMySkills').closest('a')).toHaveAttribute('href', '/profile/skills');
  });

  it('shows role readiness and untaught skills once a role is mapped', () => {
    render(
      <MemoryRouter>
        <PathSkillProgressCard
          summary={summary}
          name={name}
          role={{ name: 'ICU Nurse', held: 1, required: 4, readiness: 25, notTaught: ['ventilator-care'] }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/learningPath.progressTowardRole/)).toHaveTextContent('ICU Nurse');
    expect(screen.getByTestId('path-skill-readiness')).toHaveTextContent('25%');
    expect(screen.getByTestId('path-skill-ventilator-care')).toHaveTextContent('learningPath.notOnThisPath');
  });
});
