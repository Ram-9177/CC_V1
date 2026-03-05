import { useQuery } from '@tanstack/react-query';
import { Users, Home, ClipboardCheck, FileText, Activity, Bell, AlertTriangle, Utensils } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Link } from 'react-router-dom';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { isTopLevelManagement } from '@/lib/rbac';
import { ChefDashboard } from '@/components/dashboard/ChefDashboard';
import { WardenDashboard } from '@/components/dashboard/WardenDashboard';
import { GateSecurityDashboard } from '@/components/dashboard/GateSecurityDashboard';
import { SecurityHeadDashboard } from '@/components/dashboard/SecurityHeadDashboard';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
import { SEO } from '@/components/common/SEO';
import type { User, Fine } from '@/types';


interface DashboardStats {
  total_students: number;
  total_rooms: number;
  occupied_rooms: number;
  pending_gate_passes: number;
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

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/metrics/dashboard/');
      return response.data;
    },
    // Only run for management roles
    enabled: ['admin', 'super_admin', 'warden', 'head_warden', 'gate_security', 'security_head', 'chef', 'head_chef'].includes(user?.role || ''),
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<RecentActivity[]>({
    queryKey: ['recent-activities'],
    queryFn: async () => {
      const response = await api.get('/metrics/activities/');
      return response.data.results || response.data;
    },
    // Only run for management roles
    enabled: ['admin', 'super_admin', 'warden', 'head_warden', 'gate_security', 'security_head', 'chef', 'head_chef'].includes(user?.role || ''),
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
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
  
  // Real-time for leaves
  useRealtimeQuery('leave_created', ['dashboard-stats', 'recent-activities']);
  useRealtimeQuery('leave_updated', ['dashboard-stats', 'recent-activities']);
  useRealtimeQuery('leave_approved', ['dashboard-stats', 'recent-activities']);
  useRealtimeQuery('leave_rejected', ['dashboard-stats', 'recent-activities']);
  
  if (user?.role === 'chef' || user?.role === 'head_chef') {
      return (
        <div className="w-full space-y-3 sm:space-y-4 md:space-y-6">
            <SEO title="Chef Management Panel" description="Manage meal forecasting and attendance for the SMG Hostel dining hall." />
            <div className="flex flex-col gap-1 sm:gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Welcome, {user?.first_name || user?.username}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                Welcome back, {user?.first_name || user?.username}
                </p>
            </div>
            <ChefDashboard />
        </div>
      );
  }

  if (user?.role === 'warden' || user?.role === 'head_warden') {
      return (
        <div className="w-full space-y-3 sm:space-y-4 md:space-y-6">
            <SEO title="Warden Dashboard" description="Oversee hostel block operations, attendance, and student gate passes." />
            <div className="flex flex-col gap-1 sm:gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Welcome, {user?.first_name || user?.username}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                Welcome back, {user?.first_name || user?.username}
                </p>
            </div>
            <WardenDashboard />
        </div>
      );
  }

  if (user?.role === 'gate_security') {
      return (
        <div className="w-full space-y-3 sm:space-y-4 md:space-y-6">
            <SEO title="Gate Security Log" description="Monitor and log student entries and exits at the main gate." />
            <div className="flex flex-col gap-1 sm:gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Welcome, {user?.first_name || user?.username}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                Monitoring: Main Gate • Shift: {new Date().getHours() < 12 ? 'Morning' : 'Evening'}
                </p>
            </div>
            <GateSecurityDashboard />
        </div>
      );
  }

  if (user?.role === 'security_head') {
      return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            <SEO title="Security Head Authority" description="Comprehensive security oversight across all SMG Hostel blocks." />
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">Welcome, {user?.first_name || user?.username}</h1>
                <p className="text-muted-foreground">
                All-Campus Authority Dashboard
                </p>
            </div>
            <SecurityHeadDashboard />
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
            <StudentDashboard />
        </div>
      );
  }

  const statCards = [
    {
      title: 'Total Students',
      value: stats?.total_students || 0,
      icon: Users,
      color: 'text-foreground',
      bgColor: 'bg-primary',
    },
    {
      title: 'Total Rooms',
      value: `${stats?.occupied_rooms || 0}/${stats?.total_rooms || 0}`,
      icon: Home,
      color: 'text-foreground',
      bgColor: 'bg-secondary',
    },
    {
      title: 'Pending Gate Passes',
      value: stats?.pending_gate_passes || 0,
      icon: ClipboardCheck,
      color: 'text-white',
      bgColor: 'bg-black',
    },
    {
      title: "Today's Attendance",
      value: `${stats?.today_attendance || 0}/${stats?.total_attendance || 0}`,
      icon: FileText,
      color: 'text-foreground',
      bgColor: 'bg-primary/50',
    },
  ];

  const quickActions = [
    { label: 'Mark Attendance', to: '/attendance', icon: ClipboardCheck, color: 'text-foreground' },
    { label: 'Create Gate Pass', to: '/gate-passes', icon: FileText, color: 'text-foreground' },
    { label: 'View Notices', to: '/notices', icon: Bell, color: 'text-foreground' },
  ];
  
  // Student HR / Admin Actions
  if (isTopLevelManagement(user?.role) || user?.is_student_hr) {
      if (isTopLevelManagement(user?.role)) {
          quickActions.push({ label: 'Manage Rooms', to: '/rooms', icon: Home, color: 'text-foreground' });
      }
      
      // Student HR specific actions if not already there
      if (user?.is_student_hr) {
          quickActions.push({ label: 'Manage Notices', to: '/notices', icon: Bell, color: 'text-foreground' });
          quickActions.push({ label: 'Track Complaints', to: '/complaints', icon: AlertTriangle, color: 'text-foreground' });
      }
  }

  const getActivityIcon = (type: string) => {
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
  };

  const getActivityColor = (type: string) => {
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
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <SEO title="Admin Console" description="Centralized administrative dashboard for SMG Hostel operations." />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-black font-medium">
          Welcome back, {user?.name || user?.hall_ticket || user?.username}
        </p>
      </div>

      {/* Outstanding Fines Alert */}
      <OutstandingFinesAlert user={user} />
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="premium-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-12 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-20 mb-2" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="premium-card bouncy-hover group overflow-hidden border-0 bg-white/40 backdrop-blur-md">
                <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 transition-all duration-500 group-hover:scale-150 ${stat.bgColor}`}></div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-black">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2.5 rounded-xl ${stat.bgColor} shadow-lg shadow-black/5 flex items-center justify-center transition-transform duration-300 group-hover:rotate-12`}>
                    <Icon className={`h-5 w-5 ${stat.color} primary-glow`} />
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="text-3xl font-black text-foreground tracking-tight">
                    {stat.value}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1 w-8 rounded-full bg-primary/20 group-hover:w-full transition-all duration-500"></div>
                    <p className="text-[10px] font-bold text-black uppercase">Live</p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <Card className="premium-card bg-black border-black shadow-2xl overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <CardHeader className="relative z-10 border-b border-white/5 bg-white/5">
          <CardTitle className="text-white text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
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
                    className="w-full h-auto py-6 flex flex-col items-center gap-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/50 transition-all duration-300 group/btn"
                  >
                    <div className="p-3 bg-primary/10 rounded-xl group-hover/btn:bg-primary/20 group-hover/btn:scale-110 group-hover/btn:rotate-3 transition-all">
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
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-start gap-4 pb-4 border-b last:border-0">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : activities && activities.length > 0 ? (
            <div className="space-y-4">
              {activities.slice(0, 10).map((activity) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 pb-4 border-b last:border-0"
                  >
                    <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none text-black">
                        {activity.description}
                      </p>
                      <p className="text-sm text-black">
                        {activity.user} • {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
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
    <Card className="bg-black border-0 mb-6 shadow-xl overflow-hidden">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-primary rounded-full text-foreground">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="font-black text-primary text-lg">Outstanding Fines: ₹{totalFineAmount}</p>
            <p className="text-sm text-white">Please clear your dues to avoid restrictions.</p>
          </div>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/30 hover:shadow-md smooth-transition rounded-lg active:scale-95" size="sm" asChild>
          <Link to="/fines">View Details</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
