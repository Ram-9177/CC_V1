import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Calendar as CalendarIcon, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  const isWarden = user?.role === 'staff' || user?.role === 'admin';

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
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Present Today',
      value: stats?.present_today || 0,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Absent Today',
      value: stats?.absent_today || 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      title: 'Attendance %',
      value: `${stats?.attendance_percentage?.toFixed(1) || 0}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-8 w-8" />
            Attendance Management
          </h1>
          <p className="text-muted-foreground">Track and manage student attendance</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar and Actions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
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
              {isWarden && (
                <Button
                  className="w-full"
                  onClick={() => markAllPresentMutation.mutate()}
                  disabled={markAllPresentMutation.isPending}
                >
                  Mark All Present
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Attendance Records */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading attendance records...
              </div>
            ) : attendanceRecords && attendanceRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Status</TableHead>
                      {isWarden && <TableHead>Actions</TableHead>}
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
                            <Badge className="bg-green-100 text-green-800">Present</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">Absent</Badge>
                          )}
                        </TableCell>
                        {isWarden && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant={record.status === 'present' ? 'default' : 'outline'}
                                onClick={() => handleMarkAttendance(record.student.id, 'present')}
                                disabled={markAttendanceMutation.isPending}
                              >
                                Present
                              </Button>
                              <Button
                                size="sm"
                                variant={record.status === 'absent' ? 'destructive' : 'outline'}
                                onClick={() => handleMarkAttendance(record.student.id, 'absent')}
                                disabled={markAttendanceMutation.isPending}
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
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No attendance records for this date
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Defaulters List */}
      {isWarden && defaulters && defaulters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
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
