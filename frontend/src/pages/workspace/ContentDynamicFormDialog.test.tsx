import React from "react";
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentDynamicFormDialog from './ContentDynamicFormDialog';

vi.mock('@/hooks/useAppI18n', () => ({
  useAppI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'workspace.fillDetails': 'Fill in the details to create your content',
        'loading': 'Loading...',
        'failed_to_load_form': 'Failed to load form configuration. Please try again.',
        'resourceForm.failedToLoadForm': 'Failed to load form configuration. Please try again.',
        'retry': 'Retry',
        'cancel': 'Cancel',
        'create': 'Create',
        'workspace.creating': 'Creating...',
        'formFields.select': 'Select',
      };
      return translations[key] || key;
    },
  }),
}));

// Hoist the mock functions to avoid initialization order issues
const { mockFormRead, mockFrameworkRead } = vi.hoisted(() => ({
  mockFormRead: vi.fn(),
  mockFrameworkRead: vi.fn(),
}));

// Mock the Button component
vi.mock('@/components/common/Button', () => ({
  Button: ({ children, onClick, disabled, type, ...props }: any) => (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  ),
}));

// Mock services with proper implementation using relative paths that match the hooks' imports
vi.mock('../../services/FormService', () => ({
  FormService: class MockFormService {
    formRead = mockFormRead;
  },
}));

vi.mock('../../services/FrameworkService', () => ({
  FrameworkService: class MockFrameworkService {
    read = mockFrameworkRead;
  },
}));

const mockFormResponse = {
  data: {
    form: {
      data: {
        fields: [
          {
            code: 'name',
            name: 'Name',
            label: 'Content Name',
            description: 'Name of the content',
            inputType: 'text',
            required: true,
            editable: true,
            visible: true,
            placeholder: 'Enter content name',
            index: 1,
          },
          {
            code: 'description',
            name: 'Description',
            label: 'Description',
            description: 'Description of the content',
            inputType: 'text',
            required: false,
            editable: true,
            visible: true,
            placeholder: 'Enter description',
            index: 2,
          },
          {
            code: 'subject',
            name: 'Subject',
            label: 'Subject',
            description: 'Subject area',
            inputType: 'select',
            required: true,
            editable: true,
            visible: true,
            placeholder: 'Select subject',
            index: 3,
            range: [
              { key: 'mathematics', name: 'Mathematics' },
              { key: 'science', name: 'Science' },
            ],
          },
          {
            code: 'audience',
            name: 'Audience',
            label: 'Target Audience',
            description: 'Target audience',
            inputType: 'multiSelect',
            required: false,
            editable: true,
            visible: true,
            placeholder: 'Select audience',
            index: 4,
            range: [
              { key: 'student', name: 'Student' },
              { key: 'teacher', name: 'Teacher' },
            ],
          },
          {
            code: 'duration',
            name: 'Duration',
            label: 'Duration (minutes)',
            description: 'Content duration',
            inputType: 'number',
            required: false,
            editable: true,
            visible: true,
            placeholder: 'Enter duration',
            index: 5,
          },
        ],
      },
    },
  },
};

const mockFrameworkResponse = {
  data: {
    framework: {
      categories: [
        {
          code: 'gradeLevel',
          terms: [
            { name: 'Grade 1', code: 'grade1' },
            { name: 'Grade 2', code: 'grade2' },
          ],
        },
      ],
    },
  },
};

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSubmit: vi.fn(),
  isLoading: false,
  orgChannelId: 'test-channel',
  orgFramework: 'test-framework',
  formSubType: 'resource' as const,
  title: 'Create Content',
};

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('ContentDynamicFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormRead.mockResolvedValue(mockFormResponse);
    mockFrameworkRead.mockResolvedValue(mockFrameworkResponse);
  });

  it('should not render when open is false', () => {
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render dialog with title when open', async () => {
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Create Content')).toBeInTheDocument();
    expect(screen.getByText('Fill in the details to create your content')).toBeInTheDocument();
  });

  it('should show loading state while fetching form', async () => {
    // Mock a never-resolving promise to keep loading state
    mockFormRead.mockImplementation(() => new Promise(() => { }));

    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    // Check for the spinner element with new CSS class
    const spinner = document.querySelector('.loading-spinner');
    expect(spinner).toBeInTheDocument();
  });

  it('should fetch form and framework data on open', async () => {
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} />);

    await waitFor(() => {
      expect(mockFormRead).toHaveBeenCalledWith({
        type: 'content',
        action: 'create',
        subType: 'resource',
        rootOrgId: 'test-channel',
        framework: 'test-framework',
      });
    });

    expect(mockFrameworkRead).toHaveBeenCalledWith('test-framework');
  });

  it('should render form fields after successful fetch', async () => {
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Content Name')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Subject')).toBeInTheDocument();
      expect(screen.getByText('Target Audience')).toBeInTheDocument();
      expect(screen.getByText(/Duration/)).toBeInTheDocument();
    });
  });

  it('should show required field indicators', async () => {
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} />);

    await waitFor(() => {
      // Check for asterisks in required field labels - there should be multiple
      const asterisks = screen.getAllByText('*');
      expect(asterisks.length).toBeGreaterThan(0);
    });
  });

  it('should handle text input changes', async () => {
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} />);

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('Enter content name');
      act(() => {
        fireEvent.change(nameInput, { target: { value: 'Test Content' } });
      });
      expect(nameInput).toHaveValue('Test Content');
    });
  });

  it('should handle form fetch error', async () => {
    mockFormRead.mockRejectedValue(new Error('API Error'));

    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load form configuration. Please try again.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    });
  });

  it('should handle framework fetch error', async () => {
    mockFrameworkRead.mockRejectedValue(new Error('Framework API Error'));

    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load form configuration. Please try again.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    });
  });

  it('should call onClose when clicking outside dialog', async () => {
    const onClose = vi.fn();
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      act(() => {
        fireEvent.click(dialog);
      });
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('should not call onClose when clicking outside dialog while loading', async () => {
    const onClose = vi.fn();
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} onClose={onClose} isLoading={true} />);

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      act(() => {
        fireEvent.click(dialog);
      });
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should not call onClose when clicking inside dialog content', async () => {
    const onClose = vi.fn();
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      const dialogContent = screen.getByText('Fill in the details to create your content');
      act(() => {
        fireEvent.click(dialogContent);
      });
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should handle escape key to close dialog', async () => {
    const onClose = vi.fn();
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Re-fire until it registers: the dialog is in the DOM once React commits,
    // but the effect that attaches the window listener flushes afterwards, so a
    // single keydown can land before there is anything listening for it.
    await waitFor(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should close on Escape keydown on the panel and the overlay', async () => {
    const onClose = vi.fn();
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} onClose={onClose} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.keyDown(screen.getByText('Create Content'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('should not close on escape when loading', async () => {
    const onClose = vi.fn();
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} onClose={onClose} isLoading={true} />);

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should call onSubmit with form data when form is submitted', async () => {
    const onSubmit = vi.fn();
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} onSubmit={onSubmit} />);

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('Enter content name');
      const subjectSelect = screen.getByRole('combobox');

      act(() => {
        fireEvent.change(nameInput, { target: { value: 'Test Content' } });
        fireEvent.change(subjectSelect, { target: { value: 'mathematics' } });
      });

      const form = nameInput.closest('form');
      if (form) {
        act(() => {
          fireEvent.submit(form);
        });
      }
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Content',
        dynamicFields: expect.objectContaining({
          subject: 'mathematics',
        }),
      })
    );
  });

  it('should leave the description empty when none is entered (no placeholder saved as text)', async () => {
    const onSubmit = vi.fn();
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} onSubmit={onSubmit} />);

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('Enter content name');
      const subjectSelect = screen.getByRole('combobox');

      act(() => {
        fireEvent.change(nameInput, { target: { value: 'Test Content' } });
        fireEvent.change(subjectSelect, { target: { value: 'mathematics' } });
      });

      const form = nameInput.closest('form');
      if (form) {
        act(() => {
          fireEvent.submit(form);
        });
      }
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Content',
        description: '',
      })
    );
  });

  it('should handle retry on form fetch error', async () => {
    mockFormRead
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce(mockFormResponse);

    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load form configuration. Please try again.')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /Retry/ });
    act(() => {
      fireEvent.click(retryButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Content Name')).toBeInTheDocument();
    });

    expect(mockFormRead).toHaveBeenCalledTimes(2);
  });

  it('should handle retry on framework fetch error', async () => {
    mockFrameworkRead
      .mockRejectedValueOnce(new Error('Framework API Error'))
      .mockResolvedValueOnce(mockFrameworkResponse);

    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load form configuration. Please try again.')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /Retry/ });
    act(() => {
      fireEvent.click(retryButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Content Name')).toBeInTheDocument();
    });

    expect(mockFrameworkRead).toHaveBeenCalledTimes(2);
  });

  it('should show loading state on submit button when isLoading is true', async () => {
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} isLoading={true} />);

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /Creating.../ });
      expect(submitButton).toBeDisabled();
    });
  });

  it('should call onClose when cancel button is clicked', async () => {
    const onClose = vi.fn();
    renderWithQueryClient(<ContentDynamicFormDialog {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: /Cancel/ });
      act(() => {
        fireEvent.click(cancelButton);
      });
    });

    expect(onClose).toHaveBeenCalled();
  });
});