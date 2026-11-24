import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomeStatsCards from './HomeStatsCards';

// Mock useAppI18n
vi.mock('@/hooks/useAppI18n', () => ({
    useAppI18n: () => ({
        t: (key: string, opts?: { paths?: number; courses?: number }) => key === 'statsCards.split'
            ? `Paths: ${opts?.paths} · Courses: ${opts?.courses}`
            : ({
            'statsCards.totalLearning': 'Total Learning',
            'statsCards.inProgress': 'In Progress',
            'statsCards.completed': 'Completed',
            'statsCards.certificationsEarned': 'Certifications Earned',
        }[key] ?? key),
        languages: [],
        currentCode: 'en',
        currentLanguage: { code: 'en', label: 'English', dir: 'ltr', index: 1, font: "'Rubik', sans-serif" },
        changeLanguage: vi.fn(),
        isRTL: false,
        dir: 'ltr',
    }),
}));

// Mock useUserEnrolledCollections
const mockUseUserEnrolledCollections = vi.fn();
vi.mock('@/hooks/useUserEnrolledCollections', () => ({
    useUserEnrolledCollections: () => mockUseUserEnrolledCollections(),
}));

let mockSummaries: unknown[] = [];
vi.mock('@/hooks/useViewerSummary', () => ({
    useViewerSummary: () => ({ data: mockSummaries, isLoading: false }),
}));

// Mock useUserCertificates
const mockUseUserCertificates = vi.fn();
vi.mock('@/hooks/useCertificate', () => ({
    useUserCertificates: () => mockUseUserCertificates(),
}));

const mockCourses = [
    { courseId: 'course-1', status: 0, completionPercentage: 0 },   // not started
    { courseId: 'course-2', status: 1, completionPercentage: 50 },  // in progress
    { courseId: 'course-3', status: 2, completionPercentage: 100 }, // completed
    { courseId: 'course-4', status: 2, completionPercentage: 100 }, // completed
    { courseId: 'course-5', status: 1, completionPercentage: 100 }, // status lag: counts as completed
];

// Expected: totalCourses=5, inProgress=1 (status 1 but not completionPercentage>=100), completed=3

describe('HomeStatsCards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserEnrolledCollections.mockReturnValue({
            data: { data: { courses: mockCourses } },
            isLoading: false,
        });
        mockUseUserCertificates.mockReturnValue({
            data: { data: [{ id: 'cert-1' }, { id: 'cert-2' }] },
            isLoading: false,
        });
    });

    it('renders all four stats cards with correct labels and values', () => {
        render(<HomeStatsCards />);

        // Total Courses: 5 courses enrolled
        const totalCard = screen.getByText('Total Learning').closest('.home-stat-card');
        expect(totalCard).toBeInTheDocument();
        expect(totalCard!.querySelector('.home-stat-value')!.textContent).toBe('05');

        // Courses in Progress: status === 1 && completionPercentage < 100 => 1
        const progressCard = screen.getByText('In Progress').closest('.home-stat-card');
        expect(progressCard).toBeInTheDocument();
        expect(progressCard!.querySelector('.home-stat-value')!.textContent).toBe('01');

        // Courses Completed: status === 2 (x2) + completionPercentage >= 100 with status lag (x1) => 3
        const completedCard = screen.getByText('Completed').closest('.home-stat-card');
        expect(completedCard).toBeInTheDocument();
        expect(completedCard!.querySelector('.home-stat-value')!.textContent).toBe('03');

        // Certifications Earned: 2 certificates
        const certsCard = screen.getByText('Certifications Earned').closest('.home-stat-card');
        expect(certsCard).toBeInTheDocument();
        expect(certsCard!.querySelector('.home-stat-value')!.textContent).toBe('02');
    });

    it('applies correct background classes to cards', () => {
        render(<HomeStatsCards />);

        const totalCard = screen.getByText('Total Learning').closest('.home-stat-card');
        expect(totalCard).toHaveClass('bg-sunbird-blue-light');

        const progressCard = screen.getByText('In Progress').closest('.home-stat-card');
        expect(progressCard).toHaveClass('bg-sunbird-ginger');

        const completedCard = screen.getByText('Completed').closest('.home-stat-card');
        expect(completedCard).toHaveClass('bg-sunbird-moss');

        const certsCard = screen.getByText('Certifications Earned').closest('.home-stat-card');
        expect(certsCard).toHaveClass('bg-sunbird-lavender');
    });

    it('renders icons for each card', () => {
        const { container } = render(<HomeStatsCards />);

        const icons = container.querySelectorAll('svg');
        expect(icons.length).toBe(4);
    });

    it('handles empty courses data', () => {
        mockUseUserEnrolledCollections.mockReturnValue({
            data: { data: { courses: [] } },
            isLoading: false,
        });
        mockUseUserCertificates.mockReturnValue({
            data: { data: [] },
            isLoading: false,
        });

        render(<HomeStatsCards />);

        expect(screen.getByText('Total Learning')).toBeInTheDocument();
        expect(screen.getByText('In Progress')).toBeInTheDocument();
        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.getByText('Certifications Earned')).toBeInTheDocument();

        // All values should be "0" (not padded when zero)
        const zeroValues = screen.getAllByText('0');
        expect(zeroValues.length).toBe(4);
    });

    it('handles undefined/null data gracefully', () => {
        mockUseUserEnrolledCollections.mockReturnValue({
            data: undefined,
            isLoading: false,
        });
        mockUseUserCertificates.mockReturnValue({
            data: undefined,
            isLoading: false,
        });

        render(<HomeStatsCards />);

        const zeroValues = screen.getAllByText('0');
        expect(zeroValues.length).toBe(4);
    });

    it('shows loading state while data is being fetched', () => {
        mockUseUserEnrolledCollections.mockReturnValue({
            data: undefined,
            isLoading: true,
        });
        mockUseUserCertificates.mockReturnValue({
            data: undefined,
            isLoading: true,
        });

        render(<HomeStatsCards />);

        // Should show loading placeholders
        const loadingValues = screen.getAllByText('--');
        expect(loadingValues.length).toBe(4);

        // Cards should have pulse animation
        const cards = document.querySelectorAll('.home-stat-card');
        cards.forEach(card => {
            expect(card).toHaveClass('animate-pulse');
        });
    });

    // Regression: one finished path counted as 5 courses, 1 in progress, 3 completed.
    it('counts a learning path once, not its per-course records, with its real progress', () => {
        mockUseUserEnrolledCollections.mockReturnValue({
            data: { data: { courses: [
                { courseId: 'lp1', batchId: 'b1', status: 1, completionPercentage: 50, leafNodesCount: 2,
                  content: { primaryCategory: 'Learning Path' } },
                { courseId: 'c1', batchId: 'b1:c1', status: 2, completionPercentage: 100 },
            ] } },
            isLoading: false,
        });
        mockSummaries = [{ userId: 'u', collectionId: 'lp1', contextId: 'b1', active: true, status: 2, progress: 2,
            contentStatus: { a: 2, b: 2 } }];
        render(<HomeStatsCards />);
        expect(screen.getByText('Total Learning').closest('div.home-stat-card')).toHaveTextContent('01');
        expect(screen.getByTestId('home-stat-sub-total')).toHaveTextContent('Paths: 1 · Courses: 0');
        expect(screen.getByTestId('home-stat-sub-completed')).toHaveTextContent('Paths: 1 · Courses: 0');
        mockSummaries = [];
    });
});
