import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/context';
import { hasBackend } from './lib/config';
import type { Role } from './lib/types';
import { Toaster } from './components/ui/sonner';
import { Layout } from './components/Layout';

// Public Screens
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { LoginScreen } from './components/screens/LoginScreen';
import { RolePicker } from './components/RolePicker';

// Student Screens
import { StudentHome } from './components/screens/student/StudentHome';
import { GateDashboard } from './components/screens/student/GateDashboard';
import { CreateGatePass } from './components/screens/student/CreateGatePass';
import { GatePassDetail } from './components/screens/student/GatePassDetail';
import { AttendanceView } from './components/screens/student/AttendanceView';
import { MealsView } from './components/screens/student/MealsView';
import { NoticesView } from './components/screens/student/NoticesView';

// Gateman Screens
import { GatemanDashboard } from './components/screens/gateman/GatemanDashboard';
import { GateQueue } from './components/screens/gateman/GateQueue';
import { ScanQR } from './components/screens/gateman/ScanQR';
import { RecentEvents } from './components/screens/gateman/RecentEvents';

// Warden Screens
import { WardenDashboard } from './components/screens/warden/WardenDashboard';
import { ApprovalsScreen } from './components/screens/warden/ApprovalsScreen';
import { AttendanceManagement } from './components/screens/warden/AttendanceManagement';
import { UsersCSV } from './components/screens/warden/UsersCSV';
import { NoticesManagement } from './components/screens/warden/NoticesManagement';
import { RoomsManagement } from './components/screens/warden/RoomsManagement';

// Chef Screens
import { ChefDashboard } from './components/screens/chef/ChefDashboard';
import { MealsBoard } from './components/screens/chef/MealsBoard';
import { IntentsSummary } from './components/screens/chef/IntentsSummary';

// Admin Screens
import { AdminDashboard } from './components/screens/admin/AdminDashboard';
import { UsersManagement } from './components/screens/admin/UsersManagement';
import { ReportsScreen } from './components/screens/admin/ReportsScreen';
import { OpsScreen } from './components/screens/admin/OpsScreen';
import { Profile } from './components/screens/Profile';
import { SignupScreen } from './components/screens/SignupScreen';
import { TenantsManagement } from './components/screens/admin/TenantsManagement';
import { CollegesManagement } from './components/screens/admin/CollegesManagement';
import { FeaturesManagement } from './components/screens/admin/FeaturesManagement';

import { SetupRequired } from './components/SetupRequired';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!hasBackend()) return <SetupRequired />;
  return isAuthenticated ? <Layout>{children}</Layout> : <Navigate to="/login" />;
}

function AppRoutes() {
  const { isAuthenticated, role } = useAuth();

  const getHomePath = (r: Role | string) => {
    switch (r) {
      case 'STUDENT':
        return '/student';
      case 'GATEMAN':
        return '/gateman';
      case 'WARDEN':
        return '/warden';
      case 'WARDEN_HEAD':
        return '/warden'; // Head shares warden screens (with extra permissions)
      case 'CHEF':
        return '/chef';
      case 'SUPER_ADMIN':
        return '/admin';
      default:
        return '/';
    }
  };

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/login" element={<LoginScreen />} />
  <Route path="/signup" element={hasBackend() ? <SignupScreen /> : <Navigate to="/login" />} />
  <Route path="/role-picker" element={hasBackend() ? <Navigate to="/login" /> : <RolePicker />} />

      {/* Student Routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute>
            <StudentHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/gate-pass"
        element={
          <ProtectedRoute>
            <GateDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/gate-pass/create"
        element={
          <ProtectedRoute>
            <CreateGatePass />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/gate-pass/:id"
        element={
          <ProtectedRoute>
            <GatePassDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/attendance"
        element={
          <ProtectedRoute>
            <AttendanceView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/meals"
        element={
          <ProtectedRoute>
            <MealsView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/notices"
        element={
          <ProtectedRoute>
            <NoticesView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Gateman Routes */}
      <Route
        path="/gateman"
        element={
          <ProtectedRoute>
            <GatemanDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gateman/queue"
        element={
          <ProtectedRoute>
            <GateQueue />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gateman/scan"
        element={
          <ProtectedRoute>
            <ScanQR />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gateman/events"
        element={
          <ProtectedRoute>
            <RecentEvents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gateman/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gateman/rooms"
        element={
          <ProtectedRoute>
            <RoomsManagement />
          </ProtectedRoute>
        }
      />

      {/* Warden Routes */}
      <Route
        path="/warden"
        element={
          <ProtectedRoute>
            <WardenDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/warden-head"
        element={
          <ProtectedRoute>
            <WardenDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/warden/approvals"
        element={
          <ProtectedRoute>
            <ApprovalsScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/warden/attendance"
        element={
          <ProtectedRoute>
            <AttendanceManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/warden/users"
        element={
          <ProtectedRoute>
            <UsersCSV />
          </ProtectedRoute>
        }
      />
      <Route
        path="/warden/notices"
        element={
          <ProtectedRoute>
            <NoticesManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/warden/rooms"
        element={
          <ProtectedRoute>
            <RoomsManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/warden/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Chef Routes */}
      <Route
        path="/chef"
        element={
          <ProtectedRoute>
            <ChefDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chef/meals"
        element={
          <ProtectedRoute>
            <MealsBoard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chef/intents"
        element={
          <ProtectedRoute>
            <IntentsSummary />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chef/users"
        element={
          <ProtectedRoute>
            <UsersCSV />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chef/notices"
        element={
          <ProtectedRoute>
            <NoticesManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chef/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <UsersManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute>
            <ReportsScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/ops"
        element={
          <ProtectedRoute>
            <OpsScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/tenants"
        element={
          <ProtectedRoute>
            <TenantsManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/colleges"
        element={
          <ProtectedRoute>
            <CollegesManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/features"
        element={
          <ProtectedRoute>
            <FeaturesManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/notices"
        element={
          <ProtectedRoute>
            <NoticesManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/rooms"
        element={
          <ProtectedRoute>
            <RoomsManagement />
          </ProtectedRoute>
        }
      />

      {/* Redirect based on role */}
      <Route
        path="*"
        element={
          isAuthenticated ? (
            <Navigate to={getHomePath(role)} />
          ) : (
            <Navigate to="/" />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppRoutes />
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  );
}
