import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RoomAllocation } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  AlertCircle, 
  Bed, 
  ClipboardList, 
  UserCheck, 
  ShieldAlert, 
  Users,
  Utensils,
  TrendingUp,
  Building2,
  Phone,
  User,
  CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/store';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';

interface AdvancedStats {
  head_warden_stats?: {
    total_students: number;
    active_gate_passes: number;
    meal_forecast: number;
    occupancy_rate: number;
    resolution_rate: number;
    period: string;
  };
  warden_stats?: {
    block_occupancy: Array<{
      building_name: string;
      occupancy_rate: number;
      total_beds: number;
      occupied_beds: number;
    }>;
    pending_complaints: number;
    gate_pass_status: {
      pending: number;
      approved: number;
      used: number;
    };
  };
}

const COLORS = ['#f97316', '#e2e8f0']; // Primary Orange and Muted

export function WardenDashboard() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  
  // Realtime updates
  useRealtimeQuery('gatepass_updated', 'warden-advanced-stats');
  useRealtimeQuery('room_allocated', 'warden-advanced-stats');
  useRealtimeQuery('complaint_updated', 'warden-advanced-stats');

  const { data: stats, isLoading } = useQuery<AdvancedStats>({
    queryKey: ['warden-advanced-stats', role, period],
    queryFn: async () => {
      const response = await api.get(`/metrics/advanced-dashboard/?period=${period}`);
      return response.data;
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded-2xl" />
            ))}
        </div>
    );
  }

  // 1. HEAD WARDEN VIEW
  if (role === 'head_warden' || role === 'admin' || role === 'super_admin') {
    const hwStats = stats?.head_warden_stats;
    
    const cardMetrics = [
        { label: 'Total Students', value: hwStats?.total_students, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
        { label: 'Active Outside', value: hwStats?.active_gate_passes, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-100' },
        { label: 'Meal Forecast', value: hwStats?.meal_forecast, icon: Utensils, color: 'text-green-600', bg: 'bg-green-100' },
        { label: 'Unresolved Issues', value: stats?.warden_stats?.pending_complaints || 0, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
    ];

    const occupancyData = [
        { name: 'Occupied', value: hwStats?.occupancy_rate || 0 },
        { name: 'Vacant', value: 100 - (hwStats?.occupancy_rate || 0) },
    ];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                Administrative Oversight
            </h2>
            <div className="flex bg-muted p-1 rounded-xl border">
                {(['day', 'week', 'month'] as const).map((p) => (
                    <Button
                        key={p}
                        variant={period === p ? 'default' : 'ghost'}
                        size="sm"
                        className={`rounded-lg capitalize ${period === p ? 'primary-gradient text-white shadow-sm' : ''}`}
                        onClick={() => setPeriod(p)}
                    >
                        {p}
                    </Button>
                ))}
            </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cardMetrics.map((m, i) => (
                <Card key={i} className="border-0 shadow-sm rounded-2xl bg-card overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className={`p-2 rounded-xl ${m.bg} group-hover:scale-110 transition-transform`}>
                                <m.icon className={`h-5 w-5 ${m.color}`} />
                            </div>
                            <Badge variant="outline" className="text-[10px] font-bold">LIVE</Badge>
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">{m.label}</p>
                        <h3 className="text-3xl font-black mt-1">{m.value}</h3>
                    </CardContent>
                </Card>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Occupancy Chart */}
            <Card className="rounded-2xl shadow-sm border-0">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Campus Occupancy
                    </CardTitle>
                    <CardDescription>Real-time bed allocation status</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={occupancyData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {occupancyData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="text-center mt-2">
                        <span className="text-3xl font-bold">{hwStats?.occupancy_rate}%</span>
                        <p className="text-sm text-muted-foreground">Overall Capacity</p>
                    </div>
                </CardContent>
            </Card>

            {/* Resolution Rate Card */}
            <Card className="rounded-2xl shadow-sm border-0 bg-secondary/10 flex flex-col justify-center items-center p-8">
                <div className="p-4 bg-white rounded-full shadow-lg mb-4">
                    <CheckCircle2 className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-4xl font-black text-foreground">{hwStats?.resolution_rate}%</h3>
                <p className="text-sm font-bold text-muted-foreground tracking-widest uppercase mt-2">Complaint Resolution</p>
                <div className="w-full mt-6 space-y-2">
                    <div className="h-2 w-full bg-white rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-primary" 
                            style={{ width: `${hwStats?.resolution_rate}%` }} 
                        />
                    </div>
                    <p className="text-center text-xs text-muted-foreground">Performance for {hwStats?.period}</p>
                </div>
            </Card>

            {/* Quick Actions */}
            <Card className="rounded-2xl shadow-sm border-0">
                <CardHeader>
                    <CardTitle className="text-lg">Administrative Hub</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3">
                    <Link to="/reports">
                        <Button className="w-full h-12 justify-start gap-4 rounded-xl hover:translate-x-1 transition-transform" variant="outline">
                            <ClipboardList className="h-5 w-5" /> Generate Performance Audit
                        </Button>
                    </Link>
                    <Link to="/rooms">
                        <Button className="w-full h-12 justify-start gap-4 rounded-xl hover:translate-x-1 transition-transform" variant="outline">
                            <Building2 className="h-5 w-5" /> All-Building Inventory
                        </Button>
                    </Link>
                    <Link to="/room-mapping">
                        <Button className="w-full h-12 justify-start gap-4 rounded-xl hover:translate-x-1 transition-transform" variant="outline">
                            <Bed className="h-5 w-5" /> Detailed Room Mapping
                        </Button>
                    </Link>
                    <Link to="/gate-passes">
                        <Button className="w-full h-12 justify-start gap-4 rounded-xl hover:translate-x-1 transition-transform" variant="outline">
                            <UserCheck className="h-5 w-5" /> Mass Approvals
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
      </div>
    );
  }

  // 2. REGULAR WARDEN VIEW
  const wStats = stats?.warden_stats;
  const gpStatus = wStats?.gate_pass_status;

  const barData = [
    { name: 'Pending', count: gpStatus?.pending || 0, fill: '#ef4444' },
    { name: 'Approved', count: gpStatus?.approved || 0, fill: '#3b82f6' },
    { name: 'Currently Out', count: gpStatus?.used || 0, fill: '#10b981' },
  ];

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Block Occupancy Table-like Card */}
            <Card className="rounded-2xl shadow-sm border-0">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        My Block Occupancy
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {wStats?.block_occupancy?.map((block, i) => (
                        <div key={i} className="p-4 rounded-xl border bg-muted/20">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold">{block.building_name}</span>
                                <span className="text-sm font-medium">{block.occupied_beds}/{block.total_beds} Beds</span>
                            </div>
                            <div className="h-2 w-full bg-background rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-1000"
                                    style={{ width: `${block.occupancy_rate}%` }}
                                />
                            </div>
                        </div>
                    ))}
                    {!wStats?.block_occupancy?.length && (
                        <div className="text-center py-8 text-muted-foreground italic">
                            No building assigned. Please verify room allocation.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Gate Pass Status Chart */}
            <Card className="rounded-2xl shadow-sm border-0">
                <CardHeader>
                    <CardTitle className="text-lg">Pass Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} stopColor="#888888" />
                                <YAxis fontSize={12} stroke="#888888" />
                                <Tooltip cursor={{fill: 'transparent'}} />
                                <Bar dataKey="count" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <Card className="flex flex-col items-center justify-center p-8 bg-red-50 border-red-100 border rounded-2xl">
                <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
                <h3 className="text-4xl font-black text-red-600">{wStats?.pending_complaints || 0}</h3>
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest mt-1">Pending Complaints</p>
                <Link to="/complaints" className="mt-4">
                    <Button size="sm" variant="destructive" className="rounded-full px-6">Take Action</Button>
                </Link>
            </Card>

            {/* Quick Access */}
            <Link to="/gate-passes" className="group">
                <Card className="h-full rounded-2xl shadow-sm border-0 flex flex-col justify-center items-center p-8 group-hover:bg-primary/5 transition-colors">
                    <ClipboardList className="h-10 w-10 text-primary mb-2" />
                    <h3 className="text-2xl font-bold">{gpStatus?.pending || 0}</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">New Requests</p>
                </Card>
            </Link>

            <Link to="/attendance" className="group">
                <Card className="h-full rounded-2xl shadow-sm border-0 flex flex-col justify-center items-center p-8 group-hover:bg-primary/5 transition-colors">
                    <UserCheck className="h-10 w-10 text-primary mb-2" />
                    <h3 className="text-2xl font-bold">Attendance</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Mark Registry</p>
                </Card>
            </Link>
        </div>

        <StudentHRWidget />
    </div>
  );
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
        <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                    <span>Student Representatives</span>
                    <Badge variant="secondary" className="font-bold text-xs bg-primary/20 text-black border-primary/30">
                        {hrStudents?.length || 0} Active
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-center py-4 text-sm text-muted-foreground animate-pulse">Loading reps...</div>
                ) : hrStudents?.length === 0 ? (
                    <div className="text-center py-8 text-black/50 text-sm border-2 border-dashed rounded-2xl bg-muted/20">
                        No Student representatives assigned.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {hrStudents?.map((tenant: RoomAllocation) => (
                            <div key={tenant.id} className="flex items-center justify-between p-4 rounded-2xl border bg-card hover:border-primary/50 transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-foreground">{tenant.student.name}</p>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Floor Rep • {tenant.room.room_number || 'N/A'}</p>
                                    </div>
                                </div>
                                {tenant.student.phone_number && (
                                    <a href={`tel:${tenant.student.phone_number}`} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-colors">
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
