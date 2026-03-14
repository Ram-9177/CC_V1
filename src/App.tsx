import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from './lib/store'
import { api } from './lib/api'
import { canAccessPath, getRoleHome, COMMON_PATHS } from './lib/rbac'
import { useMyPermissions } from './hooks/useMyPermissions'
import { Toaster } from '@/components/ui/sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useOfflineProtection } from './hooks/useOfflineProtection'
import ErrorBoundary from './components/ErrorBoundary'
import { usePWAStore, type BeforeInstallPromptEvent } from '@/lib/pwa-store'
import ScrollToTop from './components/ScrollToTop'
import { useRealtimeRoleSync } from './hooks/useWebSocket'
import { BrandedLoading } from './components/common/BrandedLoading'

// Lazy load all routes for better code splitting
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const RequestPasswordReset = lazy(() => import('./pages/auth/RequestPasswordReset'))
const ResetPasswordConfirm = lazy(() => import('./pages/auth/ResetPasswordConfirm'))
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const RoomsPage = lazy(() => import('./pages/RoomsPage'))
const GatePassesPage = lazy(() => import('./pages/GatePassesPage'))
const AttendancePage = lazy(() => import('./pages/AttendancePage'))
const MealsPage = lazy(() => import('./pages/MealsPage'))
const NoticesPage = lazy(() => import('./pages/NoticesPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const EventsPage = lazy(() => import('./pages/EventsPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const MessagesPage = lazy(() => import('./pages/MessagesPage'))
const GateScansPage = lazy(() => import('./pages/GateScansPage'))
const CollegesPage = lazy(() => import('./pages/CollegesPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const MetricsPage = lazy(() => import('./pages/MetricsPage'))
const ComplaintsPage = lazy(() => import('./pages/ComplaintsPage'))
const VisitorsPage = lazy(() => import('./pages/admin/VisitorsPage'))
const FinesPage = lazy(() => import('./pages/FinesPage'))
const RoomMapping = lazy(() => import('./pages/admin/RoomMapping'))
const DigitalID = lazy(() => import('./pages/DigitalID'))
const LeavesPage = lazy(() => import('./pages/LeavesPage'))
const SportsDashboard = lazy(() => import('./pages/SportsDashboard'))
const SportsBookingPage = lazy(() => import('./pages/SportsBookingPage'))
const HallBookingPage = lazy(() => import('./pages/HallBookingPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function RoleProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const role = user?.role ?? null
  const { data: permissions } = useMyPermissions()

  let isAllowed: boolean
  if (permissions?.allowed_paths) {
    const p = location.pathname
    const isCommon = COMMON_PATHS.some(cp => p === cp || p.startsWith(`${cp}/`))
    const isDynamic = permissions.allowed_paths.some(ap => p === ap || p.startsWith(`${ap}/`))
    isAllowed = isCommon || isDynamic
  } else {
    // Fall back to static lookup while permissions are loading or unavailable
    isAllowed = canAccessPath(role, location.pathname, user?.student_type)
  }

  if (!isAllowed) {
    return <Navigate to={getRoleHome(role)} replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  return !isAuthenticated ? <>{children}</> : <Navigate to={getRoleHome(user?.role)} replace />
}

function AppContent() {
  // Monitor online status
  useOfflineProtection()
  // Monitor role/activation changes in real-time
  useRealtimeRoleSync()

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <RequestPasswordReset />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password/:uid/:token"
        element={
          <PublicRoute>
            <ResetPasswordConfirm />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleProtectedRoute>
              <DashboardLayout />
            </RoleProtectedRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="gate-passes" element={<GatePassesPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="meals" element={<MealsPage />} />
        <Route path="notices" element={<NoticesPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="complaints" element={<ComplaintsPage />} />
        <Route path="visitors" element={<VisitorsPage />} />
        <Route path="fines" element={<FinesPage />} />
        <Route path="gate-scans" element={<GateScansPage />} />
        <Route path="colleges" element={<CollegesPage />} />
        <Route path="tenants" element={<UsersPage />} />
        <Route path="metrics" element={<MetricsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="digital-id" element={<DigitalID />} />
        <Route path="leaves" element={<LeavesPage />} />
        <Route path="room-mapping" element={<RoomMapping />} />
        <Route path="sports-dashboard" element={<SportsDashboard />} />
        <Route path="sports-booking" element={<SportsBookingPage />} />
        <Route path="hall-booking" element={<HallBookingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  const { user, token, isAuthenticated, hasHydrated, setUser, logout } = useAuthStore()
  const queryClient = useQueryClient()
  const prevUserIdRef = useRef<number | null>(null)
  const bootstrappedSessionRef = useRef(false)

  // Avoid cross-user data leaks when switching accounts (or after logout).
  useEffect(() => {
    const currentUserId = user?.id ?? null

    if (!isAuthenticated) {
      queryClient.clear()
      prevUserIdRef.current = null
      return
    }

    const prevUserId = prevUserIdRef.current
    if (prevUserId && currentUserId && prevUserId !== currentUserId) {
      queryClient.clear()
    }

    prevUserIdRef.current = currentUserId
  }, [isAuthenticated, queryClient, user?.id])

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      usePWAStore.getState().setDeferredPrompt(e as unknown as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
       usePWAStore.getState().setDeferredPrompt(null);
       usePWAStore.getState().setStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    }
  }, [])

  useEffect(() => {
    if (!hasHydrated) {
      return
    }

    if (!token && !isAuthenticated) {
      bootstrappedSessionRef.current = false
      return
    }

    if (!token || !isAuthenticated || bootstrappedSessionRef.current) {
      return
    }
    bootstrappedSessionRef.current = true

    let isMounted = true

    const bootstrap = async () => {
      try {
        const response = await api.get('/auth/profile/')
        if (isMounted) {
          setUser(response.data)
        }
      } catch (error: unknown) {
        if (isMounted && axios.isAxiosError(error) && error.response?.status === 401) {
          logout()
        }
      }
    }

    bootstrap()

    return () => {
      isMounted = false
    }
  }, [hasHydrated, isAuthenticated, logout, setUser, token])

  if (!hasHydrated) {
    return <BrandedLoading fullScreen message="Restoring session..." />
  }

  return (
    <ErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <Toaster position="top-right" closeButton richColors expand={false} />
        <Suspense fallback={<BrandedLoading fullScreen title="CampusCore" message="Preparing your workspace..." />}>
          <AppContent />
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
