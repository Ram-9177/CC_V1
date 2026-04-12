import { safeLazy } from "@/lib/safeLazy";

import { Suspense, useMemo, useCallback, memo, useState, useEffect, type ElementType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Home, ClipboardCheck, FileText, Activity, Bell, AlertTriangle, Utensils, CheckCircle2, Calendar, ClipboardList } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Link } from 'react-router-dom';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { isTopLevelManagement, canAccessPath } from '@/lib/rbac';
import { SEO } from '@/components/common/SEO';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Role-specific dashboards — lazy so each splits into its own chunk.
// Only one is ever rendered per session, so the rest never load.
// Eager trigger the module imports to kill sequential Suspense waterfalls 
// while keeping the safeLazy error-catching protection as requested in system architecture discussions
const chefPromise = import('@/components/dashboard/ChefDashboard').then(m => ({ default: m.ChefDashboard }));
const WardenPromise = import('@/components/dashboard/WardenDashboard').then(m => ({ default: m.WardenDashboard }));
const GatePromise = import('@/components/dashboard/GateSecurityDashboard').then(m => ({ default: m.GateSecurityDashboard }));
const SecurityHeadPromise = import('@/components/dashboard/SecurityHeadDashboard').then(m => ({ default: m.SecurityHeadDashboard }));

const ChefDashboard         = safeLazy(() => chefPromise);
const WardenDashboard       = safeLazy(() => WardenPromise);
const GateSecurityDashboard = safeLazy(() => GatePromise);
const SecurityHeadDashboard = safeLazy(() => SecurityHeadPromise);

// Eager load the factory for the primary dashboard so the chunk starts downloading immediately, killing the waterfall delay
const studentDashboardPromise = import('@/components/dashboard/StudentDashboard').then(m => ({ default: m.StudentDashboard }));
const StudentDashboard      = safeLazy(() => studentDashboardPromise);
import type { User, Fine } from '@/types';


interface DashboardStats {
  scope_college_id?: number | null;
  scope_college_name?: string;
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

interface CollegeOption {
  id: number;
  name: string;
}

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const [selectedCollege, setSelectedCollege] = useState<string>('all');

  const { data: colleges = [] } = useQuery<CollegeOption[]>({
    queryKey: ['colleges'],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const response = await api.get('/colleges/colleges/');
      return response.data.results || response.data;
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (!colleges.length) return;
    setSelectedCollege((current) => {
      if (current === 'all') return current;
      return colleges.some((c) => c.id.toString() === current) ? current : 'all';
    });
  }, [isSuperAdmin, colleges]);
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
      { label: 'Mark Attendance', to: '/attendance', icon: ClipboardCheck },
      { label: 'Create Gate Pass', to: '/gate-passes', icon: FileText },
      { label: 'View Notices', to: '/notices', icon: Bell },
      { label: 'System Analytics', to: '/analytics', icon: Activity },
    ];
    
    // Custom logic for additional actions
    if (isTopLevelManagement(user?.role)) {
       actions.push({ label: 'Manage Rooms', to: '/rooms', icon: Home });
    }
    
    if (user?.is_student_hr) {
        actions.push({ label: 'Support Desk', to: '/complaints', icon: AlertTriangle });
    }

    // RBAC: Filter only allowed actions based on user role and configuration
    return actions.filter(action => canAccessPath(user?.role, action.to, user?.student_type, user?.is_student_hr));
  }, [user]);

  // Early returns for specific roles (AFTER hooks)
  if (user?.role === 'chef' || user?.role === 'head_chef') {
      return (
        <div className="w-full space-y-3 sm:space-y-4">
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
        <div className="w-full space-y-3 sm:space-y-4">
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
        <div className="w-full space-y-3 sm:space-y-4">
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
        <div className="page-frame pb-6">
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
        <div className="page-frame pb-6">
            <SEO title="Student Portal" description="Access your digital hostel profile, gate passes, and notices." />
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">Welcome, {user?.first_name || user?.username}</h1>
            </div>
            <Suspense fallback={<PageSkeleton variant="dashboard" />}><StudentDashboard /></Suspense>
        </div>
      );
  }

  return (
    <AdminDashboard
      user={user}
      quickActions={quickActions}
      getActivityIcon={getActivityIcon}
      getActivityColor={getActivityColor}
      selectedCollege={selectedCollege}
      onSelectedCollegeChange={setSelectedCollege}
      colleges={colleges}
    />
  );
}

interface AdminDashboardProps {
  user: User | null;
  quickActions: Array<{
    label: string;
    to: string;
    icon: ElementType;
  }>;
  getActivityIcon: (type: string) => ElementType;
  getActivityColor: (type: string) => string;
  selectedCollege: string;
  onSelectedCollegeChange: (value: string) => void;
  colleges: CollegeOption[];
}

const AdminDashboard = memo(function AdminDashboard({
  user,
  quickActions,
  getActivityIcon,
  getActivityColor,
  selectedCollege,
  onSelectedCollegeChange,
  colleges,
}: AdminDashboardProps) {
  const isSuperAdmin = user?.role === 'super_admin';
  const collegeParam = isSuperAdmin && selectedCollege !== 'all' ? { college_id: selectedCollege } : undefined;
  const selectedCollegeLabel = selectedCollege === 'all'
    ? 'All Colleges'
    : colleges.find((c) => c.id.toString() === selectedCollege)?.name || 'Selected College';

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', selectedCollege],
    queryFn: async () => {
      const response = await api.get('/metrics/dashboard/', { params: collegeParam });
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: false,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<RecentActivity[]>({
    queryKey: ['recent-activities', selectedCollege],
    queryFn: async () => {
      const response = await api.get('/metrics/activities/', { params: collegeParam });
      return response.data.results || response.data;
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: false,
  });

  // Real-time updates for dashboard (single subscription reduces listener churn)
  useRealtimeQuery(
    [
      'gatepass_created',
      'gatepass_updated',
      'gate_scan_logged',
      'attendance_updated',
      'leave_created',
      'leave_updated',
      'leave_approved',
      'leave_rejected',
    ],
    ['dashboard-stats', 'recent-activities']
  );
  useRealtimeQuery('notice_created', 'recent-activities');
  useRealtimeQuery(['room_updated', 'room_allocated', 'room_deallocated'], 'dashboard-stats');

  const statCards = useMemo(() => {
    const cards = [
      {
        title: 'Total Students',
        value: stats?.total_students || 0,
        icon: Users,
        path: '/tenants'
      },
      {
        title: 'Active Rooms',
        value: stats?.active_rooms || 0,
        icon: Home,
        path: '/rooms'
      },
      {
        title: 'Pending Requests',
        value: stats?.pending_requests || 0,
        icon: ClipboardList,
        path: '/gate-passes'
      },
      {
        title: 'Closed Tickets',
        value: stats?.closed_tickets || 0,
        icon: CheckCircle2,
        path: '/complaints'
      },
      {
        title: 'Events Created',
        value: stats?.events_created || 0,
        icon: Calendar,
        path: '/events'
      },
      {
        title: 'Notices Sent',
        value: stats?.notices_sent || 0,
        icon: Bell,
        path: '/notices'
      },
    ];

    return cards.filter(card => canAccessPath(user?.role, card.path, user?.student_type, user?.is_student_hr));
  }, [stats, user]);

  const showStatsSkeleton = statsLoading && !stats;
  const showActivitiesSkeleton = activitiesLoading && !activities;

  const quickActionsGridClass = getQuickActionsGridClass(quickActions.length);

  return (
    <div className="page-frame pb-6">
      <SEO title="Admin Console" description="Centralized administrative dashboard for SMG CampusCore operations." />
      <div className="flex flex-col gap-2">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-lead">
          Welcome back, {user?.name || user?.hall_ticket || user?.username}
        </p>
        {isSuperAdmin && (
          <Badge variant="outline" className="w-fit">
            Scope: {selectedCollegeLabel}
          </Badge>
        )}
      </div>

      {user?.role === 'super_admin' && (
        <Card className="rounded-lg border border-border bg-card shadow-sm">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Platform operator</p>
              <p className="text-xs text-muted-foreground">
                Tenant lifecycle, subscriptions, and cross-college visibility live under Colleges. Dashboard totals below are platform-wide (cached).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedCollege} onValueChange={onSelectedCollegeChange}>
                <SelectTrigger className="w-[220px] bg-white">
                  <SelectValue placeholder="All Colleges" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colleges</SelectItem>
                  {colleges.map((college) => (
                    <SelectItem key={college.id} value={college.id.toString()}>
                      {college.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button asChild variant="default" size="sm" className="shrink-0">
                <Link to={selectedCollege === 'all' ? '/tenants' : `/tenants?college=${selectedCollege}`}>Open Tenants</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Quick Actions — grid follows item count; rows stay balanced on common breakpoints */}
      <div className="rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border/60 px-4 py-3 sm:px-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Quick actions
          </h2>
        </div>
        <div className="p-3 sm:p-4">
          <div className={cn('grid gap-2.5 sm:gap-3', quickActionsGridClass)}>
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={`${action.to}-${index}`}
                  variant="ghost"
                  asChild
                  className="h-auto w-full justify-start rounded-xl border border-border/80 bg-card p-0 shadow-none transition-colors hover:bg-muted/70 hover:border-border dark:bg-card dark:hover:bg-muted/40"
                >
                  <Link
                    to={action.to}
                    className="flex w-full min-h-[3.25rem] items-center gap-3 px-3.5 py-3 sm:min-h-[3.5rem] sm:px-4 sm:py-3.5"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.65rem] bg-muted text-foreground dark:bg-muted/80"
                      aria-hidden
                    >
                      <Icon className="h-[1.35rem] w-[1.35rem] shrink-0 text-foreground" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1 text-left text-sm font-medium leading-snug text-foreground">
                      {action.label}
                    </span>
                  </Link>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <Card className="rounded-lg border border-border bg-card shadow-sm">
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


/** Responsive columns so quick actions stay aligned (e.g. five items → 3+2, then one row on xl). */
function getQuickActionsGridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 min-[480px]:grid-cols-2'
  if (count === 3) return 'grid-cols-1 min-[480px]:grid-cols-3'
  if (count === 4) return 'grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4'
  if (count === 5) return 'grid-cols-1 min-[640px]:grid-cols-3 xl:grid-cols-5'
  return 'grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]'
}

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
    <div className="mb-6 rounded-xl border border-border bg-card shadow-sm overflow-hidden group/alert">
      <div className="p-4 flex items-center justify-between relative">
        <div className="absolute inset-0 bg-primary/5 translate-x-[-100%] group-hover/alert:translate-x-0 transition-transform duration-700"></div>
        <div className="relative flex items-center gap-4">
          <div className="p-2.5 bg-rose-50 rounded-lg text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="font-black text-primary text-xl">Outstanding Fines: <span className="text-foreground">₹{totalFineAmount}</span></p>
            <p className="text-xs text-muted-foreground font-medium">Please clear your dues to avoid administrative restrictions.</p>
          </div>
        </div>
        <Button className="relative bg-primary hover:bg-primary/90 text-white font-black shadow-sm smooth-transition rounded-sm active:scale-95 px-6 uppercase tracking-widest text-[10px]" size="sm" asChild>
          <Link to="/fines">Pay Now</Link>
        </Button>
      </div>
    </div>
  );
}
 
interface StatCardProps {
  title: string;
  value: number;
  icon: ElementType;
}

const StatCard = memo(function StatCard({ title, value, icon: Icon }: StatCardProps) {
  return (
    <Card className="rounded-xl border border-border bg-card shadow-sm group overflow-hidden transition-all">
      <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full bg-primary/0 transition-colors duration-500 group-hover:bg-primary/[0.06]" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10 px-5 pt-5">
        <CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
          {title}
        </CardTitle>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/70 text-primary transition-colors duration-300 group-hover:bg-primary/10 group-hover:border-primary/20">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      </CardHeader>
      <CardContent className="relative z-10 px-5 pb-5">
        <div className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mt-1">
          {value}
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
