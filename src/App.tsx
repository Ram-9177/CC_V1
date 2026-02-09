import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './lib/store'
import { api, refreshAccessToken } from './lib/api'
import { isTokenExpired } from './lib/auth'
import { canAccessPath, getRoleHome } from './lib/rbac'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import RequestPasswordReset from './pages/auth/RequestPasswordReset'
import ResetPasswordConfirm from './pages/auth/ResetPasswordConfirm'
import DashboardLayout from './components/layout/DashboardLayout'
import Dashboard from './pages/Dashboard'
import RoomsPage from './pages/RoomsPage'
import GatePassesPage from './pages/GatePassesPage'
import AttendancePage from './pages/AttendancePage'
import MealsPage from './pages/MealsPage'
import NoticesPage from './pages/NoticesPage'
import ReportsPage from './pages/ReportsPage'
import ProfilePage from './pages/ProfilePage'
import EventsPage from './pages/EventsPage'
import NotificationsPage from './pages/NotificationsPage'
import MessagesPage from './pages/MessagesPage'
import GateScansPage from './pages/GateScansPage'
import CollegesPage from './pages/CollegesPage'
import UsersPage from './pages/UsersPage'
import MetricsPage from './pages/MetricsPage'
import ComplaintsPage from './pages/ComplaintsPage'
import VisitorsPage from './pages/admin/VisitorsPage'
import FinesPage from './pages/FinesPage'
import RoomMapping from './pages/admin/RoomMapping'
import DigitalID from './pages/DigitalID'
import { Toaster } from '@/components/ui/sonner'

function ProtectedRoute({ children, authReady }: { children: React.ReactNode; authReady: boolean }) {
  const { isAuthenticated } = useAuthStore()
  if (!authReady) return null
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function RoleProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const role = user?.role ?? null
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

function App() {
  const { user, token, setUser, setToken, logout } = useAuthStore()
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    let isMounted = true
    const accessToken = localStorage.getItem('access_token')
    const refreshToken = localStorage.getItem('refresh_token')

    if (!accessToken) {
      if (isMounted) setAuthReady(true)
      return
    }

    const ensureFreshToken = async () => {
      if (!isTokenExpired(accessToken)) return accessToken
      if (!refreshToken) return null

      try {
        const data = await refreshAccessToken(refreshToken)
        localStorage.setItem('access_token', data.access)
        if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
        return data.access
      } catch {
        return null
      }
    }

    const bootstrap = async () => {
      const freshToken = await ensureFreshToken()
      if (!freshToken) {
        logout()
        if (isMounted) setAuthReady(true)
        return
      }

      if (!token) {
        setToken(freshToken)
      } else if (token !== freshToken) {
        setToken(freshToken)
      }

      if (user) {
        if (isMounted) setAuthReady(true)
        return
      }

      api
        .get('/profile/')
        .then((response) => {
          if (isMounted) setUser(response.data)
        })
        .catch(() => {
          logout()
        })
        .finally(() => {
          if (isMounted) setAuthReady(true)
        })
    }

    bootstrap()

    return () => {
      isMounted = false
    }
  }, [logout, setToken, setUser, token, user])

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster />
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
          <Route path="room-mapping" element={<RoomMapping />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
