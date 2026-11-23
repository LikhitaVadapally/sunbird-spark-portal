import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RoleReadinessSection } from './RoleReadinessSection';
import type { CompetencyFrameworkMeta, Recommendation, RoleGap, SkillGap } from '@/types/skillServiceTypes';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ toast: mockToast }) }));

const meta: CompetencyFrameworkMeta = {
  frameworkId: 'fw',
  tierLabels: [],
  depth: 3,
  leafSkills: ['a', 'b', 'c'],
  roles: { 'icu-nurse': ['a', 'b'], officer: ['a', 'c'], supervisor: ['b'] },
  roleNames: { 'icu-nurse': 'ICU Nurse', officer: 'Nursing Officer', supervisor: 'Supervisor', 'old-role': 'Old Role' },
  roleCodes: ['icu-nurse', 'officer', 'supervisor'],
};
let roleNames: Record<string, string> = {};
vi.mock('@/hooks/useSkillProfile', () => ({
  useSkillProfile: () => ({ skills: [] }),
  useSkillFrameworks: (ids: string[]) => ({ metas: ids.includes('fw') ? { fw: meta } : {} }),
  // Names from the role's own framework; unresolved unless a test provides them.
  useSkillLabels: () => ({
    labelOf: (code: string) => (roleNames[code] ? { name: roleNames[code], resolved: true } : { name: code, resolved: false }),
    isLoading: false,
  }),
}));

const roleGap = (role: string, over: Partial<RoleGap> = {}): RoleGap => ({
  role,
  measurable: true,
  readiness: 50,
  required: 2,
  met: 1,
  outstanding: ['b'],
  held: ['a'],
  ...over,
});

let gapState: { gap?: SkillGap; isLoading: boolean; isError: boolean };
let recommendation: Recommendation | undefined;
const mutate = vi.fn();
const refetch = vi.fn();
const recommendFor = vi.fn();
vi.mock('@/hooks/useRoleReadiness', () => ({
  useSkillGap: () => ({ ...gapState, refetch }),
  useSkillRecommend: (_fw: string | undefined, role: string | undefined) => {
    recommendFor(role);
    return { recommendation };
  },
  useUpdateTargetRoles: () => ({ mutate, isPending: false }),
}));

const labelOf = (code: string) => ({ name: `Skill ${code}`, resolved: true });
const renderSection = () =>
  render(
    <MemoryRouter>
      <RoleReadinessSection labelOf={labelOf} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  gapState = {
    gap: { frameworkId: 'fw', current: roleGap('icu-nurse'), targets: [roleGap('officer', { outstanding: ['c'] })], resolved: true },
    isLoading: false,
    isError: false,
  };
  recommendation = undefined;
  roleNames = {};
});

describe('RoleReadinessSection', () => {
  it('shows readiness for the assigned role and each target, with held and missing skills named', () => {
    renderSection();
    const assigned = screen.getByTestId('role-card-icu-nurse');
    expect(within(assigned).getByText('ICU Nurse')).toBeInTheDocument();
    expect(within(assigned).getByText('50%')).toBeInTheDocument();
    expect(within(assigned).getByText('Skill b')).toBeInTheDocument();
    expect(within(screen.getByTestId('role-card-icu-nurse-held')).getByText('Skill a')).toBeInTheDocument();
    expect(within(screen.getByTestId('role-card-officer')).getByText('Skill c')).toBeInTheDocument();
    // The assigned role is an admin's: it has no remove control.
    expect(screen.queryByTestId('remove-role-icu-nurse')).not.toBeInTheDocument();
  });

  it('adds a target from the live roles not already held', () => {
    renderSection();
    const select = screen.getByTestId('add-target-role');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'skillProfile.addTarget',
      'Supervisor',
    ]);
    fireEvent.change(select, { target: { value: 'supervisor' } });
    expect(mutate).toHaveBeenCalledWith({ add: 'supervisor' }, expect.any(Object));
  });

  it('removes a target and toasts when the save fails', () => {
    mutate.mockImplementation((_c: unknown, opts: { onError: () => void }) => opts.onError());
    renderSection();
    fireEvent.click(screen.getByTestId('remove-role-officer'));
    expect(mutate).toHaveBeenCalledWith({ remove: 'officer' }, expect.any(Object));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'skillProfile.saveError' }));
  });

  it('says no role is assigned instead of showing 0%, and prompts for a target', () => {
    gapState.gap = { frameworkId: 'fw', targets: [], resolved: true };
    renderSection();
    expect(screen.getByTestId('role-card-unassigned')).toHaveTextContent('skillProfile.currentRoleUnset');
    expect(screen.getByTestId('role-readiness-no-targets')).toBeInTheDocument();
  });

  it('badges a retired role and shows no score for a role it cannot measure', () => {
    gapState.gap = {
      frameworkId: 'fw',
      current: roleGap('old-role'),
      targets: [roleGap('officer', { measurable: false, readiness: 0, required: 0, met: 0, outstanding: [] })],
      resolved: true,
    };
    renderSection();
    expect(within(screen.getByTestId('role-card-old-role')).getByText('skillProfile.retired')).toBeInTheDocument();
    const officer = screen.getByTestId('role-card-officer');
    expect(within(officer).getByTestId('role-card-officer-unmeasurable')).toBeInTheDocument();
    expect(within(officer).queryByText('0%')).not.toBeInTheDocument();
  });

  it('lists next steps for the first role with gaps and switches role on demand', () => {
    recommendation = {
      role: 'icu-nurse',
      frameworkId: 'fw',
      outstanding: ['b'],
      candidates: [
        { identifier: 'c1', name: 'Airway Basics', primaryCategory: 'Course', skills: ['b'], gapCovered: 1, alreadyHeld: 0, totalSkills: 1 },
      ],
    };
    renderSection();
    expect(screen.getByTestId('next-step-c1')).toHaveAttribute('href', '/collection/c1');
    expect(recommendFor).toHaveBeenLastCalledWith('icu-nurse');
    fireEvent.click(screen.getByTestId('role-option-officer'));
    expect(recommendFor).toHaveBeenLastCalledWith('officer');
  });

  it('renders nothing while loading, or when there are no roles at all', () => {
    gapState = { isLoading: true, isError: false };
    const { container, unmount } = renderSection();
    expect(container).toBeEmptyDOMElement();
    unmount();
    gapState = { gap: { frameworkId: '', targets: [], resolved: false }, isLoading: false, isError: false };
    expect(renderSection().container).toBeEmptyDOMElement();
  });

  it('keeps role cards in one scrolling row, with View all once they overflow it', () => {
    renderSection();
    expect(screen.queryByTestId('role-cards-toggle')).not.toBeInTheDocument();
    gapState.gap = {
      frameworkId: 'fw',
      current: roleGap('icu-nurse'),
      targets: [roleGap('officer'), roleGap('supervisor'), roleGap('old-role')],
      resolved: true,
    };
    renderSection();
    const rows = screen.getAllByTestId('role-cards');
    const row = rows[rows.length - 1]!;
    expect(row.className).toContain('overflow-x-auto');
    fireEvent.click(screen.getByTestId('role-cards-toggle'));
    expect(row.className).toContain('grid');
    expect(screen.getByTestId('role-cards-toggle')).toHaveTextContent('viewLess');
  });

  it('offers a retry when readiness cannot be read', () => {
    gapState = { isLoading: false, isError: true };
    renderSection();
    fireEvent.click(within(screen.getByTestId('role-readiness-error')).getByText('retry'));
    expect(refetch).toHaveBeenCalled();
  });

  // The page's names skip a framework the learner has no skills or paths in yet.
  it('names the role\'s skills from the role\'s own framework when the page cannot', () => {
    roleNames = { b: 'Use Flexbox' };
    renderSection();
    expect(screen.getAllByText('Use Flexbox').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Skill a').length).toBeGreaterThan(0);
  });
});

