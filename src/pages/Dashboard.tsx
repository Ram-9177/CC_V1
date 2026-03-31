import React, { lazy, Suspense, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Home, ClipboardCheck, FileText, Activity, Bell, AlertTriangle, Utensils, CheckCircle2, Calendar, ClipboardList } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Link } from 'react-router-dom';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { isTopLevelManagement } from '@/lib/rbac';
import { SEO } from '@/components/common/SEO';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Role-specific dashboards — lazy so each splits into its own chunk.
// Only one is ever rendered per session, so the rest never load.
const ChefDashboard         = lazy(() => import('@/components/dashboard/ChefDashboard').then(m => ({ default: m.ChefDashboard })));
const WardenDashboard       = lazy(() => import('@/components/dashboard/WardenDashboard').then(m => ({ default: m.WardenDashboard })));
const GateSecurityDashboard = lazy(() => import('@/components/dashboard/GateSecurityDashboard').then(m => ({ default: m.GateSecurityDashboard })));
const SecurityHeadDashboard = lazy(() => import('@/components/dashboard/SecurityHeadDashboard').then(m => ({ default: m.SecurityHeadDashboard })));
const StudentDashboard      = lazy(() => import('@/components/dashboard/StudentDashboard').then(m => ({ default: m.StudentDashboard })));
import type { User, Fine } from '@/types';


interface DashboardStats {
  total_students: number;
  total_rooms: number;
  active_rooms: number;
  pending_requests: number;
  closed_tickets: number;
  events_created: number;
  notices_sent: number;
  today_attendance: number;
  total_attendance: number;
}


interface RecentActivity {
  id: number;
  type: string;
  description: string;
  timestamp: string;
  user: string;
}

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const getActivityIcon = useCallback((type: string) => {
    switch (type) {
      case 'gate_pass':
        return FileText;
      case 'attendance':
        return ClipboardCheck;
      case 'notice':
        return Bell;
      case 'special_request':
        return Utensils;
      default:
        return Activity;
    }
  }, []);

  const getActivityColor = useCallback((type: string) => {
    switch (type) {
      case 'gate_pass':
        return 'bg-primary text-foreground';
      case 'attendance':
        return 'bg-secondary text-foreground';
      case 'notice':
        return 'bg-black text-white';
      case 'special_request':
        return 'bg-purple-500 text-white';
      default:
        return 'bg-muted text-foreground';
    }
  }, []);


  const quickActions = useMemo(() => {
    const actions = [
      { label: 'Mark Attendance', to: '/attendance', icon: ClipboardCheck, color: 'text-foreground' },
      { label: 'Create Gate Pass', to: '/gate-passes', icon: FileText, color: 'text-foreground' },
      { label: 'View Notices', to: '/notices', icon: Bell, color: 'text-foreground' },
    ];
    
    // Student HR / Admin Actions
    if (isTopLevelManagement(user?.role) || user?.is_student_hr) {
        if (isTopLevelManagement(user?.role)) {
            actions.push({ label: 'Manage Rooms', to: '/rooms', icon: Home, color: 'text-foreground' });
        }
        
        // Student HR specific actions if not already there
        if (user?.is_student_hr) {
            actions.push({ label: 'Manage Notices', to: '/notices', icon: Bell, color: 'text-foreground' });
            actions.push({ label: 'Track Complaints', to: '/complaints', icon: AlertTriangle, color: 'text-foreground' });
        }
    }
    return actions;
  }, [user?.role, user?.is_student_hr]);

  // Early returns for specific roles (AFTER hooks)
  if (user?.role === 'chef' || user?.role === 'head_chef') {
      return (
        <div className="w-full space-y-3 sm:space-y-4 md:space-y-6">
            <SEO title="Chef Management Panel" description="Manage meal forecasting and attendance for the SMG CampusCore dining hall." />
            <div className="flex flex-col gap-1 sm:gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Welcome, {user?.first_name || user?.username}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  Operational Oversight • Dining & Meal Forecasting
                </p>
            </div>
            <Suspense fallback={<PageSkeleton variant="dashboard" />}><ChefDashboard /></Suspense>
        </div>
      );
  }

  if (user?.role === 'warden' || user?.role === 'head_warden') {
      return (
        <div className="w-full space-y-3 sm:space-y-4 md:space-y-6">
            <SEO title="Warden Dashboard" description="Oversee hostel block operations, attendance, and student gate passes." />
            <div className="flex flex-col gap-1 sm:gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Welcome, {user?.first_name || user?.username}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  Hostel Management • Student Welfare & Attendance
                </p>
            </div>
            <Suspense fallback={<PageSkeleton variant="dashboard" />}><WardenDashboard /></Suspense>
        </div>
      );
  }

  if (user?.role === 'gate_security') {
      return (
        <div className="w-full space-y-3 sm:space-y-4 md:space-y-6">
            <SEO title="Gate Security Log" description="Monitor and log student entries and exits at the main gate." />
            <div className="flex flex-col gap-1 sm:gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Welcome, {user?.first_name || user?.username}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  Security Log • Shift: {new Date().getHours() < 12 ? 'Morning' : 'Evening'}
                </p>
            </div>
            <Suspense fallback={<PageSkeleton variant="dashboard" />}><GateSecurityDashboard /></Suspense>
        </div>
      );
  }

  if (user?.role === 'security_head') {
      return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            <SEO title="Security Head Authority" description="Comprehensive security oversight across all SMG CampusCore blocks." />
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">Welcome, {user?.first_name || user?.username}</h1>
                <p className="text-muted-foreground font-medium">
                  All-Campus Security Authority
                </p>
            </div>
            <Suspense fallback={<PageSkeleton variant="dashboard" />}><SecurityHeadDashboard /></Suspense>
        </div>
      );
  }

  if (user?.role === 'student') {
      return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            <SEO title="Student Portal" description="Access your digital hostel profile, gate passes, and notices." />
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">Welcome, {user?.first_name || user?.username}</h1>
            </div>
            <Suspense fallback={<PageSkeleton variant="dashboard" />}><StudentDashboard /></Suspense>
        </div>
      );
  }

  return <AdminDashboard user={user} quickActions={quickActions} getActivityIcon={getActivityIcon} getActivityColor={getActivityColor} />;
}

interface AdminDashboardProps {
  user: User | null;
  quickActions: Array<{
    label: string;
    to: string;
    icon: React.ElementType;
    color: string;
  }>;
  getActivityIcon: (type: string) => React.ElementType;
  getActivityColor: (type: string) => string;
}

const AdminDashboard = React.memo(function AdminDashboard({ user, quickActions, getActivityIcon, getActivityColor }: AdminDashboardProps) {

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/metrics/dashboard/');
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: false,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<RecentActivity[]>({
    queryKey: ['recent-activities'],
    queryFn: async () => {
      const response = await api.get('/metrics/activities/');
      return response.data.results || response.data;
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: false,
  });

  // Real-time updates for dashboard
  useRealtimeQuery('gatepass_created', ['dashboard-stats', 'recent-activities']);
  useRealtimeQuery('gatepass_updated', ['dashboard-stats', 'recent-activities']);
  useRealtimeQuery('gate_scan_logged', ['dashboard-stats', 'recent-activities']);
  useRealtimeQuery('attendance_updated', ['dashboard-stats', 'recent-activities']);
  useRealtimeQuery('notice_created', 'recent-activities');
  useRealtimeQuery('room_updated', 'dashboard-stats');
  useRealtimeQuery('room_allocated', 'dashboard-stats');
  useRealtimeQuery('room_deallocated', 'dashboard-stats');
  useRealtimeQuery('leave_created', ['dashboard-stats', 'recent-activities']);
  useRealtimeQuery('leave_updated', ['dashboard-stats', 'recent-activities']);
  useRealtimeQuery('leave_approved', ['dashboard-stats', 'recent-activities']);
  useRealtimeQuery('leave_rejected', ['dashboard-stats', 'recent-activities']);

  const statCards = useMemo(() => [
    {
      title: 'Total Students',
      value: stats?.total_students || 0,
      icon: Users,
      color: 'text-foreground',
      bgColor: 'bg-primary',
    },
    {
      title: 'Active Rooms',
      value: stats?.active_rooms || 0,
      icon: Home,
      color: 'text-foreground',
      bgColor: 'bg-secondary',
    },
    {
      title: 'Pending Requests',
      value: stats?.pending_requests || 0,
      icon: ClipboardList,
      color: 'text-white',
      bgColor: 'bg-black',
    },
    {
      title: 'Closed Tickets',
      value: stats?.closed_tickets || 0,
      icon: CheckCircle2,
      color: 'text-foreground',
      bgColor: 'bg-primary/50',
    },
    {
      title: 'Events Created',
      value: stats?.events_created || 0,
      icon: Calendar,
      color: 'text-white',
      bgColor: 'bg-primary',
    },
    {
      title: 'Notices Sent',
      value: stats?.notices_sent || 0,
      icon: Bell,
      color: 'text-foreground',
      bgColor: 'bg-secondary',
    },
  ], [stats]);

  const showStatsSkeleton = statsLoading && !stats;
  const showActivitiesSkeleton = activitiesLoading && !activities;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <SEO title="Admin Console" description="Centralized administrative dashboard for SMG CampusCore operations." />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-black font-medium">
          Welcome back, {user?.name || user?.hall_ticket || user?.username}
        </p>
      </div>

      {/* Outstanding Fines Alert */}
      <OutstandingFinesAlert user={user} />
      
      {showStatsSkeleton ? (
        <PageSkeleton variant="dashboard" className="pt-2" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <Card className="premium-card bg-black border-black shadow-2xl overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <CardHeader className="relative z-10 border-b border-white/5 bg-white/5">
          <CardTitle className="text-white text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <div className="h-2 w-2 rounded-sm bg-primary animate-pulse"></div>
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Link key={index} to={action.to} className="block">
                  <Button
                    variant="ghost"
                    className="w-full h-auto py-6 flex flex-col items-center gap-3 rounded-sm bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/50 transition-all duration-300 group/btn"
                  >
                    <div className="p-3 bg-primary/10 rounded-sm group-hover/btn:bg-primary/20 group-hover/btn:scale-110 group-hover/btn:rotate-3 transition-all">
                      <Icon className="h-6 w-6 text-primary primary-glow" />
                    </div>
                    <span className="text-[10px] text-center font-black uppercase tracking-wider text-white/80 group-hover/btn:text-white">{action.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {activitiesLoading ? (
            showActivitiesSkeleton ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-start gap-4 pb-4 border-b last:border-0">
                    <Skeleton className="h-10 w-10 rounded-sm" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-sm" />
                  </div>
                ))}
              </div>
            ) : null
          ) : activities && activities.length > 0 ? (
            <div className="space-y-4">
              {activities.slice(0, 10).map((activity) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 pb-4 border-b last:border-0 hover:bg-gray-50/50 transition-colors duration-200"
                  >
                    <div className={`p-2.5 rounded-sm ${getActivityColor(activity.type)} shadow-sm`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-bold leading-none text-black">
                        {activity.description}
                      </p>
                      <p className="text-[10px] font-medium text-black/60 uppercase tracking-tight">
                        {activity.user} • {formatRelativeTime(activity.timestamp)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter border-black/10 bg-black/5">
                      {activity.type.replace('_', ' ')}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No Recent Activities"
              description="Activity logs will appear here as users interact with the system"
              variant="info"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
});


function OutstandingFinesAlert({ user }: { user: User | null }) {
  const { data: fines } = useQuery<Fine[]>({
    queryKey: ['disciplinary-fines-alert'],
    queryFn: async () => {
      const response = await api.get('/disciplinary/');
      return response.data.results || response.data;
    },
    enabled: !!user && user.role === 'student', // Only check for students
  });
 
  const unpaidFines = fines?.filter((f) => !f.is_paid && parseFloat(String(f.fine_amount)) > 0) || [];
  const totalFineAmount = unpaidFines.reduce((sum: number, f) => sum + parseFloat(String(f.fine_amount)), 0);
 
  if (!totalFineAmount) return null;
 
  return (
    <Card className="bg-black border-0 mb-6 shadow-xl overflow-hidden group/alert">
      <CardContent className="p-4 flex items-center justify-between relative">
        <div className="absolute inset-0 bg-primary/5 translate-x-[-100%] group-hover/alert:translate-x-0 transition-transform duration-700"></div>
        <div className="relative flex items-center gap-4">
          <div className="p-2.5 bg-primary/20 rounded-sm text-primary animate-bounce">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="font-black text-primary text-xl">Outstanding Fines: <span className="text-white">₹{totalFineAmount}</span></p>
            <p className="text-xs text-white/70 font-medium">Please clear your dues to avoid administrative restrictions.</p>
          </div>
        </div>
        <Button className="relative bg-primary hover:bg-primary/90 text-white font-black shadow-lg shadow-primary/30 hover:shadow-primary/50 smooth-transition rounded-sm active:scale-95 px-6 uppercase tracking-widest text-[10px]" size="sm" asChild>
          <Link to="/fines">Pay Now</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
 
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const StatCard = React.memo(function StatCard({ title, value, icon: Icon, color, bgColor }: StatCardProps) {
  return (
    <Card className="premium-card bouncy-hover group overflow-hidden border-0 bg-white/40 backdrop-blur-md">
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-sm opacity-10 transition-all duration-500 group-hover:scale-150 ${bgColor}`}></div>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-black">
          {title}
        </CardTitle>
        <div className={`p-2.5 rounded-sm ${bgColor} shadow-lg shadow-black/5 flex items-center justify-center transition-transform duration-300 group-hover:rotate-12`}>
          <Icon className={`h-5 w-5 ${color} primary-glow`} />
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-3xl font-black text-foreground tracking-tight">
          {value}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="h-1 w-8 rounded-sm bg-primary/20 group-hover:w-full transition-all duration-500"></div>
          <p className="text-[10px] font-bold text-black uppercase">Live</p>
        </div>
      </CardContent>
    </Card>
  );
});

function formatRelativeTime(timestamp: string) {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
