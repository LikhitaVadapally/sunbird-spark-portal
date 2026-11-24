import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';
import React from 'react';
import ProfileLearningList from './ProfileLearningList';
import { useUserEnrolledCollections } from '@/hooks/useUserEnrolledCollections';
import { useCertificateDownload } from '@/hooks/useCertificateDownload';

// Mock hooks
vi.mock('@/hooks/useUserEnrolledCollections', () => ({
    useUserEnrolledCollections: vi.fn(),
}));

const mockDownloadCertificate = vi.fn();
const mockHasCertificate = vi.fn();

let mockSummaries: unknown[] = [];
vi.mock('@/hooks/useViewerSummary', () => ({
  useViewerSummary: () => ({ data: mockSummaries, isLoading: false }),
}));

vi.mock('@/hooks/useCertificateDownload', () => ({
    useCertificateDownload: vi.fn(() => ({
        downloadCertificate: mockDownloadCertificate,
        hasCertificate: mockHasCertificate,
        downloadingCourseId: null,
    })),
}));

vi.mock('@/hooks/useAppI18n', () => ({
    useAppI18n: () => ({
        t: (key: string, params?: Record<string, string>) => {
            const translations: Record<string, string> = {
                'tabs.all': 'all',
                'status.ongoing': 'ongoing',
                'status.completed': 'completed',
                'profileLearning.myLearning': 'My Learning',
                'profileLearning.filter': 'Filter',
                'profileLearning.loadingCourses': 'Loading your courses...',
                'profileLearning.failedToLoadCourses': 'Failed to load courses. Please try again.',
                'profileLearning.noCoursesEnrolled': 'No courses enrolled yet.',
                'profileLearning.noFilteredCourses': 'No {{filter}} courses found.',
                'profileLearning.viewMoreCourses': 'View More Courses',
                'profileLearning.viewLess': 'View Less',
                'profileLearning.downloading': 'Downloading...',
                'profileLearning.noCertificate': 'No certificate',
                'common.downloadCertificate': 'common.downloadCertificate',
            };
            let result = translations[key] ?? key;
            if (params) {
                Object.entries(params).forEach(([k, v]) => {
                    result = result.replace(`{{${k}}}`, String(v));
                });
            }
            return result;
        },
    }),
}));

// Mock DropdownMenu to render content inline for easy testing

vi.mock('@/components/common/DropdownMenu', () => ({
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-trigger">{children}</div>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
    DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode, onClick?: () => void }) => (
        <button data-testid={`filter-option-${children?.toString().toLowerCase()}`} onClick={onClick}>
            {children}
        </button>
    ),
}));

// Mock PageLoader
vi.mock('@/components/common/PageLoader', () => ({
    default: ({
        message,
        error,
        onRetry,
    }: {
        message: string;
        error?: string;
        onRetry?: () => void;
    }) => (
        <div>
            <div>{message}</div>
            {error && <div>{error}</div>}
            {onRetry && (
                <button type="button" onClick={onRetry}>
                    Retry
                </button>
            )}
        </div>
    ),
}));

describe('ProfileLearningList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHasCertificate.mockReturnValue(false);
        (useUserEnrolledCollections as Mock).mockReturnValue({
            data: {
                data: {
                    courses: [
                        { courseId: 'c1', collectionId: 'col1', batchId: '1', status: 1, courseName: 'Ongoing Course', completionPercentage: 50 },
                        { courseId: 'c2', collectionId: 'col2', batchId: '2', status: 2, courseName: 'Completed Course', completionPercentage: 100 }
                    ]
                }
            },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
        });
    });

    it('renders the list of courses', () => {
        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);
        expect(screen.getByText('Ongoing Course')).toBeInTheDocument();
        expect(screen.getByText('Completed Course')).toBeInTheDocument();
        // Check default filter label (appears in trigger + dropdown item)
        expect(screen.getAllByText('all').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByTestId('filter-option-all')).toBeInTheDocument();
    });

    // Regression: a finished path showed lern's 50% "Ongoing" here while its own page said 100%.
    it("lists a learning path as Completed when its Viewer summary is complete", () => {
        (useUserEnrolledCollections as Mock).mockReturnValue({
            data: { data: { courses: [
                { courseId: 'lp1', collectionId: 'lp1', batchId: 'b1', status: 1, courseName: 'Frontend Path',
                  completionPercentage: 50, leafNodesCount: 4, content: { primaryCategory: 'Learning Path' } },
            ] } },
            isLoading: false, isError: false, refetch: vi.fn(),
        });
        mockSummaries = [{ userId: 'u', collectionId: 'lp1', contextId: 'b1', active: true, status: 2, progress: 4,
            contentStatus: { a: 2, b: 2, c: 2, d: 2 } }];
        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);
        fireEvent.click(screen.getByTestId('filter-option-completed'));
        expect(screen.getByText('Frontend Path')).toBeInTheDocument();
        mockSummaries = [];
    });

    it('filters by Ongoing', () => {
        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);

        // Click "Ongoing" filter option (exposed by mock)
        fireEvent.click(screen.getByTestId('filter-option-ongoing'));

        // Should show Ongoing Course
        expect(screen.getByText('Ongoing Course')).toBeInTheDocument();
        // Should NOT show Completed Course
        expect(screen.queryByText('Completed Course')).not.toBeInTheDocument();
    });

    it('filters by Completed', () => {
        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);

        // Click "Completed" filter option
        fireEvent.click(screen.getByTestId('filter-option-completed'));

        // Should NOT show Ongoing Course
        expect(screen.queryByText('Ongoing Course')).not.toBeInTheDocument();
        // Should show Completed Course
        expect(screen.getByText('Completed Course')).toBeInTheDocument();
    });

    it('shows empty state when no courses match filter', () => {
        (useUserEnrolledCollections as Mock).mockReturnValue({
            data: {
                data: {
                    courses: [
                        { courseId: 'c2', batchId: '2', status: 2, courseName: 'Completed Course', completionPercentage: 100 }
                    ]
                }
            },
            isLoading: false,
            isError: false,
        });

        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);

        // Filter by Ongoing
        fireEvent.click(screen.getByTestId('filter-option-ongoing'));

        expect(screen.getByText('No ongoing courses found.')).toBeInTheDocument();
    });

    it('shows loading state', () => {
        (useUserEnrolledCollections as Mock).mockReturnValue({
            data: null,
            isLoading: true,
            isError: false,
        });

        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);
        expect(screen.getByText('Loading your courses...')).toBeInTheDocument();
    });

    it('shows error state and handles retry', () => {
        const mockRefetch = vi.fn();
        (useUserEnrolledCollections as Mock).mockReturnValue({
            data: null,
            isLoading: false,
            isError: true,
            refetch: mockRefetch,
        });

        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);
        expect(screen.getByText('Failed to load courses. Please try again.')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Retry'));
        expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('shows empty state when no courses are enrolled', () => {
        (useUserEnrolledCollections as Mock).mockReturnValue({
            data: {
                data: {
                    courses: []
                }
            },
            isLoading: false,
            isError: false,
        });

        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);
        expect(screen.getByText('No courses enrolled yet.')).toBeInTheDocument();
    });

    it('handles View More/View Less toggle functionality', () => {
        (useUserEnrolledCollections as Mock).mockReturnValue({
            data: {
                data: {
                    courses: [
                        { courseId: 'c1', batchId: '1', status: 1, courseName: 'Course 1' },
                        { courseId: 'c2', batchId: '2', status: 1, courseName: 'Course 2' },
                        { courseId: 'c3', batchId: '3', status: 1, courseName: 'Course 3' },
                        { courseId: 'c4', batchId: '4', status: 1, courseName: 'Course 4' },
                        { courseId: 'c5', batchId: '5', status: 1, courseName: 'Course 5' },
                        { courseId: 'c6', batchId: '6', status: 1, courseName: 'Course 6' },
                        { courseId: 'c7', batchId: '7', status: 1, courseName: 'Course 7' },
                    ]
                }
            },
            isLoading: false,
            isError: false,
        });

        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);

        // Initially should show 6 courses and "View More Courses" button
        expect(screen.getByText('Course 1')).toBeInTheDocument();
        expect(screen.getByText('Course 2')).toBeInTheDocument();
        expect(screen.getByText('Course 3')).toBeInTheDocument();
        expect(screen.getByText('Course 4')).toBeInTheDocument();
        expect(screen.getByText('Course 5')).toBeInTheDocument();
        expect(screen.getByText('Course 6')).toBeInTheDocument();
        expect(screen.queryByText('Course 7')).not.toBeInTheDocument();

        const toggleButton = screen.getByText('View More Courses');
        expect(toggleButton).toBeInTheDocument();

        // Click to view more
        fireEvent.click(toggleButton);
        expect(screen.getByText('Course 7')).toBeInTheDocument();
        expect(screen.getByText('View Less')).toBeInTheDocument();

        // Click to view less
        fireEvent.click(screen.getByText('View Less'));
        expect(screen.queryByText('Course 7')).not.toBeInTheDocument();
        expect(screen.getByText('View More Courses')).toBeInTheDocument();
    });

    it('resets showAll state when filter changes', () => {
        (useUserEnrolledCollections as Mock).mockReturnValue({
            data: {
                data: {
                    courses: [
                        { courseId: 'c1', batchId: '1', status: 1, courseName: 'Ongoing 1' },
                        { courseId: 'c2', batchId: '2', status: 1, courseName: 'Ongoing 2' },
                        { courseId: 'c3', batchId: '3', status: 1, courseName: 'Ongoing 3' },
                        { courseId: 'c4', batchId: '4', status: 1, courseName: 'Ongoing 4' },
                        { courseId: 'c5', batchId: '5', status: 1, courseName: 'Ongoing 5' },
                        { courseId: 'c6', batchId: '6', status: 1, courseName: 'Ongoing 6' },
                        { courseId: 'c7', batchId: '7', status: 1, courseName: 'Ongoing 7' },
                        { courseId: 'c8', batchId: '8', status: 2, courseName: 'Completed 1' },
                    ]
                }
            },
            isLoading: false,
            isError: false,
        });

        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);

        // Expand list
        fireEvent.click(screen.getByText('View More Courses'));
        expect(screen.getByText('Ongoing 7')).toBeInTheDocument();
        expect(screen.getByText('View Less')).toBeInTheDocument();

        // Change filter to Ongoing
        fireEvent.click(screen.getByTestId('filter-option-ongoing'));

        // Verification: showAll should be reset to false, meaning we only see 6 items and "View More Courses"
        expect(screen.queryByText('Ongoing 7')).not.toBeInTheDocument();
        expect(screen.getByText('View More Courses')).toBeInTheDocument();
    });

    it('renders download button only for completed courses with certificates', () => {
        mockHasCertificate.mockImplementation((courseId) => courseId === 'c2');

        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);

        const downloadButtons = screen.queryAllByText('common.downloadCertificate');
        expect(downloadButtons).toHaveLength(1);
    });

    it('does not render download button for completed courses without certificates', () => {
        mockHasCertificate.mockReturnValue(false);

        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);

        const downloadButtons = screen.queryAllByText('common.downloadCertificate');
        expect(downloadButtons).toHaveLength(0);
    });

    it('calls downloadCertificate with correct parameters when download button is clicked', () => {
        mockHasCertificate.mockReturnValue(true);

        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);

        const downloadButton = screen.getByText('common.downloadCertificate');
        fireEvent.click(downloadButton);

        expect(mockDownloadCertificate).toHaveBeenCalledWith('c2', '2', 'Completed Course', undefined, undefined);
    });

    it('shows downloading state when certificate is being downloaded', () => {
        mockHasCertificate.mockReturnValue(true);
        (useCertificateDownload as Mock).mockReturnValue({
            downloadCertificate: mockDownloadCertificate,
            hasCertificate: mockHasCertificate,
            downloadingCourseId: 'c2',
        });

        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);

        expect(screen.getByText('Downloading...')).toBeInTheDocument();
        const downloadButton = screen.getByText('Downloading...').closest('button');
        expect(downloadButton).toBeDisabled();
    });

    it('renders each course card as a link to /collection/:courseId', () => {
        render(<MemoryRouter><ProfileLearningList /></MemoryRouter>);

        const links = screen.getAllByRole('link');
        const hrefs = links.map((l) => l.getAttribute('href'));
        expect(hrefs).toContain('/collection/c1');
        expect(hrefs).toContain('/collection/c2');
    });

    it('clicking download button does not navigate away from page', () => {
        mockHasCertificate.mockReturnValue(true);
        (useCertificateDownload as Mock).mockReturnValue({
            downloadCertificate: mockDownloadCertificate,
            hasCertificate: mockHasCertificate,
            downloadingCourseId: null,
        });

        const router = createMemoryRouter(
            [{ path: '/', element: <ProfileLearningList /> }],
            { initialEntries: ['/'] }
        );
        render(<RouterProvider router={router} />);

        const downloadButton = screen.getByText('common.downloadCertificate').closest('button')!;
        fireEvent.click(downloadButton);

        expect(mockDownloadCertificate).toHaveBeenCalled();
        expect(router.state.location.pathname).toBe('/');
    });
});
