import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Calendar } from '../../ui/calendar';
import { t } from '../../../lib/i18n';
import { AttendanceStatus } from '../../../lib/types';
import { useSocketEvent } from '../../../lib/socket';
import { toast } from 'sonner';
import { myRecords as apiMyRecords } from '../../../lib/attendance';

interface AttendanceRecord {
  date: string;
  sessionName: string;
  status: AttendanceStatus;
  markedAt: string;
}

export function AttendanceView() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState({ presentCount: 0, lateCount: 0, absentCount: 0, attendanceRate: 0 });

  const load = async () => {
    try {
      const res = await apiMyRecords({});
      const mapped: AttendanceRecord[] = (res.data || []).map((r: any) => ({
        date: new Date(r.markedAt).toISOString().split('T')[0],
        sessionName: r.session?.title || 'Attendance Session',
        status: r.status,
        markedAt: r.markedAt,
      }));
      setRecords(mapped);
      const present = mapped.filter((r) => r.status === 'PRESENT').length;
      const late = mapped.filter((r) => r.status === 'LATE').length;
      const absent = mapped.filter((r) => r.status === 'ABSENT').length;
      const total = mapped.length;
      setSummary({ presentCount: present, lateCount: late, absentCount: absent, attendanceRate: total ? Math.round((present / total) * 100) : 0 });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = summary;

  useSocketEvent('attendance:marked', () => {
    load();
    toast.success('Attendance updated');
  }, true);

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'PRESENT':
        return <Badge className="bg-green-600 hover:bg-green-700">Present</Badge>;
      case 'ABSENT':
        return <Badge variant="destructive">Absent</Badge>;
      case 'LATE':
        return <Badge variant="secondary">Late</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Attendance</h1>
        <p className="text-muted-foreground">View your attendance history</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Present</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600 dark:text-green-400">{stats.presentCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Late</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-yellow-600 dark:text-yellow-400">{stats.lateCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Absent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600 dark:text-red-400">{stats.absentCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.attendanceRate}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Calendar View</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {records.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No attendance records yet
                </p>
              ) : (
                records.map((record, idx) => (
                  <div
                    key={idx}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-wrap">{record.sessionName}</span>
                      {getStatusBadge(record.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(record.markedAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
