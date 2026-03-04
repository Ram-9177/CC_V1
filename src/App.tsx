import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from './lib/store'
import { api } from './lib/api'
import { canAccessPath, getRoleHome } from './lib/rbac'
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

function ProtectedRoute({ children, authReady }: { children: React.ReactNode; authReady: boolean }) {
  const { isAuthenticated } = useAuthStore()
  if (!authReady) return null
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function RoleProtectedRoute({ children, authReady }: { children: React.ReactNode; authReady: boolean }) {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const role = user?.role ?? null

  if (!authReady) return null

  const isAllowed = canAccessPath(role, location.pathname)

  if (!isAllowed) {
    return <Navigate to={getRoleHome(role)} replace />
  }

  return <>{children}</>
}

function PublicRoute({ children, authReady }: { children: React.ReactNode; authReady: boolean }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!authReady) return null
  return !isAuthenticated ? <>{children}</> : <Navigate to={getRoleHome(user?.role)} replace />
}

function AppContent({ authReady }: { authReady: boolean }) {
  // Monitor online status
  useOfflineProtection()
  // Monitor role/activation changes in real-time
  useRealtimeRoleSync()

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute authReady={authReady}>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute authReady={authReady}>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute authReady={authReady}>
            <RequestPasswordReset />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password/:uid/:token"
        element={
          <PublicRoute authReady={authReady}>
            <ResetPasswordConfirm />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute authReady={authReady}>
            <RoleProtectedRoute authReady={authReady}>
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
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  const { user, isAuthenticated, setUser, logout } = useAuthStore()
  const [authReady, setAuthReady] = useState(false)
  const queryClient = useQueryClient()
  const prevUserIdRef = useRef<number | null>(null)

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
    let isMounted = true

    const bootstrap = async () => {
      try {
        const response = await api.get('/profile/')
        if (isMounted) {
          setUser(response.data)  // Fresh role from server
          setAuthReady(true)
        }
      } catch (error: unknown) {
        if (isMounted) {
          if (axios.isAxiosError(error)) {
            const status = error.response?.status
            const responseData = error.response?.data as Record<string, unknown> | undefined
            const errorCode = responseData?.code as string | undefined

            if (status === 401) {
              // Token invalid/expired — logout
              logout()
            } else if (status === 403) {
              // 403 means the user IS authenticated but access is restricted.
              // College/Hostel/Block/Floor disabled → the api interceptor will
              // handle the redirect to /login with the appropriate message.
              // For these specific codes, we do NOT need to manually logout here
              // because the interceptor already does it.
              const isDisabledError = ['COLLEGE_DISABLED', 'HOSTEL_DISABLED', 'BLOCK_DISABLED', 'FLOOR_DISABLED'].includes(errorCode || '')
              if (!isDisabledError) {
                // Generic 403 (e.g., role doesn't have /profile/ access — unlikely but safe)
                // Keep user logged in with stale data from persisted store.
                // The role-based routing will handle redirection.
              }
              // Don't redundantly logout — the api interceptor handles disabled redirects.
            }
          }
          setAuthReady(true)
        }
      }
    }

    bootstrap()

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      usePWAStore.getState().setDeferredPrompt(e as unknown as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      isMounted = false
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
  }, [logout, setUser])

  if (!authReady) {
    return <BrandedLoading fullScreen message="Authenticating..." />
  }

  return (
    <ErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <Toaster position="top-right" closeButton richColors expand={false} />
        <Suspense fallback={<BrandedLoading fullScreen message="Loading page..." />}>
          <AppContent authReady={authReady} />
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
