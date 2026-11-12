import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEditorLock } from './useEditorLock';

const mockGetUserRole = vi.fn();
const mockGetEditorMode = vi.fn();
const mockUseUserRead = vi.fn();
const mockUseContentLock = vi.fn();
const mockUseAuthInfo = vi.fn();

vi.mock('@/hooks/useAuthInfo', () => ({
  useAuthInfo: () => mockUseAuthInfo(),
}));

vi.mock('@/hooks/useUserRead', () => ({
  useUserRead: () => mockUseUserRead(),
}));

vi.mock('@/services/editors/editorModeService', () => ({
  getUserRole: (userData: any) => mockGetUserRole(userData),
  getEditorMode: (status: any, userRole: any, viewIntent: any) => mockGetEditorMode(status, userRole, viewIntent),
}));

vi.mock('@/hooks/useContentLock', () => ({
  useContentLock: (params: any) => mockUseContentLock(params),
}));

const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  );
};

describe('useEditorLock', () => {
  const mockRetireLock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthInfo.mockReturnValue({ isLoading: false });
    mockUseUserRead.mockReturnValue({
      data: {
        data: {
          response: {
            roles: [{ role: 'CONTENT_CREATOR' }],
          },
        },
      },
    });
    mockGetUserRole.mockReturnValue('creator');
    mockGetEditorMode.mockReturnValue('edit');
    mockUseContentLock.mockReturnValue({
      lockKey: null,
      lockError: null,
      isLocking: false,
      retireLock: mockRetireLock,
    });
  });

  it('should return edit mode for draft content with creator role', () => {
    mockGetEditorMode.mockReturnValue('edit');

    const { result } = renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: { status: 'Draft', identifier: 'do_123' },
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.editorMode).toBe('edit');
    expect(result.current.isEditMode).toBe(true);
  });

  it('should return read mode for FlagReview status', () => {
    mockGetEditorMode.mockReturnValue('read');

    const { result } = renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: { status: 'FlagReview', identifier: 'do_123' },
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.editorMode).toBe('read');
    expect(result.current.isEditMode).toBe(false);
  });

  it('should return review mode for Review status with reviewer role', () => {
    mockGetUserRole.mockReturnValue('reviewer');
    mockGetEditorMode.mockReturnValue('review');

    const { result } = renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: { status: 'Review', identifier: 'do_123' },
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.editorMode).toBe('review');
    expect(result.current.isEditMode).toBe(false);
  });

  it('should enable content lock for edit mode with draft status', () => {
    mockGetEditorMode.mockReturnValue('edit');

    renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: { status: 'Draft', identifier: 'do_123' },
        }),
      { wrapper: createWrapper() }
    );

    expect(mockUseContentLock).toHaveBeenCalledWith({
      resourceId: 'do_123',
      resourceType: 'Content',
      metadata: { status: 'Draft', identifier: 'do_123' },
      enabled: true,
    });
  });

  it('should disable content lock for non-edit mode', () => {
    mockGetEditorMode.mockReturnValue('read');

    renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: { status: 'FlagReview', identifier: 'do_123' },
        }),
      { wrapper: createWrapper() }
    );

    expect(mockUseContentLock).toHaveBeenCalledWith({
      resourceId: 'do_123',
      resourceType: 'Content',
      metadata: { status: 'FlagReview', identifier: 'do_123' },
      enabled: false,
    });
  });

  it('should disable content lock for non-draft status', () => {
    mockGetEditorMode.mockReturnValue('edit');

    renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: { status: 'Review', identifier: 'do_123' },
        }),
      { wrapper: createWrapper() }
    );

    expect(mockUseContentLock).toHaveBeenCalledWith({
      resourceId: 'do_123',
      resourceType: 'Content',
      metadata: { status: 'Review', identifier: 'do_123' },
      enabled: false,
    });
  });

  it('should return lock error when present', () => {
    mockUseContentLock.mockReturnValue({
      lockKey: null,
      lockError: 'Content is locked by another user',
      isLocking: false,
      retireLock: mockRetireLock,
    });

    const { result } = renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: { status: 'Draft', identifier: 'do_123' },
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.lockError).toBe('Content is locked by another user');
  });

  it('should return isLocking state', () => {
    mockUseContentLock.mockReturnValue({
      lockKey: null,
      lockError: null,
      isLocking: true,
      retireLock: mockRetireLock,
    });

    const { result } = renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: { status: 'Draft', identifier: 'do_123' },
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLocking).toBe(true);
  });

  it('should provide retireLock function', async () => {
    const { result } = renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: { status: 'Draft', identifier: 'do_123' },
        }),
      { wrapper: createWrapper() }
    );

    await result.current.retireLock();

    expect(mockRetireLock).toHaveBeenCalled();
  });

  it('should handle undefined contentId', () => {
    const { result } = renderHook(
      () =>
        useEditorLock({
          contentId: undefined,
          metadata: { status: 'Draft' },
        }),
      { wrapper: createWrapper() }
    );

    expect(mockUseContentLock).toHaveBeenCalledWith({
      resourceId: undefined,
      resourceType: 'Content',
      metadata: { status: 'Draft' },
      enabled: true,
    });
    expect(result.current.editorMode).toBe('edit');
  });

  it('should handle null metadata', () => {
    mockGetEditorMode.mockReturnValue('edit');

    const { result } = renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: null,
        }),
      { wrapper: createWrapper() }
    );

    expect(mockUseContentLock).toHaveBeenCalledWith({
      resourceId: 'do_123',
      resourceType: 'Content',
      metadata: null,
      enabled: false,
    });
    expect(result.current.editorMode).toBe('edit');
  });

  it('should handle case-insensitive draft status', () => {
    mockGetEditorMode.mockReturnValue('edit');

    renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: { status: 'DRAFT', identifier: 'do_123' },
        }),
      { wrapper: createWrapper() }
    );

    expect(mockUseContentLock).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      })
    );
  });

  it('should recalculate editor mode when metadata status changes', () => {
    mockGetEditorMode.mockReturnValue('edit');

    const { result, rerender } = renderHook(
      ({ metadata }) =>
        useEditorLock({
          contentId: 'do_123',
          metadata,
        }),
      {
        wrapper: createWrapper(),
        initialProps: { metadata: { status: 'Draft', identifier: 'do_123' } },
      }
    );

    expect(result.current.editorMode).toBe('edit');

    mockGetEditorMode.mockReturnValue('review');
    rerender({ metadata: { status: 'Review', identifier: 'do_123' } });

    expect(result.current.editorMode).toBe('review');
  });

  it('should forward viewIntent to getEditorMode', () => {
    mockGetEditorMode.mockReturnValue('read');

    renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: { status: 'Live', identifier: 'do_123' },
          viewIntent: true,
        }),
      { wrapper: createWrapper() }
    );

    expect(mockGetEditorMode).toHaveBeenCalledWith('Live', 'creator', true);
  });

  it('should default viewIntent to false when not provided', () => {
    mockGetEditorMode.mockReturnValue('edit');

    renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: { status: 'Live', identifier: 'do_123' },
        }),
      { wrapper: createWrapper() }
    );

    expect(mockGetEditorMode).toHaveBeenCalledWith('Live', 'creator', false);
  });

  it('should recalculate user role when userData changes', () => {
    mockGetUserRole.mockReturnValue('creator');
    mockGetEditorMode.mockReturnValue('edit');

    const { rerender } = renderHook(
      () =>
        useEditorLock({
          contentId: 'do_123',
          metadata: { status: 'Draft', identifier: 'do_123' },
        }),
      { wrapper: createWrapper() }
    );

    expect(mockGetUserRole).toHaveBeenCalled();

    mockUseUserRead.mockReturnValue({
      data: {
        data: {
          response: {
            roles: [{ role: 'CONTENT_REVIEWER' }],
          },
        },
      },
    });
    mockGetUserRole.mockReturnValue('reviewer');

    rerender();

    expect(mockGetUserRole).toHaveBeenCalledTimes(2);
  });
  describe('isResolvingRole', () => {
    const render = () => renderHook(
      () => useEditorLock({ contentId: 'do_123', metadata: { status: 'Review', identifier: 'do_123' } }),
      { wrapper: createWrapper() },
    );

    it('is true while the user read is loading, so the editor is not opened with an unknown role', () => {
      mockUseUserRead.mockReturnValue({ data: undefined, isLoading: true });
      expect(render().result.current.isResolvingRole).toBe(true);
    });

    it('is true while auth info is still loading (the user read cannot start yet)', () => {
      mockUseAuthInfo.mockReturnValue({ isLoading: true });
      mockUseUserRead.mockReturnValue({ data: undefined, isLoading: false });
      expect(render().result.current.isResolvingRole).toBe(true);
    });

    it('is false once the roles have loaded', () => {
      expect(render().result.current.isResolvingRole).toBe(false);
    });

    it('is false when the user read failed, so the page falls back instead of hanging', () => {
      mockUseUserRead.mockReturnValue({ data: undefined, isLoading: false, isError: true });
      expect(render().result.current.isResolvingRole).toBe(false);
    });
  });
});
