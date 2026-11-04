import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { CompetencyRoleTab } from './CompetencyRoleTab';
import { useCompetencyFrameworkOptions, type FrameworkOption } from '@/hooks/useCompetencyFrameworkAdmin';

vi.mock('@/hooks/useAppI18n', () => ({ useAppI18n: () => ({ t: (k: string) => k }) }));
vi.mock('@/hooks/useCompetencyFrameworkAdmin', () => ({ useCompetencyFrameworkOptions: vi.fn() }));
vi.mock('./competency-role/RoleDefinitions', () => ({
  RoleDefinitions: ({ frameworkId }: { frameworkId: string }) => <div data-testid="defs">{frameworkId}</div>,
}));
vi.mock('./competency-role/AssignRoleForm', () => ({
  AssignRoleForm: ({ frameworkId }: { frameworkId: string }) => <div data-testid="assign">{frameworkId}</div>,
}));
// Radix Select needs real pointer events; a native <select> keeps the same contract for tests.
vi.mock('@/components/common/Select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) => (
    <select data-testid="competency-role-framework" value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, disabled, children }: { value: string; disabled?: boolean; children: ReactNode }) => (
    <option value={value} disabled={disabled}>{children}</option>
  ),
}));

const setOptions = (options: FrameworkOption[]) => vi.mocked(useCompetencyFrameworkOptions).mockReturnValue(options);

// The page owns the chosen framework; this mirrors it.
function Harness({ initial = '' }: { initial?: string }) {
  const [id, setId] = useState(initial);
  return <CompetencyRoleTab channel="ch1" frameworkId={id} onFrameworkChange={setId} />;
}

beforeEach(() => vi.clearAllMocks());

describe('CompetencyRoleTab', () => {
  it('lists only the admin org frameworks', () => {
    setOptions([]);
    render(<Harness />);
    expect(useCompetencyFrameworkOptions).toHaveBeenCalledWith('ch1');
  });

  it('asks for a framework before showing roles', () => {
    setOptions([{ id: 'fw', status: 'Live' }, { id: 'fw2', status: 'Live' }]);
    render(<Harness />);
    expect(screen.getByTestId('competency-role-choose-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('defs')).not.toBeInTheDocument();
  });

  it('shows both sections for the picked framework', () => {
    setOptions([{ id: 'fw', status: 'Live' }, { id: 'fw2', status: 'Live' }]);
    render(<Harness />);
    fireEvent.change(screen.getByTestId('competency-role-framework'), { target: { value: 'fw2' } });
    expect(screen.getByText('userManagement.competencyRole.roles.heading')).toBeInTheDocument();
    expect(screen.getByTestId('defs')).toHaveTextContent('fw2');
    expect(screen.getByTestId('assign')).toHaveTextContent('fw2');
  });

  it('picks the only Live framework automatically', () => {
    setOptions([{ id: 'fw', status: 'Live' }, { id: 'draft', status: 'Draft' }]);
    render(<Harness />);
    expect(screen.getByTestId('defs')).toHaveTextContent('fw');
  });

  it('lists a Draft framework but does not let it be picked', () => {
    setOptions([{ id: 'fw', status: 'Live' }, { id: 'draft', status: 'Draft' }]);
    render(<Harness initial="fw" />);
    const draft = screen.getByRole('option', { name: /draft/ });
    expect(draft).toBeDisabled();
    expect(draft).toHaveTextContent('userManagement.competencyRole.publishFirst');
  });

  it('keeps the framework chosen on the page', () => {
    setOptions([{ id: 'fw', status: 'Live' }, { id: 'fw2', status: 'Live' }]);
    render(<Harness initial="fw2" />);
    expect(screen.getByTestId('defs')).toHaveTextContent('fw2');
  });
});
