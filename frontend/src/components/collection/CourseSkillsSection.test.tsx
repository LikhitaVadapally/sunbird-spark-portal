import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CourseSkillsSection } from './CourseSkillsSection';
import { useSkillLabels, useSkillProfile } from '@/hooks/useSkillProfile';

vi.mock('@/hooks/useAppI18n', () => ({ useAppI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@/hooks/useSkillProfile', () => ({ useSkillProfile: vi.fn(), useSkillLabels: vi.fn() }));

const NAMES: Record<string, string> = { 'hand-hygiene': 'Hand Hygiene', 'ppe-use': 'PPE Use', dv: 'Data Visualization' };
// USF tags carry the term name; the profile holds the code.
const CODE_BY_NAME: Record<string, string> = { 'data visualization': 'dv' };

function setProfile(heldCodes: string[]) {
  vi.mocked(useSkillProfile).mockReturnValue({
    skills: heldCodes.map((skillId) => ({ skillId, frameworkId: 'fw', sourceType: 'COURSE', evidence: [] })),
    frameworkIds: ['fw'],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useSkillProfile>);
}

function setLabels(isLoading = false) {
  vi.mocked(useSkillLabels).mockReturnValue({
    labelOf: (code: string) => ({ name: NAMES[code] ?? code, resolved: Boolean(NAMES[code]) }),
    codeOf: (tag: string) => CODE_BY_NAME[tag.toLowerCase()] ?? tag,
    isLoading,
  });
}

describe('CourseSkillsSection', () => {
  beforeEach(() => {
    setProfile([]);
    setLabels();
  });

  it("lists the course's skills by name under \"Skills you will learn\"", () => {
    render(<CourseSkillsSection codes={['hand-hygiene', 'ppe-use']} />);
    expect(screen.getByText('courseDetails.skills')).toBeInTheDocument();
    expect(screen.getByText('Hand Hygiene')).toBeInTheDocument();
    expect(screen.getByText('PPE Use')).toBeInTheDocument();
  });

  it('ticks a skill the learner already holds, from any source', () => {
    setProfile(['ppe-use']);
    render(<CourseSkillsSection codes={['hand-hygiene', 'ppe-use']} />);
    expect(screen.getByTestId('course-skill-held')).toHaveTextContent('PPE Use');
    expect(screen.getByTestId('course-skill')).toHaveTextContent('Hand Hygiene');
  });

  it('ticks a USF skill tagged by name once its code is held', () => {
    setProfile(['dv']);
    render(<CourseSkillsSection codes={['Data Visualization']} frameworkId="USF" />);
    expect(screen.getByTestId('course-skill-held')).toHaveTextContent('Data Visualization');
  });

  it('shows placeholders, not slugs, while names load', () => {
    setLabels(true);
    render(<CourseSkillsSection codes={['hand-hygiene']} />);
    expect(screen.getByTestId('course-skills-loading')).toBeInTheDocument();
    expect(screen.queryByText('hand-hygiene')).not.toBeInTheDocument();
  });
});
