import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkillFrameworkTab } from './SkillFrameworkTab';
import * as hooks from '@/hooks/useCompetencyFrameworkAdmin';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({ t: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k) }),
}));
vi.mock('@/hooks/useCompetencyFrameworkAdmin', () => ({
  useCompetencyFrameworkOptions: vi.fn(),
  useReadCompetencyFramework: vi.fn(),
  useCreateCompetencyFramework: vi.fn(),
  useDownloadTermSheet: vi.fn(),
  useValidateTermSheet: vi.fn(),
  useCommitTermSheet: vi.fn(),
  usePublishCompetencyFramework: vi.fn(),
}));

type Mut = { mutate: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn>; isPending: boolean; isSuccess: boolean; data?: unknown; error?: unknown };
const mut = (over: Partial<Mut> = {}): Mut => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isSuccess: false, data: undefined, error: null, ...over });
const asHook = (m: Mut) => m as unknown as ReturnType<typeof hooks.useValidateTermSheet>;

const summary = { toCreate: 12, toUpdate: 3, toUpdateLive: 1, toUpdateDraft: 2, toRetire: 2, errors: 0, warnings: 0 };
let read: Mut, create: Mut, validate: Mut, commit: Mut, publish: Mut;

const setup = () => {
  vi.mocked(hooks.useCompetencyFrameworkOptions).mockReturnValue(['fw_a']);
  vi.mocked(hooks.useReadCompetencyFramework).mockReturnValue(asHook(read) as never);
  vi.mocked(hooks.useCreateCompetencyFramework).mockReturnValue(asHook(create) as never);
  vi.mocked(hooks.useDownloadTermSheet).mockReturnValue(asHook(mut()) as never);
  vi.mocked(hooks.useValidateTermSheet).mockReturnValue(asHook(validate));
  vi.mocked(hooks.useCommitTermSheet).mockReturnValue(asHook(commit) as never);
  vi.mocked(hooks.usePublishCompetencyFramework).mockReturnValue(asHook(publish) as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  read = mut({ mutate: vi.fn((id: string, opts?: { onSuccess?: (fw: unknown) => void }) => opts?.onSuccess?.({ identifier: id, name: 'Nursing', status: 'Live' })) });
  create = mut();
  validate = mut();
  commit = mut();
  publish = mut();
  setup();
});

const renderTab = () => render(<SkillFrameworkTab frameworkIds={['fw_a']} channel="ch1" orgName="Org" />);
const openFramework = () => {
  fireEvent.click(screen.getByTestId('skill-framework-load'));
};
const chooseFile = () => {
  const file = new File(['csv'], 'skills.csv', { type: 'text/csv' });
  fireEvent.change(screen.getByTestId('skill-framework-file'), { target: { files: [file] } });
  return file;
};

describe('SkillFrameworkTab', () => {
  it('opens an existing framework from the configured list', () => {
    renderTab();
    openFramework();
    expect(read.mutate).toHaveBeenCalledWith('fw_a', expect.anything());
    expect(screen.getByTestId('skill-framework-selected')).toHaveTextContent('Nursing (fw_a)');
  });

  it('creates a framework in the admin root-org channel, trimming input', () => {
    renderTab();
    fireEvent.click(screen.getByTestId('skill-framework-mode-new'));
    expect(screen.getByTestId('skill-framework-create')).toBeDisabled();
    fireEvent.change(screen.getByTestId('skill-framework-name'), { target: { value: ' Nursing ' } });
    fireEvent.change(screen.getByTestId('skill-framework-code'), { target: { value: ' nursing_skills ' } });
    fireEvent.click(screen.getByTestId('skill-framework-create'));
    expect(create.mutate).toHaveBeenCalledWith(
      { name: 'Nursing', code: 'nursing_skills', channel: 'ch1', description: '' },
      expect.anything()
    );
  });

  // The code becomes the identifier and a URL segment.
  it('refuses a framework code with spaces or slashes', () => {
    renderTab();
    fireEvent.click(screen.getByTestId('skill-framework-mode-new'));
    fireEvent.change(screen.getByTestId('skill-framework-name'), { target: { value: 'N' } });
    fireEvent.change(screen.getByTestId('skill-framework-code'), { target: { value: 'a b/c' } });
    expect(screen.getByTestId('skill-framework-create')).toBeDisabled();
  });

  it('validates the chosen file against the open framework', () => {
    renderTab();
    openFramework();
    const file = chooseFile();
    fireEvent.click(screen.getByTestId('skill-framework-validate'));
    expect(validate.mutate).toHaveBeenCalledWith({ frameworkId: 'fw_a', file });
  });

  it('blocks uploads while the framework is in Review', () => {
    read.mutate = vi.fn((id: string, opts?: { onSuccess?: (fw: unknown) => void }) => opts?.onSuccess?.({ identifier: id, status: 'Review' }));
    renderTab();
    openFramework();
    chooseFile();
    expect(screen.getByTestId('skill-framework-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('skill-framework-validate')).toBeDisabled();
  });

  it('shows row errors and offers no commit when the sheet is invalid', () => {
    validate.data = {
      valid: false,
      summary: { ...summary, errors: 1 },
      rows: [{ index: 4, rowType: 'create', category: 'skill', code: 'x', status: 'FAILED', errCode: 'ERR_DANGLING_ASSOCIATION', errMsg: "Associated term 'skill:y' not found" }],
    };
    renderTab();
    openFramework();
    chooseFile();
    expect(screen.getByText("Associated term 'skill:y' not found")).toBeInTheDocument();
    expect(screen.queryByTestId('skill-framework-confirm')).not.toBeInTheDocument();
  });

  it('will not commit until the admin acknowledges the retire count', () => {
    validate.data = { valid: true, summary, rows: [] };
    renderTab();
    openFramework();
    const file = chooseFile();
    expect(screen.getByTestId('skill-framework-report-toRetire')).toHaveTextContent('2');
    const commitButton = screen.getByTestId('skill-framework-commit');
    expect(commitButton).toBeDisabled();
    expect(screen.getByText(/acknowledgeRetire.*"count":2/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('skill-framework-acknowledge'));
    fireEvent.click(commitButton);
    expect(commit.mutate).toHaveBeenCalledWith({ frameworkId: 'fw_a', file });
  });

  it('offers publish only after a successful commit', () => {
    validate.data = { valid: true, summary, rows: [] };
    commit.data = { committed: true, summary: { created: 12, updated: 3, retired: 2 }, rows: [] };
    renderTab();
    openFramework();
    chooseFile();
    expect(screen.getByTestId('skill-framework-commit-report-retired')).toHaveTextContent('2');
    fireEvent.click(screen.getByTestId('skill-framework-publish'));
    expect(publish.mutate).toHaveBeenCalledWith('fw_a');
  });

  it('warns that a partially written commit was not rolled back', () => {
    commit.data = { committed: false, errCode: 'ERR_COMMIT_FAILED', summary: { errors: 1, warnings: 0 }, rows: [] };
    renderTab();
    openFramework();
    expect(screen.getByText('userManagement.skillFramework.commitPartial')).toBeInTheDocument();
    expect(screen.queryByTestId('skill-framework-publish')).not.toBeInTheDocument();
  });

  it('explains a blocked framework instead of echoing the raw server error', () => {
    validate.error = Object.assign(new Error('Cannot validate/commit terms'), { errCode: 'ERR_FRAMEWORK_REVIEW_IN_PROGRESS' });
    renderTab();
    openFramework();
    expect(screen.getByTestId('skill-framework-validate-error')).toHaveTextContent('userManagement.skillFramework.errors.editBlocked');
  });
});
