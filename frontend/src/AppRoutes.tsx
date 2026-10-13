import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
};
import { AuthProvider } from './auth/AuthContext';
import UnauthorizedHandler from './components/common/UnauthorizedHandler';
import { ProtectedRoute } from './rbac/ProtectedRoute';
import PageLayout from './components/layout/PageLayout';

import Home from './pages/home/Home';
import Profile from './pages/profile/Profile';
import MySkills from './pages/mySkills/MySkills';
import DeleteAccountGate from './pages/profile/DeleteAccountGate';
import WorkspacePage from './pages/workspace/WorkspacePage';
import ReportsPage from './pages/reports/ReportsPage';
import CreateContentPage from './pages/content/CreateContentPage';
import CollectionDetailPage from './pages/collection/CollectionDetailPage';
import LearningPathPage from './pages/learningPath/LearningPathPage';
import Index from './pages/Index';
import ForgotPassword from './pages/forgotPassword/ForgotPassword';
import PasswordResetSuccess from './pages/forgotPassword/PasswordResetSuccess';
import SignUp from './pages/signup/SignUp';
import HelpSupport from './pages/helpSupport/HelpSupport';
import HelpCategoryDetail from './pages/helpSupport/HelpCategoryDetail';
import ContentPlayerPage from './pages/content/ContentPlayerPage';
import ContentEditorPage from './pages/content/ContentEditorPage';
import CollectionEditorPage from './pages/content/CollectionEditorPage';
import Explore from './pages/Explore';
import MyLearning from './pages/myLearning/MyLearning';
import GenericEditorPage from './pages/workspace/editors/GenericEditorPage';
import QumlEditorPage from './pages/content/QumlEditorPage';
import ContentViewPage from './pages/workspace/ContentViewPage';
import Onboarding from './pages/onboarding/OnboardingPage';
import CertificateVerificationPage from './pages/CertificateVerificationPage';
import OnboardingGuard from './rbac/OnboardingGuard';
import CourseDashboardPage from './pages/courseDashboard/CourseDashboardPage';
import UserManagementPage from './pages/user-management/UserManagementPage';
import PlatformReports from './pages/reports/PlatformReports';
import CourseReport from './pages/reports/CourseReport';
import UserReport from './pages/reports/UserReport';


const AppRoutes: React.FC = () => {
  return (
    <AuthProvider>
      <UnauthorizedHandler />
      <ScrollToTop />
      <Routes>
        {/* Standalone public routes (no shared sidebar layout) */}
        <Route path="/" element={<Index />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/password-reset-success" element={<PasswordResetSuccess />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/profile/delete" element={<DeleteAccountGate />} />
        <Route path="/content/:contentId" element={<ContentPlayerPage />} />
        <Route path="/certs/:certificateId" element={<CertificateVerificationPage />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="collection">
          <Route path=":collectionId" element={<CollectionDetailPage />}>
            <Route path="content/:contentId" element={null} />
          </Route>
          <Route path=":collectionId/batch/:batchId" element={<CollectionDetailPage />}>
            <Route path="content/:contentId" element={null} />
          </Route>
          <Route path=":collectionId/dashboard/:tab" element={<CourseDashboardPage />} />
        </Route>
        {/* Learning Path creator dashboard - same page as the Course dashboard above (see
            CourseDashboardPage's isLearningPath branch); kept outside the shared-sidebar
            `learning-path` block below since this page renders its own Header/Footer. */}
        <Route path="learning-path/:pathId/dashboard/:tab" element={<CourseDashboardPage />} />

        {/* Full-screen routes (own layout, no shared sidebar) */}
        <Route path="/workspace/review/:contentId" element={
          <ProtectedRoute allowedRoles={['CONTENT_REVIEWER']}>
            <ContentViewPage mode="review" />
          </ProtectedRoute>
        } />
        <Route path="/workspace/view/:contentId" element={
          <ProtectedRoute allowedRoles={['CONTENT_CREATOR', 'CONTENT_REVIEWER']}>
            <ContentViewPage mode="view" />
          </ProtectedRoute>
        } />

        {/* Editor routes (full-screen, no sidebar layout) */}
        <Route path="/create" element={
          <ProtectedRoute allowedRoles={['CONTENT_CREATOR']}>
            <CreateContentPage />
          </ProtectedRoute>
        } />
        <Route path="/edit/content-editor/:contentId" element={
          <ProtectedRoute allowedRoles={['CONTENT_CREATOR']}>
            <ContentEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/edit/collection-editor/:contentId" element={
          <ProtectedRoute allowedRoles={['CONTENT_CREATOR', 'CONTENT_REVIEWER', 'BOOK_CREATOR', 'BOOK_REVIEWER']}>
            <CollectionEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/edit/quml-editor/:contentId" element={
          <ProtectedRoute allowedRoles={['CONTENT_CREATOR', 'CONTENT_REVIEWER']}>
            <QumlEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/workspace/content/edit/generic" element={
          <ProtectedRoute allowedRoles={['CONTENT_CREATOR']}>
            <GenericEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/workspace/content/edit/generic/:contentId/:state/:framework/:contentStatus" element={
          <ProtectedRoute allowedRoles={['CONTENT_CREATOR']}>
            <GenericEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/workspace/content/edit/generic/:contentId/:state/:framework" element={
          <ProtectedRoute allowedRoles={['CONTENT_CREATOR']}>
            <GenericEditorPage />
          </ProtectedRoute>
        } />
        <Route path="/workspace/content/edit/editorforlargecontent" element={
          <ProtectedRoute allowedRoles={['CONTENT_CREATOR']}>
            <GenericEditorPage />
          </ProtectedRoute>
        } />

        {/* Layout routes — share Header, Sidebar, Footer via PageLayout */}
        <Route element={<OnboardingGuard><PageLayout /></OnboardingGuard>}>
          <Route path="/home" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/my-learning" element={<MyLearning />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/skills" element={<MySkills />} />
          {/* The Competency Profile page was folded into My Skills; keep old links working. */}
          <Route path="/profile/competencies" element={<Navigate to="/profile/skills" replace />} />
          <Route path="/help-support" element={<HelpSupport />} />
          <Route path="/help-support/:categoryId" element={<HelpCategoryDetail />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/platform" element={
            <ProtectedRoute allowedRoles={['ORG_ADMIN']}>
              <PlatformReports />
            </ProtectedRoute>
          } />
          <Route path="/reports/course/:courseId" element={
            <ProtectedRoute allowedRoles={['COURSE_MENTOR', 'CONTENT_CREATOR']}>
              <CourseReport />
            </ProtectedRoute>
          } />
          <Route path="/reports/user/:userId" element={<UserReport />} />
          <Route path="/user-management" element={
            <ProtectedRoute allowedRoles={['ORG_ADMIN']}>
              <UserManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/workspace" element={
            <ProtectedRoute allowedRoles={['CONTENT_CREATOR', 'CONTENT_REVIEWER', 'BOOK_CREATOR', 'BOOK_REVIEWER']}>
              <WorkspacePage />
            </ProtectedRoute>
          } />
          <Route path="learning-path">
            <Route path=":pathId" element={<LearningPathPage />} />
            {/* Not-yet-enrolled variants (no contextId in the URL) - mirrors CollectionDetailPage's :collectionId vs :collectionId/batch/:batchId split. */}
            <Route path=":pathId/level/:levelId" element={<LearningPathPage />} />
            <Route path=":pathId/prior" element={<LearningPathPage />} />
            <Route path=":pathId/outcome" element={<LearningPathPage />} />
            <Route path=":pathId/complete" element={<LearningPathPage />} />
            <Route path=":pathId/status" element={<LearningPathPage />} />
            <Route path=":pathId/course/:courseId/content/:contentId" element={<LearningPathPage />} />
            <Route path=":pathId/batch/:contextId" element={<LearningPathPage />} />
            <Route path=":pathId/batch/:contextId/level/:levelId" element={<LearningPathPage />} />
            <Route path=":pathId/batch/:contextId/prior" element={<LearningPathPage />} />
            <Route path=":pathId/batch/:contextId/outcome" element={<LearningPathPage />} />
            <Route path=":pathId/batch/:contextId/complete" element={<LearningPathPage />} />
            <Route path=":pathId/batch/:contextId/status" element={<LearningPathPage />} />
            <Route path=":pathId/batch/:contextId/course/:courseId/content/:contentId" element={<LearningPathPage />} />
          </Route>
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default AppRoutes;
