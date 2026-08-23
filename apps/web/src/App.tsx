import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Sidebar } from './ui/organisms/Sidebar';
import { Spinner } from './ui/atoms/Spinner';
import { LoginPage } from './pages/Auth/LoginPage';
import { RegisterPage } from './pages/Auth/RegisterPage';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import { MeetingListPage } from './pages/Meeting/MeetingListPage';
import { MeetingDetailPage } from './pages/Meeting/MeetingDetailPage';
import { OrganizationPage } from './pages/Organization/OrganizationPage';
import { ReportsPage } from './pages/Reports/ReportsPage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { NotFoundPage } from './pages/Error/NotFoundPage';
import { ROUTES } from './constants/routes.constants';
import styles from './App.module.scss';

function ProtectedLayout() {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className={styles.loadingScreen}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={ROUTES.AUTH.LOGIN} replace />;
  }

  return (
    <div className={styles.appLayout}>
      <Sidebar onLogout={() => void logout()} />
      <main className={styles.mainContent}>
        <Outlet />
      </main>
    </div>
  );
}

function GuestLayout() {
  const { user } = useAuth();
  if (user) return <Navigate to={ROUTES.DASHBOARD} replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<GuestLayout />}>
        <Route path={ROUTES.AUTH.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.AUTH.REGISTER} element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedLayout />}>
        <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
        <Route path={ROUTES.MEETINGS.LIST} element={<MeetingListPage />} />
        <Route path={ROUTES.MEETINGS.DETAIL_PATTERN} element={<MeetingDetailPage />} />
        <Route path={ROUTES.ORGANIZATION} element={<OrganizationPage />} />
        <Route path={ROUTES.REPORTS} element={<ReportsPage />} />
        <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
      </Route>

      <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
