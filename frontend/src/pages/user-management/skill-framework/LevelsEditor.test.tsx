import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { LevelsEditor } from './LevelsEditor';
import { MAX_LEVELS } from './frameworkLevels';
import type { FrameworkLevel } from '@/services/CompetencyFrameworkService';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({ t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k) }),
}));

const defaults: FrameworkLevel[] = [
  { code: 'competencyarea', name: 'Competency Area' },
  { code: 'competency', name: 'Competency' },
  { code: 'skill', name: 'Skill' },
];

let latest: FrameworkLevel[] = [];
function Harness({ initial }: { initial: FrameworkLevel[] }) {
  const [levels, setLevels] = useState(initial);
  latest = levels;
  return <LevelsEditor levels={levels} onChange={setLevels} />;
}

const nameInput = (i: number) => screen.getByTestId(`skill-framework-level-name-${i}`);
const codeInput = (i: number) => screen.getByTestId(`skill-framework-level-code-${i}`);

describe('LevelsEditor', () => {
  it('labels the last level as the skills level', () => {
    render(<Harness initial={defaults} />);
    expect(screen.getByTestId('skill-framework-level-2')).toHaveTextContent('userManagement.skillFramework.levels.skillsLevel');
    expect(screen.getByTestId('skill-framework-level-0')).toHaveTextContent('userManagement.skillFramework.levels.level {"n":1}');
  });

  it('derives the code from the name until the code is edited by hand', () => {
    render(<Harness initial={defaults} />);
    fireEvent.change(nameInput(2), { target: { value: 'Cuisine' } });
    expect(latest[2]).toEqual({ code: 'cuisine', name: 'Cuisine' });
    fireEvent.change(codeInput(2), { target: { value: 'dish' } });
    fireEvent.change(nameInput(2), { target: { value: 'Cuisines' } });
    expect(latest[2]).toEqual({ code: 'dish', name: 'Cuisines' });
  });

  it('adds and removes levels, up to the maximum and down to one', () => {
    render(<Harness initial={[defaults[2]!]} />);
    expect(screen.queryByTestId('skill-framework-level-remove-0')).not.toBeInTheDocument();
    for (let i = 1; i < MAX_LEVELS; i++) fireEvent.click(screen.getByTestId('skill-framework-level-add'));
    expect(latest).toHaveLength(MAX_LEVELS);
    expect(screen.queryByTestId('skill-framework-level-add')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('skill-framework-level-remove-0'));
    expect(latest).toHaveLength(MAX_LEVELS - 1);
  });

  it('shows why a level is not accepted', () => {
    render(<Harness initial={[{ code: 'subject', name: 'Subject' }]} />);
    expect(screen.getByTestId('skill-framework-level-error-0')).toHaveTextContent('userManagement.skillFramework.levels.errors.reserved');
  });
});
