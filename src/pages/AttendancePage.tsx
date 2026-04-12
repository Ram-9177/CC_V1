import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ClipboardCheck, TrendingUp, AlertTriangle, LayoutGrid, List, 
  Map as MapIcon, Calendar as CalendarIcon, CheckCheck, Check, X, 
  Download, LogOut, XCircle 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { EmptyState } from '@/components/ui/empty-state';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, getApiErrorMessage } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, downloadFile } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { SEO } from '@/components/common/SEO';
import { ListSkeleton } from '@/components/common/PageSkeleton';
import { Skeleton } from '@/components/ui/skeleton';


interface AttendanceRecord {
  id: number;
  student: {
    id: number;
    name: string;
    hall_ticket?: string;
    room_number?: string;
  };
  date: string;
  status: 'present' | 'absent' | 'out_gatepass' | 'on_leave' | 'late';
  marked_by?: string;
  marked_at: string;
  gate_pass?: {
    type: string;
    status: string;
    exit: string;
    entry: string | null;
  };
}

interface AttendanceStats {
  total_students: number;
  present_today: number;
  absent_today: number;
  attendance_percentage: number;
}

interface Defaulter {
  id: number;
  name: string;
  hall_ticket?: string;
  room_number?: string;
  absent_days: number;
  last_present: string;
}

// Interfaces for Map View
interface Occupant {
    id: number;
    name: string;
    reg_no?: string;
    registration_number?: string;
    hall_ticket?: string;
    phone?: string;
    phone_number?: string;
    college_code?: string | null;
    college_name?: string | null;
}

interface BedData {
    id: number;
    bed_number: string;
    is_occupied: boolean;
    occupant: Occupant | null;
}

interface RoomData {
    id: number;
    room_number: string;
    type: string;
    capacity: number;
    occupancy: number;
    beds: BedData[];
}

interface FloorData {
    floor_number: number;
    rooms: RoomData[];
}

interface BuildingData {
    id: number;
    name: string;
    code: string;
    floors: FloorData[];
}

const getApiCode = (error: unknown): string | null => {
  const payload = (error as { response?: { data?: { code?: unknown } } })?.response?.data;
  return typeof payload?.code === 'string' ? payload.code : null;
};

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  
  const canViewAll = !!(user?.role && [
    'super_admin',
    'admin',
    'head_warden',
    'warden',
    'hr',
    'staff',
    'incharge',
    'principal',
    'director',
    'hod',
    'chef',
    'head_chef',
    'pd',
    'pt',
  ].includes(user.role));
  const canEdit = !!(user?.role && ['admin', 'super_admin', 'head_warden', 'warden', 'hr'].includes(user.role)) || !!user?.is_student_hr;
  const isStudent = user?.role === 'student';

  // Fetch Room Mapping data for Map View (Summary for building selector)
  const { data: buildings, isError: mapSummaryError } = useQuery<BuildingData[]>({
      queryKey: ['room-mapping', 'summary'],
      queryFn: async () => {
          const response = await api.get('/rooms/mapping/');
          return response.data;
      },
      enabled: viewMode === 'map' && !!canViewAll,
  });

  // Fetch Full Building details including floors and beds
  const activeBuildingId = selectedBuilding || buildings?.[0]?.id;
  const { data: buildingDetail, isPending: detailPending, isFetching: detailFetching, isError: detailError } = useQuery<BuildingData | null>({
      queryKey: ['room-mapping', 'detail', activeBuildingId],
      queryFn: async () => {
          if (!activeBuildingId) return null;
          const response = await api.get(`/rooms/mapping/?building_id=${activeBuildingId}`);
          const rows = Array.isArray(response.data) ? response.data : [];
          return rows[0] ?? null;
      },
      enabled: !!activeBuildingId && viewMode === 'map' && !!canViewAll,
  });
  const detailLoading = detailPending || detailFetching;

  // Attendance records — in map view, filter by building so IDs match the room map occupants
  const { data: attendanceRecords, isLoading: recordsLoading, isError: recordsError } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', format(selectedDate, 'yyyy-MM-dd'), user?.id, viewMode, viewMode === 'map' ? activeBuildingId : 'all'],
    queryFn: async () => {
      if (viewMode === 'map' && !activeBuildingId) {
        return [];
      }
      const params: Record<string, string> = { date: format(selectedDate, 'yyyy-MM-dd') };
      // In map view, filter by building so we only get students visible on the map
      if (viewMode === 'map' && activeBuildingId) {
        params.building_id = String(activeBuildingId);
      }
      const response = await api.get('/attendance/', { params });
      const allRecords = response.data.results || response.data;
      
      // If student, filter to show only their own attendance
      if (isStudent && Array.isArray(allRecords)) {
        return allRecords.filter((record: AttendanceRecord) => record.student.id === user?.id);
      }
      return allRecords;
    },
    enabled: viewMode !== 'map' || !!activeBuildingId,
  });

  // Real-time updates for attendance and mapping
  useRealtimeQuery('attendance_updated', 'attendance');
  useRealtimeQuery('gatepass_updated', 'attendance');
  useRealtimeQuery('room_updated', 'attendance');
  useRealtimeQuery('room_allocated', 'attendance');
  useRealtimeQuery('room_deallocated', 'attendance');

  const { data: stats } = useQuery<AttendanceStats>({
    queryKey: ['attendance-stats', user?.id, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (isStudent) {
        const monthKey = format(new Date(), 'yyyy-MM');
        try {
          const response = await api.get('/attendance/monthly_summary/', {
            params: { month: monthKey }
          });
          const summary = response.data;
          const present = summary.status_breakdown?.present || 0;
          const absent = summary.status_breakdown?.absent || 0;
          const total = summary.total_days || 0;
          return {
            total_students: total,
            present_today: present,
            absent_today: absent,
            attendance_percentage: total ? Math.round((present / total) * 100) : 0
          };
        } catch {
          return {
            total_students: 0,
            present_today: 0,
            absent_today: 0,
            attendance_percentage: 0,
          };
        }
      }
      // Staff: fetch global attendance stats from the dedicated endpoint
      const response = await api.get('/attendance/stats/', {
        params: { date: format(selectedDate, 'yyyy-MM-dd') }
      });
      const s = response.data;
      return {
        total_students: s.total_students || 0,
        present_today: s.present || 0,
        absent_today: s.absent || 0,
        attendance_percentage: s.percentage || 0,
      };
    },
  });

  const { data: defaulters } = useQuery<Defaulter[]>({
    queryKey: ['attendance-defaulters'],
    queryFn: async () => {
      const response = await api.get('/attendance/defaulters/');
      return response.data.results || response.data;
    },
    enabled: !!canViewAll,
  });


  const markAttendanceMutation = useMutation({
    mutationFn: async (data: { student_id: number; status: string; date: string }) => {

      const response = await api.post('/attendance/mark/', data);

      return response.data;
    },
    onMutate: async (newData) => {
      // Requirement 5: Add console logs for debugging

      
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['attendance'] });

      const queryKey = ['attendance', format(selectedDate, 'yyyy-MM-dd'), user?.id, viewMode, viewMode === 'map' ? activeBuildingId : 'all'];

      // Snapshot previous value
      const previousRecords = queryClient.getQueryData<AttendanceRecord[]>(queryKey);

      // Optimistically update the cache
      if (previousRecords) {
        queryClient.setQueryData<AttendanceRecord[]>(
          queryKey,
          (old) => {
            const records = old || [];
            // Requirement 1 & 6: Ensure state updates correctly matches by student.id
            const existing = records.find(r => Number(r.student.id) === Number(newData.student_id));
            if (existing) {
              return records.map(r =>
                Number(r.student.id) === Number(newData.student_id)
                  ? { ...r, status: newData.status as 'present' | 'absent' }
                  : r
              );
            }
            return records;
          }
        );
      }

      return { previousRecords };
    },
    onSuccess: (data: unknown) => {
      const code = typeof (data as { code?: unknown })?.code === 'string'
        ? String((data as { code?: unknown }).code)
        : null;

      if (code === 'STUDENT_OUT_DEALLOCATED') {
        const detail = (data as { detail?: unknown })?.detail;
        toast.info(
          typeof detail === 'string'
            ? detail
            : 'Student is deallocated and outside on gate pass. Marked as out_gatepass.'
        );
      }
    },
    onError: (err, newData, context) => {
      console.error('[Attendance] Error marking attendance:', err);
      // Rollback on error
      const queryKey = ['attendance', format(selectedDate, 'yyyy-MM-dd'), user?.id, viewMode, viewMode === 'map' ? activeBuildingId : 'all'];
      if (context?.previousRecords) {
        queryClient.setQueryData(queryKey, context.previousRecords);
      }

      const code = getApiCode(err);
      if (code === 'STUDENT_DEALLOCATED') {
        toast.warning('Student is deallocated. Attendance is controlled by gate-pass outside status.');
        return;
      }
      if (code === 'STUDENT_OUT') {
        toast.warning('Student is currently outside on gate pass and cannot be marked present.');
        return;
      }
      if (code === 'HOLIDAY_ATTENDANCE_BLOCKED') {
        toast.warning('Attendance marking is blocked on this configured holiday.');
        return;
      }

      toast.error(getApiErrorMessage(err, `Failed to mark ${newData.student_id} as ${newData.status}`));
    },
    onSettled: () => {
      // Refetch after mutation settles to ensure server state
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['warden-advanced-stats'] });
    },
  });

  const markAllPresentMutation = useMutation({
    mutationFn: async (data: { status?: string, date?: string, room_id?: number, floor?: number, building_id?: number } = {}) => {
      // Default to marking all present if no args
      const payload = {
        date: format(selectedDate, 'yyyy-MM-dd'),
        status: data.status || 'present',
        ...data
      };
      await api.post('/attendance/mark-all/', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['warden-advanced-stats'] });
      toast.success('Attendance updated successfully');
    },
    onError: (error: unknown) => {
      if (getApiCode(error) === 'HOLIDAY_ATTENDANCE_BLOCKED') {
        toast.warning('Bulk attendance is blocked on this configured holiday.');
        return;
      }
      toast.error(getApiErrorMessage(error, 'Failed to update attendance'));
    },
  });

  const handleMarkAttendance = (studentId: number, status: 'present' | 'absent') => {
    if (!studentId) {
        console.warn('[Attendance] Cannot mark attendance: studentId is missing');
        return;
    }
    markAttendanceMutation.mutate({
      student_id: Number(studentId),
      status,
      date: format(selectedDate, 'yyyy-MM-dd'),
    });
  };

  const handleMarkRoomPresent = (roomId: number, roomNumber: string) => {
      markAllPresentMutation.mutate({ room_id: roomId, status: 'present' });
      toast.dismiss(); // Clear any previous
      toast.info(`Marking Room ${roomNumber}...`);
  };

  const toggleAttendance = (studentId: number, currentStatus?: string) => {
      if (!canEdit) return;
      const newStatus = currentStatus === 'present' ? 'absent' : 'present';
      handleMarkAttendance(studentId, newStatus);
  };

  const attendanceMap = useMemo(() => {
     if (!attendanceRecords) return new Map();
     return new Map(attendanceRecords.map(r => [r.student.id, r]));
  }, [attendanceRecords]);

  const currentBuilding = buildingDetail;

  const displayStats = stats;

  const statCards = [
    {
      title: isStudent ? 'Total Days' : 'Total Students',
      value: displayStats?.total_students || 0,
      icon: ClipboardCheck,
      color: 'text-foreground',
      bgColor: 'bg-secondary',
    },
    {
      title: isStudent ? 'Days Present' : 'Present Today',
      value: displayStats?.present_today || 0,
      icon: TrendingUp,
      color: 'text-foreground',
      bgColor: 'bg-primary/20',
    },
    {
      title: isStudent ? 'Days Absent' : 'Absent Today',
      value: displayStats?.absent_today || 0,
      icon: AlertTriangle,
      color: 'text-foreground',
      bgColor: 'bg-destructive/10',
    },
    {
      title: 'Attendance %',
      value: `${displayStats?.attendance_percentage?.toFixed(1) || 0}%`,
      icon: TrendingUp,
      color: 'text-foreground',
      bgColor: 'bg-secondary',
    },
  ];

  return (
    <div className="page-frame min-w-0 w-full space-y-3 sm:space-y-4 pb-6">
      <SEO 
        title={isStudent ? "My Attendance" : "Attendance Tracking"} 
        description="Comprehensive attendance management for SMG CampusCore. Track daily presence, view monthly reports, and manage compliance."
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black flex items-center gap-2 text-foreground tracking-tight">
            <div className="rounded-sm bg-success/15 p-2 text-success">
                <ClipboardCheck className="h-6 w-6" />
            </div>
            {isStudent ? 'My Attendance' : 'Attendance Management'}
          </h1>
          <p className="text-muted-foreground font-medium pl-1">{isStudent ? 'View your attendance history' : 'Track and manage student attendance'}</p>
        </div>
        
        {canViewAll && (
           <div className="flex items-center gap-2 bg-muted p-1 rounded-sm">
             <Button 
                variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('list')}
                className="gap-2"
             >
                <List className="h-4 w-4" /> List View
             </Button>
             <Button 
                variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('map')}
                className="gap-2"
             >
                <LayoutGrid className="h-4 w-4" /> Map View
             </Button>
           </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {
          statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className={`rounded-xl border border-border shadow-sm transition-all duration-300 overflow-hidden ${index === 2 ? 'border-destructive/25 bg-destructive/10 text-foreground' : 'bg-card'}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className={`text-xs font-black uppercase tracking-wider ${index === 2 ? 'text-destructive/80' : 'text-muted-foreground'}`}>{stat.title}</CardTitle>
                  <div className={`rounded-sm p-2.5 ${index === 2 ? 'bg-destructive/15 text-destructive' : 'bg-card text-foreground shadow-sm ring-1 ring-border/60'}`}>
                    <Icon className={`h-5 w-5`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-4xl font-black ${index === 2 ? 'text-foreground' : 'text-foreground'}`}>
                    {stat.value}
                  </div>
                  <p className={`mt-2 text-[10px] font-bold uppercase tracking-widest ${index === 2 ? 'text-muted-foreground' : 'text-muted-foreground'}`}>total count</p>
                </CardContent>
              </Card>
            );
          })
        }
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Calendar and Actions - Sticky on Mobile */}
        <Card className="lg:col-span-1 bg-card border border-border shadow-sm rounded-xl sticky top-20 z-10 lg:static overflow-hidden">
          <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50">
            <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-sm">
                    <CalendarIcon className="w-4 h-4 text-primary" />
                </div>
                <span>Date & Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
             <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 block">Select Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal border-border hover:bg-muted h-11 rounded-sm",
                                    !selectedDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => date && setSelectedDate(date)}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
             </div>

             {canViewAll && (
                 <Button
                  className="w-full h-10 border-primary/30 text-black hover:bg-primary/10 rounded-sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      toast.info('Downloading CSV...');
                      const dateStr = format(selectedDate, 'yyyy-MM-dd');
                      await downloadFile(`/attendance/export_csv/?date=${dateStr}`, `attendance_${dateStr}.csv`);
                      toast.success('Download complete');
                    } catch (e) {
                      toast.error('Failed to download CSV');
                    }
                  }}
                >
                  <Download className="w-4 h-4 mr-2" /> Export Report
                </Button>
             )}
          </CardContent>
        </Card>

        {/* View Content */}
        {viewMode === 'map' && canViewAll ? (
            <Card className="lg:col-span-2 bg-card border border-border shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 gap-4 bg-white/50 backdrop-blur-sm">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <MapIcon className="h-5 w-5 text-primary" />
                            Floor Map
                        </CardTitle>
                        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                            Tap a card to toggle:
                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500"></span><span className="font-bold text-emerald-700">Present</span></span>
                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500"></span><span className="font-bold text-red-700">Absent</span></span>
                            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500"></span><span className="font-bold text-blue-700">Outside</span></span>
                        </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        {buildings?.map(b => (
                            <Button 
                                key={b.id} 
                                variant={currentBuilding?.id === b.id ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedBuilding(b.id)}
                                className={`rounded-sm px-4 h-8 text-xs transition-all ${currentBuilding?.id === b.id ? 'bg-primary text-black font-bold shadow-md' : 'border-border text-foreground hover:bg-muted'}`}
                            >
                                {b.name}
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="p-0 bg-stone-50/50 min-h-[400px]">
                    {detailLoading ? (
                        <Skeleton className="h-[400px] w-full" />
                  ) : (mapSummaryError || detailError) ? (
                        <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                            <XCircle className="h-8 w-8 text-destructive/50" />
                            <p className="font-medium">Failed to load floor map</p>
                            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['room-mapping'] })}>Retry</Button>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                             {!currentBuilding || !currentBuilding.floors || currentBuilding.floors.length === 0 ? (
                                 <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                                     <MapIcon className="h-8 w-8 text-muted-foreground/30" />
                                     <p className="font-medium">No floor map data available for this building.</p>
                                 </div>
                             ) : currentBuilding.floors.map(floor => (
                                <div key={floor.floor_number} className="p-4 md:p-6 bg-white last:mb-0 mb-2 shadow-sm rounded-none first:rounded-t-none">
                                    <div className="flex justify-between items-center mb-5 sticky top-0 bg-white z-10 py-2 border-b border-dashed border-border">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="bg-primary/10 text-black border-primary/20 px-3 py-1 text-sm font-semibold rounded-sm">
                                                Floor {floor.floor_number}
                                            </Badge>
                                            <span className="text-xs font-medium text-muted-foreground">
                                                {floor.rooms.reduce((acc, r) => acc + r.occupancy, 0)} Students
                                            </span>
                                        </div>

                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {floor.rooms.map(room => {
                                            const occupants = room.beds.filter(b => b.occupant).map(b => b.occupant!);
                                            const allPresent = occupants.length > 0 && occupants.every(occ => attendanceMap.get(occ.id)?.status === 'present');
                                            
                                            return (
                                            <div key={room.id} className={`
                                                relative border rounded-sm overflow-hidden transition-all duration-300 
                                                ${allPresent ? 'bg-emerald-50 border-emerald-300 shadow-sm' : 'bg-white border-border hover:border-gray-300 shadow-sm'}
                                            `}>
                                                <div className="px-3 py-2 bg-muted/50 border-b border-border flex justify-between items-center">
                                                    <span className="font-bold text-xs text-foreground uppercase tracking-wide">Rm {room.room_number}</span>
                                                    
                                                    {occupants.length > 0 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-white rounded-sm transition-colors"
                                                            onClick={() => handleMarkRoomPresent(room.id, room.room_number)}
                                                            title="Mark Room Present"
                                                            disabled={!canEdit}
                                                        >
                                                            <CheckCheck className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                                
                                                <div className="p-2 grid grid-cols-2 gap-2">
                                                    {room.beds.map(bed => {
                                                        const occupant = bed.occupant;
                                                        if (!occupant) return (
                                                           <div key={bed.id} className="p-2 rounded-sm border border-dashed border-gray-200 bg-gray-50/30 flex flex-col items-center justify-center min-h-[70px]">
                                                                <span className="text-[10px] text-gray-400 font-medium">Empty</span>
                                                           </div>
                                                        ); 
                                                        
                                                        const record = attendanceMap.get(occupant.id);
                                                        const status = record?.status;
                                                        const isOut = !!record?.gate_pass || record?.status === 'out_gatepass';

                                                        return (
                                                            <div 
                                                                key={bed.id} 
                                                                className={`
                                                                    group/bed relative p-2.5 rounded-sm border cursor-pointer transition-all duration-300 select-none
                                                                    flex flex-col justify-center min-h-[76px]
                                                                    active:scale-[0.97]
                                                                    ${isOut
                                                                        ? 'bg-blue-500 border-blue-600 shadow-md shadow-blue-500/20'
                                                                        : status === 'present' 
                                                                            ? 'bg-emerald-500 border-emerald-600 shadow-md shadow-emerald-500/20' 
                                                                            : status === 'absent' 
                                                                                ? 'bg-red-500 border-red-600 shadow-md shadow-red-500/20' 
                                                                                : 'bg-red-500/80 border-red-500/60 shadow-sm'
                                                                    }
                                                                `}
                                                                onClick={() => {
                                                                    if (isOut) {
                                                                        toast.warning('Student is on Gate Pass — cannot toggle');
                                                                        return;
                                                                    }
                                                                    toggleAttendance(occupant.id, status)
                                                                }}
                                                            >
                                                                {/* Hover detail tooltip */}
                                                                <div className="pointer-events-none absolute left-1/2 bottom-full z-30 w-56 -translate-x-1/2 mb-2 rounded-sm border bg-popover p-3 text-left text-popover-foreground opacity-0 shadow-sm transition-opacity duration-200 group-hover/bed:opacity-100">
                                                                    <div className="text-sm font-bold leading-tight">{occupant.name}</div>
                                                                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                                                        <div>ID: <span className="font-semibold text-foreground">{(occupant.hall_ticket || occupant.registration_number || occupant.reg_no || '—').toString().toUpperCase()}</span></div>
                                                                        <div>College: <span className="font-semibold text-foreground">{occupant.college_name || occupant.college_code || '—'}</span></div>
                                                                        <div>Phone: <span className="font-semibold text-foreground">{occupant.phone || occupant.phone_number || '—'}</span></div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-xs font-bold truncate leading-tight mb-1 text-white" title={occupant.name}>
                                                                    {occupant.name}
                                                                </div>
                                                                <div className="text-[10px] font-medium flex justify-between items-center text-white/80">
                                                                    <span>{(occupant.hall_ticket || occupant.reg_no || '').slice(-8)}</span>
                                                                </div>
                                                                
                                                                {/* Status Badge */}
                                                                <div className="absolute top-1.5 right-1.5">
                                                                    {isOut ? (
                                                                        <div className="flex items-center gap-1 bg-white/30 px-1.5 py-0.5 rounded-sm text-[8px] font-black text-white uppercase tracking-wide">
                                                                            <LogOut className="w-2.5 h-2.5" />
                                                                            Outside
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            {status === 'present' && <Check className="w-3 h-3 text-white/90" strokeWidth={3} />}
                                                                            {status === 'absent' && <X className="w-3 h-3 text-white/90" strokeWidth={3} />}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {room.beds.length === 0 && (
                                                        <div className="col-span-2 text-center text-xs text-muted-foreground py-4 italic">
                                                            No beds configured
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>
                             ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        ) : (
            <Card className="lg:col-span-2 bg-card border border-border shadow-sm rounded-xl">
            <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-lg font-semibold text-gray-800">Attendance List</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {recordsLoading ? (
                    <ListSkeleton rows={8} />
                ) : recordsError ? (
                    <div className="p-12 text-center text-muted-foreground">
                        <p>Failed to load attendance records.</p>
                        <Button variant="ghost" size="sm" className="mt-2" onClick={() => queryClient.invalidateQueries({ queryKey: ['attendance'] })}>Retry</Button>
                    </div>
                ) : attendanceRecords && attendanceRecords.length > 0 ? (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow className="hover:bg-transparent border-gray-200">
                            <TableHead className="font-semibold text-black">Student Name</TableHead>
                            <TableHead className="font-semibold text-black">Room Info</TableHead>
                            <TableHead className="font-semibold text-black">Status</TableHead>
                            {canEdit && <TableHead className="font-semibold text-black text-right pr-6">Mark Attendance</TableHead>}
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {attendanceRecords.map((record) => (
                            <TableRow key={record.id} className="hover:bg-stone-50 border-gray-100">
                            <TableCell className="py-3">
                                <div className="font-medium text-black flex items-center gap-2">
                                    {record.student.name}
                                    {(record.gate_pass || record.status === 'out_gatepass') && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-primary/10 text-black border-primary/20 gap-1">
                                            <LogOut className="w-2 h-2" /> OUT
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-xs text-black font-mono mt-0.5">
                                {record.student.hall_ticket || '—'}
                                </div>
                            </TableCell>
                            <TableCell className="py-3">
                                <Badge variant="secondary" className="bg-gray-100 text-black font-normal">
                                    {record.student.room_number || 'N/A'}
                                </Badge>
                            </TableCell>
                            <TableCell className="py-3">
                                {record.gate_pass || record.status === 'out_gatepass' ? (
                                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-bold bg-primary/20 text-foreground border border-primary/30">
                                        <LogOut className="w-3 h-3 mr-1.5" />
                                        Absent (Out)
                                    </div>
                                ) : record.status === 'present' ? (
                                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-bold bg-primary/20 text-foreground">
                                        <div className="w-1.5 h-1.5 rounded-sm bg-primary mr-1.5"></div>
                                        Present
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-bold bg-muted text-foreground">
                                        <div className="w-1.5 h-1.5 rounded-sm bg-black/40 mr-1.5"></div>
                                        Absent
                                    </div>
                                )}
                            </TableCell>
                            {canEdit && (
                                <TableCell className="py-3 text-right pr-6">
                                  {(() => {
                                    const isOut = !!record.gate_pass || record.status === 'out_gatepass';
                                    return (
                                    <>
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            size="sm"
                                        className={`h-8 w-8 rounded-sm shadow-none ${record.status === 'present' && !isOut ? 'bg-primary hover:bg-primary/90 text-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                        onClick={() => !isOut && handleMarkAttendance(record.student.id, 'present')}
                                        disabled={markAttendanceMutation.isPending || isOut}
                                            variant="ghost"
                                        >
                                            <Check className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                        className={`h-8 w-8 rounded-sm shadow-none ${record.status === 'absent' || isOut ? 'bg-black hover:bg-black/90 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                        onClick={() => !isOut && handleMarkAttendance(record.student.id, 'absent')}
                                        disabled={markAttendanceMutation.isPending || isOut}
                                            variant="ghost"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    </>
                                    );
                                  })()}
                                </TableCell>
                            )}
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    </div>

                    {/* Mobile Card List View */}
                    <div className="lg:hidden p-4 space-y-4 bg-muted/20 backdrop-blur-sm">
                    {attendanceRecords.map((record) => (
                         <div key={record.id} className={cn(
                             "rounded-sm p-4 transition-all bouncy-hover flex items-center justify-between border",
                           (record.gate_pass || record.status === 'out_gatepass') ? "bg-primary/5 border-primary/20 shadow-none" : "bg-white shadow-sm"
                         )}>
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className={`relative h-12 w-12 rounded-sm flex items-center justify-center text-sm font-black transition-all shadow-inner ${
                                    (record.gate_pass || record.status === 'out_gatepass') ? 'bg-primary text-foreground shadow-primary/20' :
                                    record.status === 'present' ? 'bg-primary/20 text-black border border-primary/20' : 'bg-black text-white'
                                }`}>
                                    {record.gate_pass || record.status === 'out_gatepass' ? <LogOut className="w-5 h-5 primary-glow" /> : record.student.name.charAt(0)}
                                    {record.status === 'present' && !record.gate_pass && (
                                        <div className="absolute -top-1 -right-1 h-3 w-3 bg-success rounded-sm ring-2 ring-white" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="font-black text-foreground truncate text-[13px] tracking-tight">
                                            {record.student.name}
                                        </p>
                                        {(record.gate_pass || record.status === 'out_gatepass') && (
                                            <Badge className="h-4 px-1 text-[8px] font-black bg-primary/20 text-black border-primary/30 uppercase tracking-tighter">OUT</Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-black uppercase tracking-widest">
                                        <span>Rm: {record.student.room_number || 'N/A'}</span>
                                        <span className="h-1 w-1 rounded-sm bg-slate-300"></span>
                                        <span className="font-mono text-[9px]">{record.student.hall_ticket || '—'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    size="icon"
                                    className={cn(
                                        "h-10 w-10 rounded-sm transition-all shadow-sm active:scale-95",
                                        record.status === 'present' && !record.gate_pass 
                                            ? 'primary-gradient text-white' 
                                            : 'bg-muted text-muted-foreground/40 border border-transparent'
                                    )}
                                      onClick={() => !(record.gate_pass || record.status === 'out_gatepass') && handleMarkAttendance(record.student.id, 'present')}
                                      disabled={!!record.gate_pass || record.status === 'out_gatepass'}
                                >
                                    <Check className="w-5 h-5 font-black" />
                                </Button>
                                <Button
                                    size="icon"
                                    className={cn(
                                        "h-10 w-10 rounded-sm transition-all shadow-sm active:scale-95",
                                        record.status === 'absent' || !!record.gate_pass || record.status === 'out_gatepass' 
                                            ? 'bg-black text-white' 
                                            : 'bg-muted text-muted-foreground/40 border border-transparent'
                                    )}
                                      onClick={() => !(record.gate_pass || record.status === 'out_gatepass') && handleMarkAttendance(record.student.id, 'absent')}
                                      disabled={!!record.gate_pass || record.status === 'out_gatepass'}
                                >
                                    <X className="w-5 h-5 font-black" />
                                </Button>
                            </div>
                         </div>
                    ))}
                    </div>
                </>
                ) : (
                <div className="p-12 text-center">
                    <EmptyState
                        icon={ClipboardCheck}
                        title="No Records Found"
                        description="There are no attendance records for this date yet."
                        variant="default"
                    />
                </div>
                )}
            </CardContent>
            </Card>
        )}
      </div>

      {/* Defaulters List */}
      {canViewAll && defaulters && defaulters.length > 0 && (
        <Card className="bg-card border border-border shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Attendance Defaulters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Absent Days</TableHead>
                    <TableHead>Last Present</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defaulters.map((defaulter) => (
                    <TableRow key={defaulter.id}>
                      <TableCell>
                        <div className="font-medium text-black">{defaulter.name}</div>
                        <div className="text-sm text-black font-bold">
                          Hall Ticket: {defaulter.hall_ticket || '—'}
                        </div>
                      </TableCell>
                      <TableCell>{defaulter.room_number || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{defaulter.absent_days} days</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-black font-bold">
                        {new Date(defaulter.last_present).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
