import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Bed, ClipboardList, UserCheck, ShieldAlert, Phone, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { Badge } from '@/components/ui/badge';

interface WardenStats {
  pending_gate_passes: number;
  unread_messages: number;
  vacant_beds: number;
  total_students: number;
}



function StudentHRWidget() {
    const { data: hrStudents, isLoading } = useQuery({
        queryKey: ['student-hrs'],
        queryFn: async () => {
            const response = await api.get('/users/tenants/?user__groups__name=Student_HR');
            return response.data.results || response.data;
        }
    });

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                    <span>Student Representatives</span>
                    <Badge variant="secondary" className="font-normal text-xs">
                        {hrStudents?.length || 0} Active
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">Loading...</div>
                ) : hrStudents?.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg bg-muted/20">
                        No Student HRs elected yet.
                        <div className="mt-2">
                            <Link to="/tenants" className="text-primary hover:underline font-medium">
                                Go to Users to elect HRs
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {hrStudents?.map((tenant: any) => (
                            <div key={tenant.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">{tenant.user.name}</p>
                                        <p className="text-xs text-muted-foreground">Room: {tenant.room_number || 'N/A'}</p>
                                    </div>
                                </div>
                                {tenant.user.phone_number && (
                                    <a href={`tel:${tenant.user.phone_number}`} className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Call">
                                        <Phone className="h-4 w-4" />
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function WardenDashboard() {
  // Keep stats live when allocations/gatepasses/messages change.
  useRealtimeQuery('gatepass_updated', 'warden-stats');
  useRealtimeQuery('room_allocated', 'warden-stats');
  useRealtimeQuery('room_deallocated', 'warden-stats');
  useRealtimeQuery('messages_updated', 'warden-stats');

  const { data: stats, isLoading, isError } = useQuery<WardenStats>({
    queryKey: ['warden-stats'], // We can reuse dashboard-metrics endpoint mostly
    queryFn: async () => {
      // Reusing the general dashboard endpoint for now, can be specialized later
      const response = await api.get('/metrics/dashboard/');
      // Map the generic response to WardenStats interface if needed
      return {
          pending_gate_passes: Number(response.data.pending_gate_passes ?? 0),
          unread_messages: Number(response.data.unread_messages ?? 0),
          vacant_beds: Number(response.data.vacant_beds ?? 0),
          total_students: Number(response.data.total_students ?? 0)
      };
    },
    // WS keeps this live; polling is a safety net if WS disconnects.
    refetchInterval: 60000,
  });

  const pendingGatePasses = stats?.pending_gate_passes ?? 0;
  const unreadMessages = stats?.unread_messages ?? 0;
  const vacantBeds = stats?.vacant_beds ?? 0;
  const totalStudents = stats?.total_students ?? 0;

  const actions = [
    { label: 'Pending Passes', icon: ClipboardList, to: '/gate-passes', count: isLoading ? '...' : pendingGatePasses, alert: !isLoading && pendingGatePasses > 0 },
    { label: 'Vacant Beds', icon: Bed, to: '/room-mapping', count: isLoading ? '...' : vacantBeds },
    { label: 'Students', icon: UserCheck, to: '/tenants', count: isLoading ? '...' : totalStudents },
    { label: 'Messages', icon: ShieldAlert, to: '/messages', count: isLoading ? '...' : unreadMessages, alert: !isLoading && unreadMessages > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action, i) => {
            const Icon = action.icon;
            return (
                <Link to={action.to} key={i}>
                    <Card className={`hover:bg-accent/40 transition-colors cursor-pointer border-l-4 ${action.alert ? 'border-l-primary' : 'border-l-border'}`}>
                        <CardContent className="p-6 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">{action.label}</p>
                                <h3 className="text-2xl font-bold">
                                    {action.count}
                                </h3>
                            </div>
                            <div className={`p-3 rounded-full ${action.alert ? 'bg-primary/10 text-primary animate-pulse' : 'bg-primary/10 text-primary'}`}>
                                <Icon className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="h-fit">
            <CardHeader>
                <CardTitle className="text-lg">Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <ClipboardList className="h-10 w-10 mb-2 opacity-20" />
                        <p>Loading approvals...</p>
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <AlertCircle className="h-10 w-10 mb-2 opacity-20" />
                        <p>Failed to load dashboard stats</p>
                    </div>
                ) : pendingGatePasses === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <ClipboardList className="h-10 w-10 mb-2 opacity-20" />
                        <p>No pending gate passes</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="font-medium text-foreground">{pendingGatePasses} Requests Pending</p>
                                    <p className="text-xs text-muted-foreground">Gate passes require your attention</p>
                                </div>
                            </div>
                            <Link to="/gate-passes">
                                <Button size="sm" variant="outline" className="text-primary border-primary/20 hover:bg-primary/10">
                                    Review
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        <div className="space-y-6">
            <Card>
                <CardHeader>
                     <CardTitle className="text-lg">Quick Access</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                    <Link to="/room-mapping">
                        <Button variant="outline" className="w-full justify-start gap-2 h-12">
                            <Bed className="h-4 w-4" /> Room Allocation
                        </Button>
                    </Link>
                    <Link to="/attendance">
                        <Button variant="outline" className="w-full justify-start gap-2 h-12">
                            <UserCheck className="h-4 w-4" /> Mark Attendance
                        </Button>
                    </Link>
                    <Link to="/messages">
                        <Button variant="outline" className="w-full justify-start gap-2 h-12">
                            <ShieldAlert className="h-4 w-4" /> Messages
                        </Button>
                    </Link>
                    <Link to="/reports">
                        <Button variant="outline" className="w-full justify-start gap-2 h-12">
                            <ClipboardList className="h-4 w-4" /> Daily Report
                        </Button>
                    </Link>
                </CardContent>
            </Card>

            <StudentHRWidget />
        </div>
      </div>
    </div>
  );
}
