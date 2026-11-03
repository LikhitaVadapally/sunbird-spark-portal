import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompetencyRoleTab } from './CompetencyRoleTab';

vi.mock('@/hooks/useAppI18n', () => ({ useAppI18n: () => ({ t: (k: string) => k }) }));
vi.mock('./competency-role/RoleDefinitions', () => ({
  RoleDefinitions: ({ frameworkId }: { frameworkId: string }) => <div data-testid="defs">{frameworkId}</div>,
}));
vi.mock('./competency-role/AssignRoleForm', () => ({
  AssignRoleForm: ({ frameworkId }: { frameworkId: string }) => <div data-testid="assign">{frameworkId}</div>,
}));

describe('CompetencyRoleTab', () => {
  it('shows the roles section and the assign section for the framework', () => {
    render(<CompetencyRoleTab frameworkIds={['fw']} />);
    expect(screen.getByText('userManagement.competencyRole.roles.heading')).toBeInTheDocument();
    expect(screen.getByText('userManagement.competencyRole.assignHeading')).toBeInTheDocument();
    expect(screen.getByTestId('defs')).toHaveTextContent('fw');
    expect(screen.getByTestId('assign')).toHaveTextContent('fw');
  });

  // One framework is the normal case; the picker would be a pointless choice of one.
  it('hides the framework picker when there is only one', () => {
    render(<CompetencyRoleTab frameworkIds={['fw']} />);
    expect(screen.queryByTestId('competency-role-framework')).not.toBeInTheDocument();
  });

  it('switches both sections when another framework is picked', () => {
    render(<CompetencyRoleTab frameworkIds={['fw', 'fw2']} />);
    fireEvent.change(screen.getByTestId('competency-role-framework'), { target: { value: 'fw2' } });
    expect(screen.getByTestId('defs')).toHaveTextContent('fw2');
    expect(screen.getByTestId('assign')).toHaveTextContent('fw2');
  });
});
