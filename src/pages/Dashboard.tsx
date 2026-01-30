import { useQuery } from '@tanstack/react-query';
import { Users, Home, ClipboardCheck, FileText, Activity, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Link } from 'react-router-dom';
import { useRealtimeQuery } from '@/hooks/useWebSocket';

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
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<RecentActivity[]>({
    queryKey: ['recent-activities'],
    queryFn: async () => {
      const response = await api.get('/metrics/activities/');
      return response.data.results || response.data;
    },
  });

  // Real-time updates for dashboard
  useRealtimeQuery('dashboard_updated', 'dashboard-stats');
  useRealtimeQuery('activity_created', 'recent-activities');
  useRealtimeQuery('gatepass_updated', ['dashboard-stats', 'recent-activities']);
  useRealtimeQuery('attendance_updated', ['dashboard-stats', 'recent-activities']);

  const statCards = [
    {
      title: 'Total Students',
      value: stats?.total_students || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Total Rooms',
      value: `${stats?.occupied_rooms || 0}/${stats?.total_rooms || 0}`,
      icon: Home,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Pending Gate Passes',
      value: stats?.pending_gate_passes || 0,
      icon: ClipboardCheck,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: "Today's Attendance",
      value: `${stats?.today_attendance || 0}/${stats?.total_attendance || 0}`,
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  const quickActions = [
    { label: 'Mark Attendance', to: '/attendance', icon: ClipboardCheck },
    { label: 'Create Gate Pass', to: '/gate-passes', icon: FileText },
    { label: 'View Notices', to: '/notices', icon: Bell },
    { label: 'Manage Rooms', to: '/rooms', icon: Home },
  ];

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
        return 'bg-blue-100 text-blue-800';
      case 'attendance':
        return 'bg-green-100 text-green-800';
      case 'notice':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name || user?.hall_ticket || user?.username}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Link key={index} to={action.to}>
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 flex flex-col items-center gap-2"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs text-center">{action.label}</span>
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
            <div className="text-center py-8 text-muted-foreground">
              Loading activities...
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
            <div className="text-center py-8 text-muted-foreground">
              No recent activities
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
