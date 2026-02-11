import { useQuery } from '@tanstack/react-query';
import { Users, Home, ClipboardCheck, FileText, Activity, Bell, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Link } from 'react-router-dom';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { ChefDashboard } from '@/components/dashboard/ChefDashboard';
import { WardenDashboard } from '@/components/dashboard/WardenDashboard';
import { GateSecurityDashboard } from '@/components/dashboard/GateSecurityDashboard';
import { SecurityHeadDashboard } from '@/components/dashboard/SecurityHeadDashboard';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';

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
    // Don't run this for roles that have their own dashboard stats unless shared
    enabled: !['chef', 'warden', 'head_warden', 'gate_security', 'security_head'].includes(user?.role || ''),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<RecentActivity[]>({
    queryKey: ['recent-activities'],
    queryFn: async () => {
      const response = await api.get('/metrics/activities/');
      return response.data.results || response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Real-time updates for dashboard
  useRealtimeQuery('gatepass_updated', ['dashboard-stats', 'recent-activities']);
  useRealtimeQuery('attendance_updated', ['dashboard-stats', 'recent-activities']);
  useRealtimeQuery('notice_created', 'recent-activities');
  useRealtimeQuery('room_updated', 'dashboard-stats');
  useRealtimeQuery('room_allocated', 'dashboard-stats');
  useRealtimeQuery('room_deallocated', 'dashboard-stats');
  
  if (user?.role === 'chef') {
      return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">Kitchen Dashboard</h1>
                <p className="text-muted-foreground">
                Welcome back, {user?.name}
                </p>
            </div>
            <ChefDashboard />
        </div>
      );
  }

  if (user?.role === 'warden' || user?.role === 'head_warden') {
      return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">Warden Dashboard</h1>
                <p className="text-muted-foreground">
                Welcome back, {user?.name}
                </p>
            </div>
            <WardenDashboard />
        </div>
      );
  }

  if (user?.role === 'gate_security') {
      return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">Gate Security</h1>
                <p className="text-muted-foreground">
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
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">Campus Security Head</h1>
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
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">My Dashboard</h1>
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
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Total Rooms',
      value: `${stats?.occupied_rooms || 0}/${stats?.total_rooms || 0}`,
      icon: Home,
      color: 'text-primary',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Pending Gate Passes',
      value: stats?.pending_gate_passes || 0,
      icon: ClipboardCheck,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      title: "Today's Attendance",
      value: `${stats?.today_attendance || 0}/${stats?.total_attendance || 0}`,
      icon: FileText,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
    },
  ];

  const quickActions = [
    { label: 'Mark Attendance', to: '/attendance', icon: ClipboardCheck, color: 'text-emerald-500' },
    { label: 'Create Gate Pass', to: '/gate-passes', icon: FileText, color: 'text-primary' },
    { label: 'View Notices', to: '/notices', icon: Bell, color: 'text-amber-500' },
  ];
  
  // Student HR / Admin Actions
  if (user?.role === 'admin' || user?.role === 'super_admin' || user?.is_student_hr) {
      if (user?.role === 'admin' || user?.role === 'super_admin') {
          quickActions.push({ label: 'Manage Rooms', to: '/rooms', icon: Home, color: 'text-primary' });
      }
      
      // Student HR specific actions if not already there
      if (user?.is_student_hr) {
          quickActions.push({ label: 'Manage Notices', to: '/notices', icon: Bell, color: 'text-orange-500' });
          quickActions.push({ label: 'Track Complaints', to: '/complaints', icon: AlertTriangle, color: 'text-rose-500' });
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
      default:
        return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'gate_pass':
        return 'bg-primary/10 text-primary';
      case 'attendance':
        return 'bg-success/10 text-success';
      case 'notice':
        return 'bg-secondary/60 text-primary';
      default:
        return 'bg-muted/40 text-foreground';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name || user?.hall_ticket || user?.username}
        </p>
      </div>

      {/* Outstanding Fines Alert */}
      <OutstandingFinesAlert user={user} />
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          // Loading skeletons
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="rounded-2xl">
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
              <Card key={index} className="bg-card hover:shadow-lg transition-all duration-300 border-border shadow-sm rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-3 rounded-full ${stat.bgColor} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">total</p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <Card className="bg-card border-border shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground">⚡ Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Link key={index} to={action.to}>
                  <Button
                    variant="outline"
                    className="w-full h-auto py-5 flex flex-col items-center gap-2 rounded-2xl hover:bg-muted hover:border-primary/50 transition-all duration-300 group"
                  >
                    <div className="p-2 bg-primary/5 rounded-full group-hover:bg-primary/10 transition-all">
                      <Icon className={`h-6 w-6 ${action.color}`} />
                    </div>
                    <span className="text-xs text-center font-medium text-foreground">{action.label}</span>
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
                      <p className="text-sm font-medium leading-none">
                        {activity.description}
                      </p>
                      <p className="text-sm text-muted-foreground">
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

function OutstandingFinesAlert({ user }: { user: any }) {
  const { data: fines } = useQuery({
    queryKey: ['disciplinary-fines-alert'],
    queryFn: async () => {
      const response = await api.get('/disciplinary/');
      return response.data;
    },
    enabled: !!user && user.role === 'student', // Only check for students
  });

  const unpaidFines = fines?.filter((f: any) => !f.is_paid && parseFloat(f.fine_amount) > 0) || [];
  const totalFineAmount = unpaidFines.reduce((sum: number, f: any) => sum + parseFloat(f.fine_amount), 0);

  if (!totalFineAmount) return null;

  return (
    <Card className="bg-destructive/5 border-destructive/20 mb-6">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-destructive/10 rounded-full text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-destructive">Outstanding Fines: ₹{totalFineAmount}</p>
            <p className="text-sm text-muted-foreground">Please clear your dues to avoid restrictions.</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" asChild>
          <Link to="/fines">View Details</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
