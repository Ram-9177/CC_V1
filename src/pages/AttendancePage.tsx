import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader2 } from 'lucide-react';
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
import { getApiErrorMessage } from '@/lib/utils';

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

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isAuthority = user?.role && ['staff', 'admin', 'super_admin', 'warden', 'head_warden'].includes(user.role);

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
    mutationFn: async () => {
      await api.post('/attendance/mark-all/', {
        date: format(selectedDate, 'yyyy-MM-dd'),
        status: 'present',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
      toast.success('All students marked present');
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to mark attendance'));
    },
  });

  const handleMarkAttendance = (studentId: number, status: 'present' | 'absent') => {
    markAttendanceMutation.mutate({
      student_id: studentId,
      status,
      date: format(selectedDate, 'yyyy-MM-dd'),
    });
  };

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
            <ClipboardCheck className="h-8 w-8 text-[#25343F]\" />
            Attendance Management
          </h1>
          <p className="text-slate-600">Track and manage student attendance</p>
        </div>
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
        {/* Calendar and Actions */}
        <Card className="lg:col-span-1 bg-white border border-[#BFC9D1] shadow-sm rounded-2xl hover:shadow-lg transition-all\">
          <CardHeader>
            <CardTitle className="text-foreground">Select Date</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Selected: {format(selectedDate, 'PPP')}
              </Label>
              {isAuthority && (
                <Button
                  className="w-full"
                  onClick={() => markAllPresentMutation.mutate()}
                  disabled={markAllPresentMutation.isPending}
                >
                  Mark All Present
                </Button>
              )}
               {isAuthority && (
                <Button
                  className="w-full mt-2"
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
                  Export CSV
                </Button>
               )}
            </div>
          </CardContent>
        </Card>

        {/* Attendance Records */}
        <Card className="lg:col-span-2 bg-white border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Attendance Records</CardTitle>
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#25343F] mb-2\" />
                <p className="text-muted-foreground">Loading attendance records...</p>
              </div>
            ) : attendanceRecords && attendanceRecords.length > 0 ? (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Status</TableHead>
                        {isAuthority && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className="font-medium">{record.student.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {record.student.hall_ticket || '—'}
                            </div>
                          </TableCell>
                          <TableCell>{record.student.room_number || 'N/A'}</TableCell>
                          <TableCell>
                            {record.status === 'present' ? (
                              <Badge variant="outline" className="bg-success/10 text-success border-success/20">Present</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Absent</Badge>
                            )}
                          </TableCell>
                          {isAuthority && (
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant={record.status === 'present' ? 'default' : 'outline'}
                                  onClick={() => handleMarkAttendance(record.student.id, 'present')}
                                  disabled={markAttendanceMutation.isPending}
                                  className="h-8 rounded-lg"
                                >
                                  Present
                                </Button>
                                <Button
                                  size="sm"
                                  variant={record.status === 'absent' ? 'destructive' : 'outline'}
                                  onClick={() => handleMarkAttendance(record.student.id, 'absent')}
                                  disabled={markAttendanceMutation.isPending}
                                  className="h-8 rounded-lg"
                                >
                                  Absent
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
                <div className="lg:hidden space-y-3">
                   {attendanceRecords.map((record) => (
                     <div key={record.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-border shadow-sm">
                        <div className="flex-1 min-w-0">
                           <div className="font-bold text-sm truncate">{record.student.name}</div>
                           <div className="text-[10px] text-muted-foreground font-mono truncate">
                             Room: {record.student.room_number || 'NA'} | {record.student.hall_ticket || '—'}
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                           <Button
                             size="sm"
                             variant={record.status === 'present' ? 'default' : 'outline'}
                             onClick={() => handleMarkAttendance(record.student.id, 'present')}
                             disabled={markAttendanceMutation.isPending}
                             className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                           >
                             Present
                           </Button>
                           <Button
                             size="sm"
                             variant={record.status === 'absent' ? 'destructive' : 'outline'}
                             onClick={() => handleMarkAttendance(record.student.id, 'absent')}
                             disabled={markAttendanceMutation.isPending}
                             className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                           >
                             Absent
                           </Button>
                        </div>
                     </div>
                   ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={ClipboardCheck}
                title="No attendance records for this date"
                description="Records will appear once students are marked"
                variant="default"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Defaulters List */}
      {isAuthority && defaulters && defaulters.length > 0 && (
        <Card className="bg-white border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-[#FF9B51]\" />
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
