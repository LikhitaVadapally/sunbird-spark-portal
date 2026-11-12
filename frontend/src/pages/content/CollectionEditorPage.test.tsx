import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CollectionEditorPage from './CollectionEditorPage';

const { mockNavigate, mockParams, mockContentRead, mockToast, mockRetireLock, mockRole } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockParams: { contentId: 'do_123' as string | undefined },
  mockContentRead: vi.fn(),
  mockToast: vi.fn(),
  mockRetireLock: vi.fn().mockResolvedValue(undefined),
  mockRole: { resolving: false },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

vi.mock('@/services/ContentService', () => ({
  ContentService: class MockContentService {
    contentRead = mockContentRead;
  },
}));

vi.mock('@/hooks/useToast', () => ({
  toast: mockToast,
}));

vi.mock('@/hooks/useUserRead', () => ({
  useUserRead: () => ({
    data: {
      data: {
        response: {
          roles: [{ role: 'CONTENT_REVIEWER' }],
        },
      },
    },
  }),
}));

vi.mock('@/hooks/useEditorLock', () => ({
  useEditorLock: ({ metadata }: { metadata: any }) => {
    const status = metadata?.status;
    let editorMode: 'edit' | 'read' | 'review' = 'edit';
    
    if (status === 'FlagReview' || status === 'FlagDraft' || status === 'Processing') {
      editorMode = 'read';
    } else if (status === 'Review') {
      editorMode = 'review';
    }
    
    return {
      editorMode,
      isEditMode: editorMode === 'edit',
      lockError: null,
      isLocking: false,
      isResolvingRole: mockRole.resolving,
      retireLock: mockRetireLock,
    };
  },
}));

vi.mock('@/components/common/PageLoader', () => ({
  default: ({ message }: { message: string }) => <div data-testid="page-loader">{message}</div>,
}));

vi.mock('@/components/editors/CollectionEditor', () => ({
  default: ({
    identifier,
    mode,
    onToolbarEvent,
  }: {
    identifier: string;
    mode: string;
    onToolbarEvent?: (event: { action: string; data?: unknown }) => void;
  }) => (
    <div data-testid="collection-editor">
      <span data-testid="identifier">{identifier}</span>
      <span data-testid="editor-mode">{mode}</span>
      <button type="button" onClick={() => onToolbarEvent?.({ action: 'back' })}>
        Close editor
      </button>
    </div>
  ),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('CollectionEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.contentId = 'do_123';
    mockRole.resolving = false;
    mockContentRead.mockResolvedValue({
      data: {
        content: {
          identifier: 'do_123',
          status: 'Draft',
          primaryCategory: 'Course',
        },
      },
    });
  });

  it('shows a loader while metadata is loading', () => {
    mockContentRead.mockImplementation(
      () => new Promise(() => undefined) as ReturnType<typeof mockContentRead>
    );

    renderWithRouter(<CollectionEditorPage />);
    expect(screen.getByTestId('page-loader')).toHaveTextContent('content.loadingEditor');
  });

  it('renders collection editor in read mode for FlagReview status', async () => {
    mockContentRead.mockResolvedValue({
      data: {
        content: {
          identifier: 'do_123',
          status: 'FlagReview',
          primaryCategory: 'Course',
        },
      },
    });

    renderWithRouter(<CollectionEditorPage />);

    await waitFor(() => {
      expect(screen.getByTestId('collection-editor')).toBeInTheDocument();
    });

    expect(mockContentRead).toHaveBeenCalledWith('do_123', expect.any(Array), 'edit');
    expect(screen.getByTestId('identifier')).toHaveTextContent('do_123');
    expect(screen.getByTestId('editor-mode')).toHaveTextContent('read');
  });

  it('maps Review status to review mode', async () => {
    mockContentRead.mockResolvedValue({
      data: {
        content: {
          identifier: 'do_123',
          status: 'Review',
          primaryCategory: 'Course',
        },
      },
    });

    renderWithRouter(<CollectionEditorPage />);

    await waitFor(() => {
      expect(screen.getByTestId('editor-mode')).toHaveTextContent('review');
    });
  });

  it('keeps the loader up while the user role is loading, so a reviewer never gets a read-only editor', async () => {
    mockContentRead.mockResolvedValue({
      data: { content: { identifier: 'do_123', status: 'Review', primaryCategory: 'Course' } },
    });
    mockRole.resolving = true;

    renderWithRouter(<CollectionEditorPage />);
    await waitFor(() => expect(mockContentRead).toHaveBeenCalled());

    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
    expect(screen.queryByTestId('collection-editor')).not.toBeInTheDocument();
  });

  it('shows error toast and fallback when metadata fetch fails', async () => {
    mockContentRead.mockRejectedValue(new Error('failed'));

    renderWithRouter(<CollectionEditorPage />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'error',
          description: 'content.failedToLoadMetadata',
          variant: 'destructive',
        })
      );
    });

    expect(screen.getByText('content.failedToLoadMetadata')).toBeInTheDocument();
    expect(screen.queryByTestId('collection-editor')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'content.backToWorkspace' })).toBeInTheDocument();
  });

  it('shows missing identifier fallback when contentId is absent', async () => {
    mockParams.contentId = undefined;

    renderWithRouter(<CollectionEditorPage />);

    await waitFor(() => {
      expect(screen.getByText('content.missingIdentifier')).toBeInTheDocument();
    });

    expect(mockContentRead).not.toHaveBeenCalled();
    expect(screen.queryByTestId('collection-editor')).not.toBeInTheDocument();
  });

  it('navigates back to workspace when editor emits close event', async () => {
    renderWithRouter(<CollectionEditorPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Close editor' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
    
    await waitFor(() => {
      expect(mockRetireLock).toHaveBeenCalled();
    });
    
    expect(mockNavigate).toHaveBeenCalledWith('/workspace');
  });
});
