import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { GuestOnly, RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './components/AppLayout';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

// Admin pages are split into their own chunks; auth pages stay in the main bundle.
const AppointmentsPage = lazy(() =>
  import('./pages/appointments/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage })),
);
const CustomersPage = lazy(() =>
  import('./pages/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })),
);
const ServicesPage = lazy(() =>
  import('./pages/services/ServicesPage').then((m) => ({ default: m.ServicesPage })),
);
const ReminderSettingsPage = lazy(() =>
  import('./pages/settings/ReminderSettingsPage').then((m) => ({
    default: m.ReminderSettingsPage,
  })),
);
const StaffPage = lazy(() =>
  import('./pages/staff/StaffPage').then((m) => ({ default: m.StaffPage })),
);

const queryClient = new QueryClient();

function PageFallback() {
  const { t } = useTranslation();
  return <p role="status">{t('loading')}</p>;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        {/* Reachable whether or not signed in: the link comes from an email. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/settings/reminders" element={<ReminderSettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
