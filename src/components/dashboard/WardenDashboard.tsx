import { safeLazy } from "@/lib/safeLazy";

import { useState, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Tenant, GatePass } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { isTopLevelManagement } from '@/lib/rbac';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DigitalCard } from '@/components/profile/DigitalCard';
import { Suspense } from 'react';

const DashboardPieChart = safeLazy(() => import('./Charts').then(m => ({ default: m.DashboardPieChart })));
const DashboardBarChart = safeLazy(() => import('./Charts').then(m => ({ default: m.DashboardBarChart })));

interface AttendanceToday {
  total_students: number;
  present: number;
  absent: number;
  percentage: number;
}

interface AdvancedStats {
  head_warden_stats?: {
    total_students: number;
    active_gate_passes: number;
    pending_leaves: number;
    stale_leaves?: number;
    pending_special_requests: number;
    meal_forecast: number;
    occupancy_rate: number;
    resolution_rate: number;
    period: string;
    attendance_today?: AttendanceToday;
  };
  warden_stats?: {
    block_occupancy: Array<{
      building_name: string;
      occupancy_rate: number;
      total_beds: number;
      occupied_beds: number;
    }>;
    pending_complaints: number;
    pending_leaves: number;
    stale_leaves?: number;
    pending_special_requests: number;
    gate_pass_status: {
      pending: number;
      approved: number;
      used: number;
    };
    show_attendance_alert?: boolean;
    attendance_marked_today?: boolean;
    attendance_today?: AttendanceToday;
  };
}

export function WardenDashboard() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<GatePass | null>(null);
  
  // Consolidated realtime invalidation — all events invalidate the single stats query
  useRealtimeQuery(
    ['gatepass_created', 'gatepass_updated', 'gate_scan_logged', 'room_allocated',
     'complaint_updated', 'leave_created', 'leave_updated', 'forecast_updated', 'attendance_updated'],
    'warden-advanced-stats'
  );

  const { data: stats, isLoading } = useQuery<AdvancedStats>({
    queryKey: ['warden-advanced-stats', role, period],
    queryFn: async () => {
      const response = await api.get(`/metrics/advanced-dashboard/?period=${period}`);
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes, let realtime handle invalidation
  });

  // Derive pending passes from stats instead of a separate API call
  const pendingPasses = stats?.warden_stats?.gate_pass_status?.pending
    ? (stats as AdvancedStats & { pending_passes?: GatePass[] }).pending_passes ?? null
    : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded" />)}
        </div>
      </div>
    );
  }

  // 1. HEAD WARDEN VIEW
  if (isTopLevelManagement(role)) {
    const hwStats = stats?.head_warden_stats;
    
    const cardMetrics = [
        { label: 'Total Students', value: hwStats?.total_students, icon: Users, color: 'text-slate-900', bg: 'bg-slate-50 border border-slate-100' },
        { label: 'Active Outside', value: hwStats?.active_gate_passes, icon: ClipboardList, color: 'text-slate-900', bg: 'bg-slate-50 border border-slate-100' },
        { label: 'Meal Forecast', value: hwStats?.meal_forecast, icon: Utensils, color: 'text-slate-900', bg: 'bg-slate-50 border border-slate-100' },
        { label: 'Unresolved Issues', value: stats?.warden_stats?.pending_complaints || 0, icon: AlertCircle, color: 'text-slate-900', bg: 'bg-slate-50 border border-slate-100' },
    ];

    const occupancyData = [
        { name: 'Occupied', value: hwStats?.occupancy_rate || 0 },
        { name: 'Vacant', value: Math.max(0, 100 - (hwStats?.occupancy_rate || 0)) },
    ];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                Administrative Oversight
            </h2>
            <div className="flex bg-muted p-1 rounded-sm border">
                {(['day', 'week', 'month'] as const).map((p) => (
                    <Button
                        key={p}
                        variant={period === p ? 'default' : 'ghost'}
                        size="sm"
                        className={`rounded-sm capitalize ${period === p ? 'primary-gradient text-white shadow-sm' : ''}`}
                        onClick={() => setPeriod(p)}
                    >
                        {p}
                    </Button>
                 ))}
            </div>
        </div>

        {/* Attendance Reminder Alert */}
        {stats?.warden_stats?.show_attendance_alert && (
            <div className="bg-red-50 border border-red-200 rounded p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm">
                <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
                    <div className="h-14 w-14 bg-red-100 rounded-sm flex items-center justify-center text-red-600 shadow-inner border border-red-200">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                    <div>
                        <h4 className="font-black text-red-900 text-lg">Attendance Not Marked!</h4>
                        <p className="text-red-600/80 font-medium text-sm">Today's attendance window is open. Please ensure all student presences are recorded.</p>
                    </div>
                </div>
                <Link to="/attendance" className="w-full md:w-auto">
                    <Button className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white rounded-sm shadow-lg shadow-red-200 h-10 px-8 font-black uppercase tracking-wider transition-transform active:scale-95">
                        Mark Now
                    </Button>
                </Link>
            </div>
        )}

        {/* Leave Overstay Alert */}
        {((hwStats?.stale_leaves || 0) > 0 || (stats?.warden_stats?.stale_leaves || 0) > 0) && (
             <div className="bg-red-50 border border-red-200 text-red-700 p-5 rounded flex items-center gap-4 animate-in fade-in">
                 <div className="h-12 w-12 bg-red-100 rounded-sm flex items-center justify-center flex-shrink-0">
                     <AlertCircle className="h-6 w-6 text-red-600" />
                 </div>
                 <div>
                     <h4 className="font-black text-red-900">Student leave period exceeded</h4>
                     <p className="text-sm font-medium text-red-800/80">
                         There are {hwStats?.stale_leaves || stats?.warden_stats?.stale_leaves} student(s) who have not yet returned. Security must manually mark their return.
                     </p>
                 </div>
             </div>
        )}

        {/* ── Head Warden High-Level Pass Priority ── */}
        {(stats?.warden_stats?.gate_pass_status?.pending || 0) > 0 && (
            <Link to="/gate-passes" className="block">
                <div className="bg-primary/10 border border-primary/20 rounded p-4 flex items-center justify-between hover:bg-primary/20 transition-all cursor-pointer shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-primary/20 rounded-sm flex items-center justify-center text-primary shadow-sm border border-primary/20">
                            <UserCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-primary/70 tracking-widest">Immediate Oversight Needed</p>
                            <h4 className="font-black text-gray-900">{stats?.warden_stats?.gate_pass_status?.pending} Pending Authorization Requests</h4>
                        </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-primary mr-2" />
                </div>
            </Link>
        )}

        {(stats?.head_warden_stats?.pending_leaves || 0) > 0 && (
            <Link to="/leaves" className="block">
                <div className="bg-amber-50 border border-amber-200 rounded p-4 flex items-center justify-between hover:bg-amber-100 transition-all cursor-pointer shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-amber-100 rounded-sm flex items-center justify-center text-amber-600 shadow-sm border border-amber-200">
                            <ClipboardList className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-amber-600/70 tracking-widest">Leave Priority</p>
                            <h4 className="font-black text-gray-900">{stats?.head_warden_stats?.pending_leaves} Pending Leave Applications</h4>
                        </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-amber-600 mr-2" />
                </div>
            </Link>
        )}

        {(stats?.head_warden_stats?.pending_special_requests || 0) > 0 && (
            <Link to="/meals" className="block">
                <div className="bg-success/10 border border-success/20 rounded p-4 flex items-center justify-between hover:bg-success/20 transition-all cursor-pointer shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-success/20 rounded-sm flex items-center justify-center text-success shadow-sm border border-success/20">
                            <Utensils className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-success/70 tracking-widest">Food Service Request</p>
                            <h4 className="font-black text-gray-900">{stats?.head_warden_stats?.pending_special_requests} Pending Special Meal Authorization</h4>
                        </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-success mr-2" />
                </div>
            </Link>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {cardMetrics.map((m) => (
                <Card key={m.label} className={cn(
                    "border border-slate-200/60 shadow-sm rounded-xl overflow-hidden group hover:shadow-md transition-all bg-white",
                    m.bg
                )}>
                    <CardContent className="p-4 md:p-6">
                        <div className="flex items-center justify-between mb-2 md:mb-4">
                            <div className={cn(
                                "p-2 md:p-3 rounded-lg shadow-sm group-hover:scale-110 transition-transform bg-slate-100/50 text-slate-600"
                            )}>
                                <m.icon className={cn("h-4 w-4 md:h-5 md:w-5", m.color)} />
                            </div>
                            <Badge variant="outline" className={cn(
                                "border-0 text-[8px] md:text-[10px] font-bold bg-slate-50 text-slate-500"
                            )}>LIVE</Badge>
                        </div>
                        <p className={cn(
                            "text-xs md:text-sm font-semibold uppercase tracking-tight opacity-70 truncate text-slate-500"
                        )}>{m.label}</p>
                        <h3 className={cn(
                            "text-2xl md:text-3xl lg:text-3xl font-bold mt-1 text-slate-900 tracking-tight"
                        )}>{m.value}</h3>
                    </CardContent>
                </Card>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Occupancy Chart */}
            <Card className="rounded shadow-sm border-0">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Campus Occupancy
                    </CardTitle>
                    <CardDescription>Real-time bed allocation status</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                    <div className="h-[200px] w-full">
                        <Suspense fallback={<Skeleton className="h-full w-full rounded-sm" />}>
                            <DashboardPieChart data={occupancyData} />
                        </Suspense>
                    </div>
                    <div className="text-center mt-2">
                        <span className="text-3xl font-bold">{hwStats?.occupancy_rate}%</span>
                        <p className="text-sm text-muted-foreground">Overall Capacity</p>
                    </div>
                </CardContent>
            </Card>

            {/* Resolution Rate Card */}
            <Card className="rounded-xl shadow-sm border border-slate-200/60 bg-white flex flex-col justify-center items-center p-5 md:p-8">
                <div className="p-3 md:p-4 bg-slate-50 border border-slate-100 rounded-full shadow-sm mb-3 md:mb-4">
                    <CheckCircle2 className="h-8 w-8 text-slate-900" />
                </div>
                <h3 className="text-3xl md:text-3xl font-bold text-slate-900 tracking-tight">{hwStats?.resolution_rate}%</h3>
                <p className="text-xs md:text-sm font-semibold text-slate-500 tracking-tight mt-1">Complaint Resolution</p>
                <div className="w-full mt-4 md:mt-6 space-y-2">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-slate-900" 
                            style={{ width: `${hwStats?.resolution_rate}%` }} 
                        />
                    </div>
                </div>
            </Card>

            {/* Quick Actions */}
            <Card className="rounded-xl shadow-sm border border-slate-200/60 bg-white">
                <CardHeader>
                    <CardTitle className="text-lg font-bold tracking-tight text-slate-900">Administrative Hub</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-2">
                    <Link to="/reports">
                        <Button className="w-full h-11 justify-start gap-4 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900" variant="outline">
                            <ClipboardList className="h-4 w-4" /> Audit Reports
                        </Button>
                    </Link>
                    <Link to="/rooms">
                        <Button className="w-full h-11 justify-start gap-4 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900" variant="outline">
                            <Building2 className="h-4 w-4" /> Inventory
                        </Button>
                    </Link>
                    <Link to="/room-mapping">
                        <Button className="w-full h-11 justify-start gap-4 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900" variant="outline">
                            <Bed className="h-4 w-4" /> Room Mapping
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
        {/* Pending Gatepass Overlays / Fast Track */}
        {pendingPasses && pendingPasses.length > 0 && (
            <Card className="rounded border-0 shadow-xl shadow-primary/10 overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 border-b border-primary/10 p-6 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xl font-black text-primary tracking-tight">Pending Gatepass Requests</CardTitle>
                        <CardDescription className="text-xs font-bold text-primary/60 uppercase tracking-widest mt-1">Immediate Action Required • {pendingPasses.length} Active</CardDescription>
                    </div>
                    <Link to="/gate-passes">
                        <Button variant="ghost" className="text-xs font-black text-primary hover:bg-primary/10 rounded-sm px-4">
                            VIEW ALL <ArrowRight className="h-3 w-3 ml-2" />
                        </Button>
                    </Link>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                        {pendingPasses.map((pass) => (
                            <div key={pass.id} className="group hover:bg-slate-50 transition-colors">
                                <Link to="/gate-passes" className="block">
                                    <div className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="h-12 w-12 rounded-sm bg-slate-100 flex items-center justify-center font-black text-slate-400 shrink-0">
                                                {pass.student_name?.[0]}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-900 leading-none">{pass.student_name}</h4>
                                                <p className="text-xs font-bold text-slate-400 mt-1">{pass.student_hall_ticket} • Room {pass.student_room}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-2 md:gap-6 w-full md:w-auto justify-between md:justify-end">
                                            <div className="text-right hidden sm:block">
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Movement Period</p>
                                                <p className="text-xs font-bold text-slate-700">{pass.exit_date} {pass.exit_time} ↗</p>
                                                <p className="text-xs font-bold text-slate-700">{pass.expected_return_date} {pass.expected_return_time} ↙</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="rounded-sm font-black text-[10px] h-8 border-primary/20 hover:bg-primary/5 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setSelectedStudentForCard(pass);
                                                    }}
                                                >
                                                    VERIFY ID
                                                </Button>
                                                <div className="h-10 w-10 rounded-sm border border-slate-200 flex items-center justify-center text-slate-400">
                                                    <ArrowRight className="h-4 w-4" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )}

        {/* STUDENT DIGITAL CARD MODAL */}
        <Dialog open={!!selectedStudentForCard} onOpenChange={(open) => !open && setSelectedStudentForCard(null)}>
            <DialogContent className="max-w-md p-0 overflow-hidden border-0 rounded shadow-2xl bg-transparent">
                {selectedStudentForCard?.student_details ? (
                    <DigitalCard 
                        user={selectedStudentForCard.student_details} 
                        gatePass={selectedStudentForCard}
                    />
                ) : (
                    <div className="p-10 bg-white rounded text-center space-y-4">
                        <div className="h-20 w-20 bg-muted rounded-sm mx-auto animate-pulse flex items-center justify-center">
                            <User className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <p className="font-black text-muted-foreground">Loading Student Profile...</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>

        {/* Attendance Reminder Alert */}
        {wStats?.show_attendance_alert && (
            <div className="bg-red-50 border border-red-200 rounded p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm">
                <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
                    <div className="h-14 w-14 bg-red-100 rounded-sm flex items-center justify-center text-red-600 shadow-inner border border-red-200">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                    <div>
                        <h4 className="font-black text-red-900 text-lg">Attendance Not Marked!</h4>
                        <p className="text-red-600/80 font-medium text-sm">Today's attendance window is open. Please ensure all student presences are recorded.</p>
                    </div>
                </div>
                <Link to="/attendance" className="w-full md:w-auto">
                    <Button className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white rounded-sm shadow-lg shadow-red-200 h-10 px-8 font-black uppercase tracking-wider transition-transform active:scale-95">
                        Mark Now
                    </Button>
                </Link>
            </div>
        )}

        {/* Live Attendance Overview */}
        {wStats?.attendance_today && (
            <div className="grid grid-cols-3 gap-3">
                <Card className="rounded-sm border-0 shadow-sm bg-emerald-50">
                    <CardContent className="p-4 text-center">
                        <UserCheck className="h-6 w-6 text-emerald-600 mx-auto mb-1" />
                        <h3 className="text-2xl md:text-3xl font-black text-emerald-600">{wStats.attendance_today.present}</h3>
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Present</p>
                    </CardContent>
                </Card>
                <Card className="rounded-sm border-0 shadow-sm bg-red-50">
                    <CardContent className="p-4 text-center">
                        <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-1" />
                        <h3 className="text-2xl md:text-3xl font-black text-red-600">{wStats.attendance_today.absent}</h3>
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Absent</p>
                    </CardContent>
                </Card>
                <Card className="rounded-sm border-0 shadow-sm bg-blue-50">
                    <CardContent className="p-4 text-center">
                        <TrendingUp className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                        <h3 className="text-2xl md:text-3xl font-black text-blue-600">{wStats.attendance_today.percentage}%</h3>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Attendance</p>
                    </CardContent>
                </Card>
            </div>
        )}

        {/* ── Warden High Priority Tasks ── */}
        {(gpStatus?.pending || 0) > 0 && (
             <Card className="overflow-hidden border-0 shadow-xl rounded-2xl md:rounded-3xl bg-[#0B0B0C] text-white tracking-tight">
                <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 text-center sm:text-left">
                        <div className="h-14 w-14 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/20">
                            <ClipboardList className="h-8 w-8 text-blue-400" />
                        </div>
                        <div>
                            <Badge className="bg-blue-500/20 text-blue-400 border-0 font-black text-[10px] uppercase tracking-widest px-3 py-1 mb-2 shadow-sm rounded-xl">Critical Attention</Badge>
                            <h3 className="text-xl font-bold tracking-tight leading-none text-white">{gpStatus?.pending} Pending Gate Passes</h3>
                            <p className="text-zinc-400 text-xs font-medium mt-2">Students are waiting for your authorization to leave the campus.</p>
                        </div>
                    </div>
                    <Link to="/gate-passes" className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto bg-blue-500 text-white hover:bg-blue-600 font-bold rounded-xl px-8 h-12 shadow-md border-0">
                            REVIEW NOW
                        </Button>
                    </Link>
                </CardContent>
             </Card>
        )}

        {(wStats?.pending_leaves || 0) > 0 && (
             <Card className="overflow-hidden border-0 shadow-xl rounded-2xl md:rounded-3xl bg-[#0B0B0C] text-white">
                <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 text-center sm:text-left">
                        <div className="h-14 w-14 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/20">
                            <ClipboardList className="h-8 w-8 text-blue-400" />
                        </div>
                        <div>
                            <Badge className="bg-blue-500/20 text-blue-400 border-0 font-black text-[10px] uppercase tracking-widest px-3 py-1 mb-2 shadow-sm rounded-xl">Response Needed</Badge>
                            <h3 className="text-xl font-bold tracking-tight leading-none text-white">{wStats?.pending_leaves} Student Leave Requests</h3>
                            <p className="text-zinc-400 text-xs font-medium mt-2">Review and approve overnight or weekend leave applications.</p>
                        </div>
                    </div>
                    <Link to="/leaves" className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto bg-blue-500 text-white hover:bg-blue-600 font-bold rounded-xl px-8 h-12 shadow-md border-0">
                            APPROVE LEAVES
                        </Button>
                    </Link>
                </CardContent>
             </Card>
        )}

        {(wStats?.pending_special_requests || 0) > 0 && (
             <Card className="overflow-hidden border-0 shadow-xl rounded-2xl md:rounded-3xl bg-[#0B0B0C] text-white tracking-tight">
                <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 text-center sm:text-left">
                        <div className="h-14 w-14 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/20">
                            <Utensils className="h-8 w-8 text-blue-400" />
                        </div>
                        <div>
                            <Badge className="bg-blue-500/20 text-blue-400 border-0 font-black text-[10px] uppercase tracking-widest px-3 py-1 mb-2 shadow-sm rounded-xl">Kitchen Action</Badge>
                            <h3 className="text-xl font-bold tracking-tight leading-none text-white">{wStats?.pending_special_requests} Special Meal Authorization</h3>
                            <p className="text-zinc-400 text-xs font-medium mt-2">Approval needed for special food items requested by students.</p>
                        </div>
                    </div>
                    <Link to="/meals" className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto bg-blue-500 text-white hover:bg-blue-600 font-bold rounded-xl px-8 h-12 shadow-md border-0">
                            REVIEW REQUESTS
                        </Button>
                    </Link>
                </CardContent>
             </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Block Occupancy Table-like Card */}
            <Card className="rounded shadow-sm border-0">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        My Block Occupancy
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {wStats?.block_occupancy?.map((block) => (
                        <div key={block.building_name} className="p-4 rounded-sm border bg-muted/20">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold">{block.building_name}</span>
                                <span className="text-sm font-medium">{block.occupied_beds}/{block.total_beds} Beds</span>
                            </div>
                            <div className="h-2 w-full bg-background rounded-sm overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-1000"
                                    style={{ width: `${block.occupancy_rate}%` }}
                                />
                            </div>
                        </div>
                    ))}
                    {!wStats?.block_occupancy?.length && (
                        <div className="text-center py-4 md:py-8 text-sm text-muted-foreground italic px-4">
                            No building assigned. Please verify room allocation.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Gate Pass Status Chart */}
            <Card className="rounded shadow-sm border-0">
                <CardHeader>
                    <CardTitle className="text-lg">Pass Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] md:h-[250px] w-full">
                        <Suspense fallback={<Skeleton className="h-full w-full rounded-sm" />}>
                            <DashboardBarChart data={barData} />
                        </Suspense>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
             <Card className="flex flex-col items-center justify-center p-5 md:p-8 bg-red-50 border-red-100 border-0 rounded">
                <AlertCircle className="h-8 w-8 md:h-10 md:w-10 text-red-500 mb-2" />
                <h3 className="text-3xl md:text-4xl font-black text-red-600">{wStats?.pending_complaints || 0}</h3>
                <p className="text-[10px] md:text-xs font-bold text-red-400 uppercase tracking-widest mt-1">Pending Complaints</p>
                <Link to="/complaints" className="mt-4">
                    <Button size="sm" variant="destructive" className="rounded-sm px-6">Take Action</Button>
                </Link>
            </Card>

            {/* Quick Access */}
            <Link to="/gate-passes" className="group">
                <Card className="h-full rounded shadow-sm border border-primary/20 flex flex-col justify-center items-center p-5 md:p-8 bg-primary/10 hover:bg-primary/20 transition-colors">
                    <ClipboardList className="h-8 w-8 md:h-10 md:w-10 text-primary mb-2" />
                    <h3 className="text-xl md:text-2xl font-bold text-foreground">{gpStatus?.pending || 0}</h3>
                    <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-widest">New Requests</p>
                </Card>
            </Link>

            <Link to="/attendance" className="group">
                <Card className="h-full rounded shadow-sm border-0 flex flex-col justify-center items-center p-5 md:p-8 bg-green-50 hover:bg-green-100 transition-colors">
                    <UserCheck className="h-8 w-8 md:h-10 md:w-10 text-primary mb-2" />
                    <h3 className="text-xl md:text-2xl font-bold">Attendance</h3>
                    <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-widest">Mark Registry</p>
                </Card>
            </Link>
        </div>

        <StudentHRWidget />
    </div>
  );
}

const StudentHRWidget = memo(function StudentHRWidget() {
    const { data: hrStudents, isLoading } = useQuery<Tenant[]>({
        queryKey: ['student-hrs'],
        queryFn: async () => {
            const response = await api.get('/users/tenants/?user__groups__name=Student_HR');
            return response.data.results || response.data;
        }
    });

    return (
        <Card className="rounded border-0 shadow-sm">
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
                    <div className="text-center py-8 text-black/50 text-sm border-2 border-dashed rounded-sm bg-muted/20">
                        No Student representatives assigned.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {hrStudents?.map((tenant: Tenant) => (
                            <div key={tenant.id} className="flex items-center justify-between p-4 rounded-sm border bg-card hover:border-primary/50 transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-sm bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-foreground">{tenant.user.name}</p>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Floor Rep • {tenant.room_number || 'N/A'}</p>
                                    </div>
                                </div>
                                {tenant.user.phone && (
                                    <a href={`tel:${tenant.user.phone}`} className="h-9 w-9 rounded-sm bg-secondary flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-colors">
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
});
