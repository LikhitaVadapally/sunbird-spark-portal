import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
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

// Radix Select needs real pointer events; a native <select> keeps the same contract for tests.
vi.mock('@/components/common/Select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) => (
    <select data-testid="skill-framework-id" value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, disabled, children }: { value: string; disabled?: boolean; children: ReactNode }) => <option value={value} disabled={disabled}>{children}</option>,
}));

type Mut = { mutate: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn>; isPending: boolean; isSuccess: boolean; data?: unknown; error?: unknown };
const mut = (over: Partial<Mut> = {}): Mut => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isSuccess: false, data: undefined, error: null, ...over });
const asHook = (m: Mut) => m as unknown as ReturnType<typeof hooks.useValidateTermSheet>;

const summary = { toCreate: 12, toUpdate: 3, toUpdateLive: 1, toUpdateDraft: 2, toRetire: 2, errors: 0, warnings: 0 };
let read: Mut, create: Mut, download: Mut, validate: Mut, commit: Mut, publish: Mut;

const setup = () => {
  vi.mocked(hooks.useCompetencyFrameworkOptions).mockReturnValue({ options: [{ id: 'fw_a', name: 'Nursing', status: 'Live' }], isLoading: false, isError: false });
  vi.mocked(hooks.useReadCompetencyFramework).mockReturnValue(asHook(read) as never);
  vi.mocked(hooks.useCreateCompetencyFramework).mockReturnValue(asHook(create) as never);
  vi.mocked(hooks.useDownloadTermSheet).mockReturnValue(asHook(download) as never);
  vi.mocked(hooks.useValidateTermSheet).mockReturnValue(asHook(validate));
  vi.mocked(hooks.useCommitTermSheet).mockReturnValue(asHook(commit) as never);
  vi.mocked(hooks.usePublishCompetencyFramework).mockReturnValue(asHook(publish) as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  read = mut({ mutate: vi.fn((id: string, opts?: { onSuccess?: (fw: unknown) => void }) => opts?.onSuccess?.({ identifier: id, name: 'Nursing', status: 'Live', categories: [{ code: 'skill', terms: [{ code: 's1' }] }] })) });
  create = mut();
  download = mut();
  validate = mut();
  commit = mut();
  publish = mut();
  setup();
});

const renderTab = () => render(<SkillFrameworkTab channel="ch1" orgName="Org" />);
const openFramework = () => {
  fireEvent.change(screen.getByTestId('skill-framework-id'), { target: { value: 'fw_a' } });
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
      {
        name: 'Nursing', code: 'nursing_skills', channel: 'ch1', description: '',
        levels: [
          { code: 'competencyarea', name: 'Competency Area' },
          { code: 'competency', name: 'Competency' },
          { code: 'skill', name: 'Skill' },
        ],
      },
      expect.anything()
    );
  });

  it('blocks Create while a level is not accepted', () => {
    renderTab();
    fireEvent.click(screen.getByTestId('skill-framework-mode-new'));
    fireEvent.change(screen.getByTestId('skill-framework-name'), { target: { value: 'Cooking' } });
    fireEvent.change(screen.getByTestId('skill-framework-code'), { target: { value: 'fw_cook' } });
    expect(screen.getByTestId('skill-framework-create')).toBeEnabled();
    fireEvent.change(screen.getByTestId('skill-framework-level-name-2'), { target: { value: 'Subject' } });
    expect(screen.getByTestId('skill-framework-create')).toBeDisabled();
    fireEvent.change(screen.getByTestId('skill-framework-level-name-2'), { target: { value: 'Cuisine' } });
    fireEvent.click(screen.getByTestId('skill-framework-create'));
    expect(create.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ levels: expect.arrayContaining([{ code: 'cuisine', name: 'Cuisine' }]) }),
      expect.anything()
    );
  });

  it('fills the framework code from the name until the code is edited', () => {
    renderTab();
    fireEvent.click(screen.getByTestId('skill-framework-mode-new'));
    fireEvent.change(screen.getByTestId('skill-framework-name'), { target: { value: 'Nursing Skills!' } });
    expect(screen.getByTestId('skill-framework-code')).toHaveValue('nursing_skills');
    fireEvent.change(screen.getByTestId('skill-framework-code'), { target: { value: 'nurse_fw' } });
    fireEvent.change(screen.getByTestId('skill-framework-name'), { target: { value: 'Nursing' } });
    expect(screen.getByTestId('skill-framework-code')).toHaveValue('nurse_fw');
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
    read.mutate = vi.fn((id: string, opts?: { onSuccess?: (fw: unknown) => void }) => opts?.onSuccess?.({ identifier: id, status: 'Review', categories: [{ code: 'skill', terms: [{ code: 's1' }] }] }));
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

  it('says so when there are no frameworks to pick', () => {
    vi.mocked(hooks.useCompetencyFrameworkOptions).mockReturnValue({ options: [], isLoading: false, isError: false });
    render(<SkillFrameworkTab channel="ch1" />);
    expect(screen.getByTestId('skill-framework-none')).toBeInTheDocument();
  });

  // Showing "No frameworks yet. Create one" here would push the admin to create a duplicate.
  it('shows loading, not "no frameworks", while the list loads', () => {
    vi.mocked(hooks.useCompetencyFrameworkOptions).mockReturnValue({ options: [], isLoading: true, isError: false });
    render(<SkillFrameworkTab channel="ch1" />);
    expect(screen.getByTestId('skill-framework-options-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('skill-framework-none')).not.toBeInTheDocument();
  });

  it('shows an error, not "no frameworks", when the list fails', () => {
    vi.mocked(hooks.useCompetencyFrameworkOptions).mockReturnValue({ options: [], isLoading: false, isError: true });
    render(<SkillFrameworkTab channel="ch1" />);
    expect(screen.getByTestId('skill-framework-options-error')).toBeInTheDocument();
    expect(screen.queryByTestId('skill-framework-none')).not.toBeInTheDocument();
  });

  it('warns when an opened framework has no categories', () => {
    read.mutate = vi.fn((id: string, opts?: { onSuccess?: (fw: unknown) => void }) => opts?.onSuccess?.({ identifier: id, status: 'Draft' }));
    renderTab();
    openFramework();
    expect(screen.getByTestId('skill-framework-no-categories')).toBeInTheDocument();
  });

  it('saves the exported CSV in one click when it can be fetched', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['csv'])) });
    vi.stubGlobal('fetch', fetchMock);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    download.isSuccess = true;
    download.data = 'https://blob/fw_a.csv';
    renderTab();
    openFramework();
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('https://blob/fw_a.csv');
    expect(screen.queryByTestId('skill-framework-download-link')).not.toBeInTheDocument();
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('falls back to a link when the export cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('CORS')));
    download.isSuccess = true;
    download.data = 'https://blob/fw_a.csv';
    renderTab();
    openFramework();
    expect(await screen.findByTestId('skill-framework-download-link')).toHaveAttribute('href', 'https://blob/fw_a.csv');
    vi.unstubAllGlobals();
  });

  it('offers only the blank template for a new framework and names its categories', () => {
    read.mutate = vi.fn((id: string, opts?: { onSuccess?: (fw: unknown) => void }) =>
      opts?.onSuccess?.({ identifier: id, status: 'Draft', categories: [{ code: 'competencyarea' }, { code: 'skill' }] }));
    create.mutate = vi.fn((_input: unknown, opts?: { onSuccess?: (id: string) => void }) => opts?.onSuccess?.('fw_new'));
    renderTab();
    fireEvent.click(screen.getByTestId('skill-framework-mode-new'));
    fireEvent.change(screen.getByTestId('skill-framework-name'), { target: { value: 'New' } });
    fireEvent.change(screen.getByTestId('skill-framework-code'), { target: { value: 'fw_new' } });
    fireEvent.click(screen.getByTestId('skill-framework-create'));
    expect(screen.queryByTestId('skill-framework-download')).not.toBeInTheDocument();
    expect(screen.getByTestId('skill-framework-template')).toBeInTheDocument();
    expect(screen.getByTestId('skill-framework-new-hint')).toHaveTextContent('competencyarea, skill');
  });

  it('offers only the current skills export for a framework that has skills', () => {
    renderTab();
    openFramework();
    expect(screen.getByTestId('skill-framework-download')).toBeInTheDocument();
    expect(screen.queryByTestId('skill-framework-template')).not.toBeInTheDocument();
    expect(screen.queryByTestId('skill-framework-new-hint')).not.toBeInTheDocument();
  });

  it('treats an existing framework with no skills like a new one', () => {
    read.mutate = vi.fn((id: string, opts?: { onSuccess?: (fw: unknown) => void }) =>
      opts?.onSuccess?.({ identifier: id, status: 'Draft', categories: [{ code: 'competency', terms: [] }, { code: 'skill' }] }));
    renderTab();
    openFramework();
    expect(screen.queryByTestId('skill-framework-download')).not.toBeInTheDocument();
    expect(screen.getByTestId('skill-framework-template')).toBeInTheDocument();
    expect(screen.getByTestId('skill-framework-new-hint')).toHaveTextContent('competency, skill');
  });

  it('commits straight away, without a warning, when nothing will be retired', () => {
    validate.data = { valid: true, summary: { ...summary, toRetire: 0 }, rows: [] };
    renderTab();
    openFramework();
    const file = chooseFile();
    expect(screen.queryByTestId('skill-framework-retire-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('skill-framework-acknowledge')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('skill-framework-commit'));
    expect(commit.mutate).toHaveBeenCalledWith({ frameworkId: 'fw_a', file });
  });
});
