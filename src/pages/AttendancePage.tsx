import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ClipboardCheck, TrendingUp, AlertTriangle, LayoutGrid, List, 
  Map as MapIcon, Calendar as CalendarIcon, CheckCheck, Check, X, 
  Download, Loader2, LogOut 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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


interface AttendanceRecord {
  id: number;
  student: {
    id: number;
    name: string;
    hall_ticket?: string;
    room_number?: string;
  };
  date: string;
  status: 'present' | 'absent';
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
    reg_no: string;
    hall_ticket?: string;
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

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  
  const canViewAll = user?.role && ['staff', 'admin', 'super_admin', 'warden', 'head_warden', 'chef'].includes(user.role);
  const canEdit = user?.role && ['staff', 'admin', 'super_admin', 'warden', 'head_warden'].includes(user.role);
  const isStudent = user?.role === 'student';

  const { data: attendanceRecords, isLoading: recordsLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', format(selectedDate, 'yyyy-MM-dd'), user?.id],
    queryFn: async () => {
      const response = await api.get('/attendance/', {
        params: { date: format(selectedDate, 'yyyy-MM-dd') },
      });
      const allRecords = response.data.results || response.data;
      
      // If student, filter to show only their own attendance
      if (isStudent && Array.isArray(allRecords)) {
        return allRecords.filter((record: AttendanceRecord) => record.student.id === user?.id);
      }
      return allRecords;
    },
  });

  // Real-time updates for attendance and mapping
  useRealtimeQuery('attendance_updated', 'attendance');
  useRealtimeQuery('gatepass_updated', 'attendance');
  useRealtimeQuery('room_updated', 'attendance');
  useRealtimeQuery('room_allocated', 'attendance');
  useRealtimeQuery('room_deallocated', 'attendance');

  const { data: stats, isLoading: statsLoading } = useQuery<AttendanceStats>({
    queryKey: ['attendance-stats', user?.id],
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
            total_students: total, // Days recorded
            present_today: present, // Days present
            absent_today: absent, // Days absent
            attendance_percentage: total ? Math.round((present / total) * 100) : 0
          };
        } catch {
          return null;
        }
      }
      // For staff, we compute stats dynamically from the loaded records to match the UI perfectly
      return null;
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

  // Fetch Room Mapping data for Map View
  const { data: buildings, isLoading: mapLoading } = useQuery<BuildingData[]>({
      queryKey: ['room-mapping'],
      queryFn: async () => {
          const response = await api.get('/rooms/mapping/');
          return response.data;
      },
      enabled: viewMode === 'map' && !!canViewAll,
  });

  const markAttendanceMutation = useMutation({
    mutationFn: async (data: { student_id: number; status: string; date: string }) => {
      await api.post('/attendance/mark/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
      toast.success('Attendance marked successfully');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to mark attendance'));
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
      toast.success('Attendance updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to update attendance'));
    },
  });

  const handleMarkAttendance = (studentId: number, status: 'present' | 'absent') => {
    markAttendanceMutation.mutate({
      student_id: studentId,
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

  const currentBuilding = selectedBuilding 
      ? buildings?.find(b => b.id === selectedBuilding) 
      : buildings?.[0];

  const displayStats = useMemo(() => {
    if (isStudent) return stats;
    if (!attendanceRecords) return { total_students: 0, present_today: 0, absent_today: 0, attendance_percentage: 0 };
    
    const total = attendanceRecords.length;
    let present = 0;
    
    attendanceRecords.forEach(r => {
      if (r.status === 'present') present++;
    });
    
    return {
      total_students: total,
      present_today: present,
      absent_today: total - present,
      attendance_percentage: total ? (present / total) * 100 : 0
    };
  }, [attendanceRecords, stats, isStudent]);

  const statCards = [
    {
      title: isStudent ? 'Total Days' : 'Total Students',
      value: displayStats?.total_students || 0,
      icon: ClipboardCheck,
      color: 'text-foreground',
      bgColor: 'bg-secondary',
      gradient: 'from-secondary to-muted',
    },
    {
      title: isStudent ? 'Days Present' : 'Present Today',
      value: displayStats?.present_today || 0,
      icon: TrendingUp,
      color: 'text-foreground',
      bgColor: 'bg-primary/20',
      gradient: 'from-primary/10 to-primary/20',
    },
    {
      title: isStudent ? 'Days Absent' : 'Absent Today',
      value: displayStats?.absent_today || 0,
      icon: AlertTriangle,
      color: 'text-foreground',
      bgColor: 'bg-black',
      gradient: 'from-black to-stone-800',
    },
    {
      title: 'Attendance %',
      value: `${displayStats?.attendance_percentage?.toFixed(1) || 0}%`,
      icon: TrendingUp,
      color: 'text-foreground',
      bgColor: 'bg-secondary',
      gradient: 'from-secondary to-muted',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <SEO 
        title={isStudent ? "My Attendance" : "Attendance Tracking"} 
        description="Comprehensive attendance management for SMG Hostel. Track daily presence, view monthly reports, and manage compliance."
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black flex items-center gap-2 text-foreground tracking-tight">
            <div className="p-2 bg-green-100 rounded-2xl text-green-600">
                <ClipboardCheck className="h-6 w-6" />
            </div>
            {isStudent ? 'My Attendance' : 'Attendance Management'}
          </h1>
          <p className="text-muted-foreground font-medium pl-1">{isStudent ? 'View your attendance history' : 'Track and manage student attendance'}</p>
        </div>
        
        {canViewAll && (
           <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
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
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="rounded-3xl border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-12 w-12 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-24 mb-2" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className={`rounded-3xl border-0 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ${index === 2 ? 'bg-neutral-900 text-white' : index % 2 === 0 ? 'bg-green-50' : 'bg-blue-50' }`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className={`text-xs font-black uppercase tracking-wider ${index === 2 ? 'opacity-70' : 'text-muted-foreground'}`}>{stat.title}</CardTitle>
                  <div className={`p-2.5 rounded-full ${index === 2 ? 'bg-white/10 text-white' : 'bg-white/60 text-foreground shadow-sm'}`}>
                    <Icon className={`h-5 w-5`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-4xl font-black ${index === 2 ? 'text-white' : 'text-foreground'}`}>
                    {stat.value}
                  </div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${index === 2 ? 'text-white/40' : 'text-black/30'}`}>total count</p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar and Actions - Sticky on Mobile */}
        <Card className="lg:col-span-1 bg-white border-0 shadow-sm rounded-3xl sticky top-4 z-10 lg:static overflow-hidden">
          <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50">
            <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg">
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
                                    "w-full justify-start text-left font-normal border-border hover:bg-muted h-11 rounded-xl",
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
                  className="w-full h-10 border-primary/30 text-black hover:bg-primary/10 rounded-xl"
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
            <Card className="lg:col-span-2 bg-gradient-to-br from-background to-muted/20 border-0 shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 gap-4 bg-white/50 backdrop-blur-sm">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <MapIcon className="h-5 w-5 text-primary" />
                            Floor Map
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Tap a card to toggle status. <span className="text-black font-black">Present</span>, <span className="text-black font-medium">Absent</span>.
                        </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        {buildings?.map(b => (
                            <Button 
                                key={b.id} 
                                variant={currentBuilding?.id === b.id ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedBuilding(b.id)}
                                className={`rounded-full px-4 h-8 text-xs transition-all ${currentBuilding?.id === b.id ? 'bg-primary text-black font-bold shadow-md' : 'border-border text-foreground hover:bg-muted'}`}
                            >
                                {b.name}
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="p-0 bg-stone-50/50 min-h-[400px]">
                    {mapLoading ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-3">
                            <Loader2 className="animate-spin text-purple-500 h-8 w-8" />
                            <span className="text-sm text-muted-foreground font-medium">Loading map layout...</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                             {currentBuilding?.floors.map(floor => (
                                <div key={floor.floor_number} className="p-4 md:p-6 bg-white last:mb-0 mb-2 shadow-sm rounded-none first:rounded-t-none">
                                    <div className="flex justify-between items-center mb-5 sticky top-0 bg-white z-10 py-2 border-b border-dashed border-border">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="bg-primary/10 text-black border-primary/20 px-3 py-1 text-sm font-semibold rounded-lg">
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
                                                relative border rounded-2xl overflow-hidden transition-all duration-200 
                                                ${allPresent ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-white border-border hover:border-primary/30 shadow-sm'}
                                            `}>
                                                <div className="px-3 py-2 bg-muted/50 border-b border-border flex justify-between items-center">
                                                    <span className="font-bold text-xs text-foreground uppercase tracking-wide">Rm {room.room_number}</span>
                                                    
                                                    {occupants.length > 0 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-white rounded-full transition-colors"
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
                                                           <div key={bed.id} className="p-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/30 flex flex-col items-center justify-center min-h-[70px]">
                                                                <span className="text-[10px] text-gray-400 font-medium">Empty</span>
                                                           </div>
                                                        ); 
                                                        
                                                        const record = attendanceMap.get(occupant.id);
                                                        const status = record?.status;
                                                        const isOut = !!record?.gate_pass;

                                                        return (
                                                            <div 
                                                                key={bed.id} 
                                                                className={`
                                                                    relative p-2.5 rounded-xl border cursor-pointer transition-all duration-200 select-none
                                                                    flex flex-col justify-center min-h-[76px]
                                                                    active:scale-[0.98]
                                                                    ${isOut
                                                                        ? 'bg-primary/20 border-primary/40 shadow-sm'
                                                                        : status === 'present' 
                                                                            ? 'bg-primary border-primary/60 shadow-md shadow-primary/20' 
                                                                            : status === 'absent' 
                                                                                ? 'bg-black border-black shadow-md shadow-black/20' 
                                                                                : 'bg-white border-border hover:border-primary/30 hover:shadow-md'
                                                                    }
                                                                `}
                                                                onClick={() => {
                                                                    if (isOut) {
                                                                        toast.warning('Student is on Gate Pass');
                                                                        return;
                                                                    }
                                                                    toggleAttendance(occupant.id, status)
                                                                }}
                                                            >
                                                                <div className={`text-xs font-bold truncate leading-tight mb-1 transition-colors ${status && !isOut ? 'text-white' : 'text-foreground'}`} title={occupant.name}>
                                                                    {occupant.name}
                                                                </div>
                                                                <div className={`text-[10px] font-medium flex justify-between items-center transition-colors ${status && !isOut ? 'text-white/80' : 'text-muted-foreground'}`}>
                                                                    <span>{(occupant.hall_ticket || occupant.reg_no || '').slice(-8)}</span>
                                                                </div>
                                                                
                                                                {/* Status Icon */}
                                                                <div className="absolute top-1.5 right-1.5">
                                                                    {isOut ? (
                                                                        <div className="flex items-center gap-1 bg-white/50 px-1 py-0.5 rounded text-[8px] font-bold text-black border border-primary/20">
                                                                            <LogOut className="w-2.5 h-2.5" />
                                                                            OUT
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
            <Card className="lg:col-span-2 bg-white border-0 shadow-sm rounded-3xl">
            <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-lg font-semibold text-gray-800">Attendance List</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {recordsLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                    <p className="text-muted-foreground text-sm">Fetching records...</p>
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
                                    {record.gate_pass && (
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
                                {record.gate_pass ? (
                                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-foreground border border-primary/30">
                                        <LogOut className="w-3 h-3 mr-1.5" />
                                        Absent (Out)
                                    </div>
                                ) : record.status === 'present' ? (
                                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-foreground">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5"></div>
                                        Present
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted text-foreground">
                                        <div className="w-1.5 h-1.5 rounded-full bg-black/40 mr-1.5"></div>
                                        Absent
                                    </div>
                                )}
                            </TableCell>
                            {canEdit && (
                                <TableCell className="py-3 text-right pr-6">
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            size="sm"
                                            className={`h-8 w-8 rounded-full shadow-none ${record.status === 'present' && !record.gate_pass ? 'bg-primary hover:bg-primary/90 text-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                            onClick={() => !record.gate_pass && handleMarkAttendance(record.student.id, 'present')}
                                            disabled={markAttendanceMutation.isPending || !!record.gate_pass}
                                            variant="ghost"
                                        >
                                            <Check className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            className={`h-8 w-8 rounded-full shadow-none ${record.status === 'absent' || !!record.gate_pass ? 'bg-black hover:bg-black/90 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                            onClick={() => !record.gate_pass && handleMarkAttendance(record.student.id, 'absent')}
                                            disabled={markAttendanceMutation.isPending || !!record.gate_pass}
                                            variant="ghost"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
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
                             "rounded-3xl p-4 transition-all bouncy-hover flex items-center justify-between border",
                             record.gate_pass ? "bg-primary/5 border-primary/20 shadow-inner" : "bg-white shadow-md"
                         )}>
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className={`relative h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all shadow-inner ${
                                    record.gate_pass ? 'bg-primary text-foreground shadow-primary/20' :
                                    record.status === 'present' ? 'bg-primary/20 text-black border border-primary/20' : 'bg-black text-white'
                                }`}>
                                    {record.gate_pass ? <LogOut className="w-5 h-5 primary-glow" /> : record.student.name.charAt(0)}
                                    {record.status === 'present' && !record.gate_pass && (
                                        <div className="absolute -top-1 -right-1 h-3 w-3 bg-success rounded-full ring-2 ring-white" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="font-black text-foreground truncate text-[13px] tracking-tight">
                                            {record.student.name}
                                        </p>
                                        {record.gate_pass && (
                                            <Badge className="h-4 px-1 text-[8px] font-black bg-primary/20 text-black border-primary/30 uppercase tracking-tighter">OUT</Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-black uppercase tracking-widest">
                                        <span>Rm: {record.student.room_number || 'N/A'}</span>
                                        <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                                        <span className="font-mono text-[9px]">{record.student.hall_ticket || '—'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    size="icon"
                                    className={cn(
                                        "h-10 w-10 rounded-2xl transition-all shadow-lg active:scale-95",
                                        record.status === 'present' && !record.gate_pass 
                                            ? 'primary-gradient text-white shadow-primary/20' 
                                            : 'bg-muted text-muted-foreground/40 border border-transparent'
                                    )}
                                    onClick={() => !record.gate_pass && handleMarkAttendance(record.student.id, 'present')}
                                    disabled={!!record.gate_pass}
                                >
                                    <Check className="w-5 h-5 font-black" />
                                </Button>
                                <Button
                                    size="icon"
                                    className={cn(
                                        "h-10 w-10 rounded-2xl transition-all shadow-lg active:scale-95",
                                        record.status === 'absent' || !!record.gate_pass 
                                            ? 'bg-black text-white shadow-black/20' 
                                            : 'bg-muted text-muted-foreground/40 border border-transparent'
                                    )}
                                    onClick={() => !record.gate_pass && handleMarkAttendance(record.student.id, 'absent')}
                                    disabled={!!record.gate_pass}
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
        <Card className="bg-white border border-border shadow-sm">
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
