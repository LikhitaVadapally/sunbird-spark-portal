import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LevelSkillsCard } from './LevelSkillsCard';
import type { PathSkill } from '@/services/learningPath/pathSkillStatus';

vi.mock('@/hooks/useAppI18n', () => ({ useAppI18n: () => ({ t: (k: string) => k }) }));

const states: Record<string, PathSkill> = {
  'hand-hygiene': { code: 'hand-hygiene', state: 'held' },
  'sterile-field': { code: 'sterile-field', state: 'pending' },
};
const codes = Object.keys(states);
const name = (c: string) => c.replace(/-/g, ' ');

describe('LevelSkillsCard', () => {
  // The old card labelled every skill "In scope", which is true from publish day and tells a
  // learner nothing - mastered and never-opened read identically.
  it('reports each skill as gained or pending rather than a blanket label', () => {
    render(<LevelSkillsCard codes={codes} stateOf={(c) => states[c]} name={name} />);
    expect(screen.getByTestId('level-skill-hand-hygiene')).toHaveTextContent('skillHeld');
    expect(screen.getByTestId('level-skill-sterile-field')).toHaveTextContent('skillPending');
  });

  it('shows the skill name, not the raw code', () => {
    render(<LevelSkillsCard codes={codes} stateOf={(c) => states[c]} name={name} />);
    expect(screen.getByTestId('level-skill-hand-hygiene')).toHaveTextContent('hand hygiene');
  });

  // An unenrolled visitor has no state to show; nor does a finished course's skill the profile
  // has not recorded - neither gained nor pending, so nothing is claimed.
  it('falls back to "In scope" when there is no state available', () => {
    render(<LevelSkillsCard codes={['hand-hygiene']} stateOf={() => undefined} name={name} />);
    expect(screen.getByTestId('level-skill-hand-hygiene')).toHaveTextContent('inScope');
  });

  it('shows the empty state when the level scopes nothing', () => {
    render(<LevelSkillsCard codes={[]} name={name} />);
    expect(screen.getByText('learningPath.noSkillsYet')).toBeInTheDocument();
  });
});
