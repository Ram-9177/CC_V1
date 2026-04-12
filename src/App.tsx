import { Suspense, useEffect, useRef, useState } from "react";
import { safeLazy } from "@/lib/safeLazy";

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from './lib/store'
import { api, refreshAccessToken } from './lib/api'
import { canAccessPath, getRoleHome, COMMON_PATHS } from './lib/rbac'
import { useMyPermissions } from './hooks/useMyPermissions'
import type { User } from './types'
import { Toaster } from '@/components/ui/sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useOfflineProtection } from './hooks/useOfflineProtection'
import ErrorBoundary from './components/ErrorBoundary'
import { usePWAStore, type BeforeInstallPromptEvent } from '@/lib/pwa-store'
import ScrollToTop from './components/ScrollToTop'
import { useRealtimeRoleSync } from './hooks/useWebSocket'
import { BrandedLoading } from './components/common/BrandedLoading'
import NotFoundPage from './pages/NotFoundPage'

// Eager load critical routes for LCP optimization
import LoginPage from './pages/auth/LoginPage'
import DashboardLayout from './components/layout/DashboardLayout'
import Dashboard from './pages/Dashboard'

// Lazy load non-critical routes
const RequestPasswordReset = safeLazy(() => import('./pages/auth/RequestPasswordReset'))
const ResetPasswordConfirm = safeLazy(() => import('./pages/auth/ResetPasswordConfirm'))
const RoomsPage = safeLazy(() => import('./pages/RoomsPage'))
const GatePassesPage = safeLazy(() => import('./pages/GatePassesPage'))
const AttendancePage = safeLazy(() => import('./pages/AttendancePage'))
const MealsPage = safeLazy(() => import('./pages/MealsPage'))
const NoticesPage = safeLazy(() => import('./pages/NoticesPage'))
const ReportsPage = safeLazy(() => import('./pages/ReportsPage'))
const ProfilePage = safeLazy(() => import('./pages/ProfilePage'))
const EventsPage = safeLazy(() => import('./pages/EventsPage'))
const NotificationsPage = safeLazy(() => import('./pages/NotificationsPage'))
const MessagesPage = safeLazy(() => import('./pages/MessagesPage'))
const GateScansPage = safeLazy(() => import('./pages/GateScansPage'))
const CollegesPage = safeLazy(() => import('./pages/CollegesPage'))
const UsersPage = safeLazy(() => import('./pages/UsersPage'))
const MetricsPage = safeLazy(() => import('./pages/MetricsPage'))
const ComplaintsPage = safeLazy(() => import('./pages/ComplaintsPage'))
const VisitorsPage = safeLazy(() => import('./pages/admin/VisitorsPage'))
const FinesPage = safeLazy(() => import('./pages/FinesPage'))
const RoomMapping = safeLazy(() => import('./pages/admin/RoomMapping'))
const DigitalID = safeLazy(() => import('./pages/DigitalID'))
const LeavesPage = safeLazy(() => import('./pages/LeavesPage'))
const SportsDashboard = safeLazy(() => import('./pages/SportsDashboard'))
const SportsBookingPage = safeLazy(() => import('./pages/SportsBookingPage'))
const HallBookingPage = safeLazy(() => import('./pages/HallBookingPage'))
const ResumeBuilderPage = safeLazy(() => import('./pages/ResumeBuilderPage'))
const PlacementsPage = safeLazy(() => import('./pages/PlacementsPage'))
const AnalyticsPage = safeLazy(() => import('./pages/AnalyticsPage'))
const RoomRequestsPage = safeLazy(() => import('./pages/RoomRequestsPage'))
const AuditLogPage = safeLazy(() => import('./pages/AuditLogPage'))
function ProtectedRoute({ children, isSessionVerified }: { children: React.ReactNode; isSessionVerified: boolean }) {
  const { isAuthenticated } = useAuthStore()

  if (!isSessionVerified) {
    return null
  }

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
    isAllowed = canAccessPath(role, location.pathname, user?.student_type, user?.is_student_hr)
  }

  if (!isAllowed) {
    return <Navigate to={getRoleHome(role)} replace />
  }

  return <>{children}</>
}

function PublicRoute({ children, isSessionVerified, isAuthenticated, user }: { children: React.ReactNode; isSessionVerified: boolean; isAuthenticated: boolean; user: User | null }) {
  if (!isSessionVerified) {
    return null
  }

  return !isAuthenticated ? <>{children}</> : <Navigate to={getRoleHome(user?.role)} replace />
}

function AppContent({ isSessionVerified }: { isSessionVerified: boolean }) {
  useOfflineProtection()
  useRealtimeRoleSync()

  const { isAuthenticated, user } = useAuthStore()

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute isSessionVerified={isSessionVerified} isAuthenticated={isAuthenticated} user={user}>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute isSessionVerified={isSessionVerified} isAuthenticated={isAuthenticated} user={user}>
            <Navigate to="/login" replace />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute isSessionVerified={isSessionVerified} isAuthenticated={isAuthenticated} user={user}>
            <RequestPasswordReset />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password/:uid/:token"
        element={
          <PublicRoute isSessionVerified={isSessionVerified} isAuthenticated={isAuthenticated} user={user}>
            <ResetPasswordConfirm />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute isSessionVerified={isSessionVerified}>
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
        <Route path="audit-logs" element={<AuditLogPage />} />
        <Route path="metrics" element={<MetricsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="digital-id" element={<DigitalID />} />
        <Route path="leaves" element={<LeavesPage />} />
        <Route path="room-mapping" element={<RoomMapping />} />
        <Route path="sports-dashboard" element={<SportsDashboard />} />
        <Route path="sports-booking" element={<SportsBookingPage />} />
        <Route path="hall-booking" element={<HallBookingPage />} />
        <Route path="resume" element={<ResumeBuilderPage />} />
        <Route path="placements" element={<PlacementsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="room-requests" element={<RoomRequestsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function App() {
  const { user, isAuthenticated, hasHydrated, setUser, logout } = useAuthStore()
  const queryClient = useQueryClient()
  const prevUserIdRef = useRef<number | null>(null)
  const bootstrappedSessionRef = useRef(false)
  const [isSessionVerified, setIsSessionVerified] = useState(false)

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
    if (!hasHydrated) return

    if (bootstrappedSessionRef.current) {
      if (!isSessionVerified) setIsSessionVerified(true)
      return
    }
    
    bootstrappedSessionRef.current = true
    let isMounted = true

    const bootstrap = async () => {
      try {
        // Keep access token in memory only; refresh from HttpOnly cookie at startup.
        await refreshAccessToken().catch(() => undefined)

        // Treat 401/403 as “no session” without rejecting the promise (avoids axios error stack / noise).
        const profileRes = await api.get('/auth/profile/', {
          params: { _silent: true },
          validateStatus: (s) => s === 200 || s === 401 || s === 403,
        })

        if (!isMounted) return

        if (profileRes.status === 200) {
          setUser(profileRes.data as User)
          queryClient.prefetchQuery({
            queryKey: ['my-permissions', (profileRes.data as User)?.id],
            queryFn: async () => (await api.get('/auth/my-permissions/')).data,
          }).catch(() => undefined)
        } else {
          logout()
        }
      } catch (error: unknown) {
        if (isMounted && axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          logout()
        }
      } finally {
        if (isMounted) {
          setIsSessionVerified(true)
        }
      }
    }

    bootstrap()
    return () => { isMounted = false }
  }, [hasHydrated, isSessionVerified, logout, setUser, queryClient])

  return (
    <ErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[250] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-foreground focus:shadow-md"
        >
          Skip to main content
        </a>
        <ScrollToTop />
        <Toaster position="top-right" closeButton richColors expand={false} />
        <Suspense fallback={<BrandedLoading fullScreen title="Campus Core" message="Preparing your workspace..." />}>
            <AppContent isSessionVerified={isSessionVerified} />
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
