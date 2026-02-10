import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ClipboardCheck, TrendingUp, AlertTriangle, LayoutGrid, List, Home, User, 
  Map as MapIcon, Calendar as CalendarIcon, CheckCircle2, CheckCheck, Check, X, 
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
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

  const { data: attendanceRecords, isLoading: recordsLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await api.get('/attendance/', {
        params: { date: format(selectedDate, 'yyyy-MM-dd') },
      });
      return response.data.results || response.data;
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<AttendanceStats>({
    queryKey: ['attendance-stats'],
    queryFn: async () => {
      const response = await api.get('/attendance/stats/');
      return response.data;
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
    onError: (error: any) => {
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
    onError: (error: any) => {
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

  const handleMarkAllPresent = () => {
      if(confirm('Mark EVERYONE present?')) {
          markAllPresentMutation.mutate({});
      }
  };

  const handleMarkFloorPresent = (floor: number, buildingId: number) => {
      if(confirm(`Mark Floor ${floor} present?`)) {
          markAllPresentMutation.mutate({ floor, building_id: buildingId, status: 'present' });
      }
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

  const statCards = [
    {
      title: 'Total Students',
      value: stats?.total_students || 0,
      icon: ClipboardCheck,
      color: 'text-[#25343F]',
      bgColor: 'bg-[#EAEFEF]',
      gradient: 'from-[#EAEFEF] to-[#BFC9D1]',
    },
    {
      title: 'Present Today',
      value: stats?.present_today || 0,
      icon: TrendingUp,
      color: 'text-[#25343F]',
      bgColor: 'bg-[#EAEFEF]',
      gradient: 'from-[#EAEFEF] to-[#BFC9D1]',
    },
    {
      title: 'Absent Today',
      value: stats?.absent_today || 0,
      icon: AlertTriangle,
      color: 'text-[#FF9B51]',
      bgColor: 'bg-rose-50',
      gradient: 'from-rose-50 to-rose-100',
    },
    {
      title: 'Attendance %',
      value: `${stats?.attendance_percentage?.toFixed(1) || 0}%`,
      icon: TrendingUp,
      color: 'text-[#25343F]',
      bgColor: 'bg-[#EAEFEF]',
      gradient: 'from-[#EAEFEF] to-[#BFC9D1]',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold flex items-center gap-2 text-black">
            <ClipboardCheck className="h-8 w-8 text-[#25343F]" />
            Attendance Management
          </h1>
          <p className="text-slate-600">Track and manage student attendance</p>
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
            <Card key={index} className="rounded-2xl">
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
              <Card key={index} className={`bg-[#EAEFEF] hover:shadow-lg transition-all duration-300 border-[#BFC9D1]/50 rounded-2xl`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-foreground">{stat.title}</CardTitle>
                  <div className={`p-3 rounded-full bg-white/60 shadow-sm`}>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar and Actions - Sticky on Mobile */}
        <Card className="lg:col-span-1 bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl sticky top-4 z-10 lg:static">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-500" />
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
                                    "w-full justify-start text-left font-normal border-gray-200 hover:bg-gray-50 h-11 rounded-xl",
                                    !selectedDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
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
                  className="w-full h-10 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl"
                  variant="outline"
                  onClick={async () => {
                    try {
                      toast.info('Downloading CSV...');
                      const dateStr = format(selectedDate, 'yyyy-MM-dd');
                      await import('@/lib/api').then(m => m.downloadFile(`/attendance/export_csv/?date=${dateStr}`, `attendance_${dateStr}.csv`));
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
            <Card className="lg:col-span-2 bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-4 gap-4 bg-white/50 backdrop-blur-sm">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <MapIcon className="h-5 w-5 text-purple-500" />
                            Floor Map
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Tap a card to toggle status. <span className="text-emerald-600 font-medium">Green = Present</span>, <span className="text-rose-500 font-medium">Red = Absent</span>.
                        </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        {buildings?.map(b => (
                            <Button 
                                key={b.id} 
                                variant={currentBuilding?.id === b.id ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedBuilding(b.id)}
                                className={`rounded-full px-4 h-8 text-xs transition-all ${currentBuilding?.id === b.id ? 'bg-slate-800 text-white shadow-md' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                            >
                                {b.name}
                            </Button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="p-0 bg-slate-50/50 min-h-[400px]">
                    {mapLoading ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-3">
                            <Loader2 className="animate-spin text-purple-500 h-8 w-8" />
                            <span className="text-sm text-muted-foreground font-medium">Loading map layout...</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                             {currentBuilding?.floors.map(floor => (
                                <div key={floor.floor_number} className="p-4 md:p-6 bg-white last:mb-0 mb-2 shadow-sm rounded-none first:rounded-t-none">
                                    <div className="flex justify-between items-center mb-5 sticky top-0 bg-white z-10 py-2 border-b border-dashed border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-100 px-3 py-1 text-sm font-semibold rounded-lg">
                                                Floor {floor.floor_number}
                                            </Badge>
                                            <span className="text-xs font-medium text-gray-400">
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
                                                ${allPresent ? 'bg-emerald-50/30 border-emerald-100 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'}
                                            `}>
                                                <div className="px-3 py-2 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                                                    <span className="font-bold text-xs text-gray-700 uppercase tracking-wide">Rm {room.room_number}</span>
                                                    
                                                    {occupants.length > 0 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-gray-400 hover:text-emerald-600 hover:bg-white rounded-full transition-colors"
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
                                                                        ? 'bg-amber-100 border-amber-300 shadow-sm'
                                                                        : status === 'present' 
                                                                            ? 'bg-emerald-500 border-emerald-600 shadow-md shadow-emerald-200' 
                                                                            : status === 'absent' 
                                                                                ? 'bg-rose-500 border-rose-600 shadow-md shadow-rose-200' 
                                                                                : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
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
                                                                <div className={`text-xs font-bold truncate leading-tight mb-1 transition-colors ${status && !isOut ? 'text-white' : 'text-gray-800'}`} title={occupant.name}>
                                                                    {occupant.name}
                                                                </div>
                                                                <div className={`text-[10px] font-medium flex justify-between items-center transition-colors ${status && !isOut ? 'text-white/80' : 'text-gray-500'}`}>
                                                                    <span>{(occupant.hall_ticket || occupant.reg_no || '').slice(-8)}</span>
                                                                </div>
                                                                
                                                                {/* Status Icon */}
                                                                <div className="absolute top-1.5 right-1.5">
                                                                    {isOut ? (
                                                                        <div className="flex items-center gap-1 bg-white/50 px-1 py-0.5 rounded text-[8px] font-bold text-amber-700 border border-amber-200">
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
            <Card className="lg:col-span-2 bg-white border border-gray-200 shadow-sm rounded-2xl">
            <CardHeader className="border-b border-gray-100 pb-4">
                <CardTitle className="text-lg font-semibold text-gray-800">Attendance List</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {recordsLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
                    <p className="text-gray-500 text-sm">Fetching records...</p>
                </div>
                ) : attendanceRecords && attendanceRecords.length > 0 ? (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow className="hover:bg-transparent border-gray-100">
                            <TableHead className="font-semibold text-gray-500">Student Name</TableHead>
                            <TableHead className="font-semibold text-gray-500">Room Info</TableHead>
                            <TableHead className="font-semibold text-gray-500">Status</TableHead>
                            {canEdit && <TableHead className="font-semibold text-gray-500 text-right pr-6">Mark Attendance</TableHead>}
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {attendanceRecords.map((record) => (
                            <TableRow key={record.id} className="hover:bg-slate-50 border-gray-100">
                            <TableCell className="py-3">
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                    {record.student.name}
                                    {record.gate_pass && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200 gap-1">
                                            <LogOut className="w-2 h-2" /> OUT
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500 font-mono mt-0.5">
                                {record.student.hall_ticket || '—'}
                                </div>
                            </TableCell>
                            <TableCell className="py-3">
                                <Badge variant="secondary" className="bg-gray-100 text-gray-600 font-normal">
                                    {record.student.room_number || 'N/A'}
                                </Badge>
                            </TableCell>
                            <TableCell className="py-3">
                                {record.status === 'present' ? (
                                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></div>
                                        Present
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></div>
                                        Absent
                                    </div>
                                )}
                            </TableCell>
                            {canEdit && (
                                <TableCell className="py-3 text-right pr-6">
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            size="sm"
                                            className={`h-8 w-8 rounded-full shadow-none ${record.status === 'present' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                            onClick={() => handleMarkAttendance(record.student.id, 'present')}
                                            disabled={markAttendanceMutation.isPending}
                                            variant="ghost"
                                        >
                                            <Check className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            className={`h-8 w-8 rounded-full shadow-none ${record.status === 'absent' ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                            onClick={() => handleMarkAttendance(record.student.id, 'absent')}
                                            disabled={markAttendanceMutation.isPending}
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
                    <div className="lg:hidden p-4 space-y-3 bg-gray-50/50">
                    {attendanceRecords.map((record) => (
                         <div key={record.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                    record.gate_pass ? 'bg-amber-100 text-amber-700' :
                                    record.status === 'present' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                                }`}>
                                    {record.gate_pass ? <LogOut className="w-5 h-5" /> : record.student.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-gray-900 truncate text-sm flex items-center gap-1">
                                        {record.student.name}
                                        {record.gate_pass && <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded border border-amber-200">OUT</span>}
                                    </p>
                                    <p className="text-xs text-gray-500 flex items-center gap-2">
                                        <span>Rm: {record.student.room_number || 'N/A'}</span>
                                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                        <span className="font-mono">{record.student.hall_ticket?.slice(-4) || '—'}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    size="icon"
                                    className={`h-9 w-9 rounded-full transition-all ${record.status === 'present' ? 'bg-emerald-500 text-white shadow-emerald-200 shadow-md' : 'bg-gray-100 text-gray-400'}`}
                                    onClick={() => handleMarkAttendance(record.student.id, 'present')}
                                >
                                    <Check className="w-5 h-5" />
                                </Button>
                                <Button
                                    size="icon"
                                    className={`h-9 w-9 rounded-full transition-all ${record.status === 'absent' ? 'bg-rose-500 text-white shadow-rose-200 shadow-md' : 'bg-gray-100 text-gray-400'}`}
                                    onClick={() => handleMarkAttendance(record.student.id, 'absent')}
                                >
                                    <X className="w-5 h-5" />
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
              <AlertTriangle className="h-5 w-5 text-[#FF9B51]" />
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
                        <div className="font-medium">{defaulter.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Hall Ticket: {defaulter.hall_ticket || '—'}
                        </div>
                      </TableCell>
                      <TableCell>{defaulter.room_number || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{defaulter.absent_days} days</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
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
