import { safeLazy } from "@/lib/safeLazy";

import { useState, Suspense } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isWarden, ROLE_SECURITY_HEAD } from '@/lib/rbac';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAttendanceReport,
  useOccupancyReport,
  useGatePassReport,
  useExportReport,
} from '@/hooks/features/useReports';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const DashboardLineChart = safeLazy(() => import('@/components/dashboard/Charts').then(m => ({ default: m.DashboardLineChart })));
const DashboardBarChart = safeLazy(() => import('@/components/dashboard/Charts').then(m => ({ default: m.DashboardBarChart })));

interface AttendanceReport {
  date: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

interface RoomOccupancyReport {
  floor: number;
  total_rooms: number;
  occupied: number;
  available: number;
  occupancy_rate: number;
}

interface GatePassReport {
  month: string;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}

export default function ReportsPage() {
  const [attendancePeriod, setAttendancePeriod] = useState('week');
  const [gatePassPeriod, setGatePassPeriod] = useState('month');

  const user = useAuthStore((state) => state.user);
  const canViewReports = isWarden(user?.role) || user?.role === ROLE_SECURITY_HEAD;

  const { data: attendanceReport, isLoading: attendanceLoading } = useAttendanceReport<AttendanceReport>(attendancePeriod, canViewReports);

  const { data: roomOccupancy, isLoading: roomsLoading } = useOccupancyReport<RoomOccupancyReport>(canViewReports);

  const { data: gatePassReport, isLoading: gatePassLoading } = useGatePassReport<GatePassReport>(gatePassPeriod, canViewReports);

  const exportMutation = useExportReport();
  const handleExport = (reportType: string) => {
    exportMutation.mutate(reportType, {
      onSuccess: ({ data, reportType: type }) => {
        const url = window.URL.createObjectURL(new Blob([data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${type}-report-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Report exported successfully');
      },
      onError: (error: unknown) => {
        toast.error(getApiErrorMessage(error, 'Failed to export report'));
      },
    });
  };

  if (!canViewReports) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">
              You don't have permission to view reports
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2 text-foreground">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground">View detailed reports and analytics</p>
        </div>

      <Tabs defaultValue="attendance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="rooms">Room Occupancy</TabsTrigger>
          <TabsTrigger value="gate-passes">Gate Passes</TabsTrigger>
        </TabsList>

        {/* Attendance Report Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Attendance Trends</CardTitle>
              <div className="flex gap-2">
                <Select value={attendancePeriod} onValueChange={setAttendancePeriod}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-black text-foreground font-bold hover:bg-muted"
                  onClick={() => handleExport('attendance')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                <div className="space-y-4 py-2">
                  <Skeleton className="h-10 w-40" />
                  <Skeleton className="h-[400px] w-full rounded-sm" />
                </div>
              ) : attendanceReport && attendanceReport.length > 0 ? (
                <div className="h-[400px] w-full">
                  <Suspense fallback={<Skeleton className="h-full w-full rounded-sm" />}>
                    <DashboardLineChart 
                      data={attendanceReport} 
                      lines={[
                        { key: 'present', color: '#10b981', name: 'Present' },
                        { key: 'absent', color: '#ef4444', name: 'Absent' },
                        { key: 'percentage', color: '#3b82f6', name: 'Percentage', dashed: true }
                      ]}
                    />
                  </Suspense>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No attendance data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance Summary Cards */}
          {attendanceLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-28 rounded-sm" />
              <Skeleton className="h-28 rounded-sm" />
              <Skeleton className="h-28 rounded-sm" />
            </div>
          ) : attendanceReport && attendanceReport.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Average Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(
                      attendanceReport.reduce((acc, curr) => acc + curr.percentage, 0) /
                      attendanceReport.length
                    ).toFixed(1)}
                    %
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-muted-foreground uppercase">Total Present</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-foreground">
                    {attendanceReport.reduce((acc, curr) => acc + curr.present, 0)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-primary/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-muted-foreground uppercase">Total Absent</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-foreground">
                    {attendanceReport.reduce((acc, curr) => acc + curr.absent, 0)}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        {/* Room Occupancy Report Tab */}
        <TabsContent value="rooms" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Room Occupancy by Floor</CardTitle>
              <Button variant="outline" size="sm" className="border-black text-foreground font-bold hover:bg-muted" onClick={() => handleExport('rooms')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              {roomsLoading ? (
                <div className="space-y-4 py-2">
                  <Skeleton className="h-[400px] w-full rounded-sm" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-40 rounded-sm" />
                    ))}
                  </div>
                </div>
              ) : roomOccupancy && roomOccupancy.length > 0 ? (
                <div className="space-y-6">
                  <div className="h-[400px] w-full">
                    <Suspense fallback={<Skeleton className="h-full w-full rounded-sm" />}>
                      <DashboardBarChart 
                        data={roomOccupancy.map(r => ({ ...r, name: `Floor ${r.floor}`, count: r.occupied }))} 
                        bars={[{ key: 'count', fill: 'hsl(var(--primary))', name: 'Occupied' }]}
                      />
                    </Suspense>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roomOccupancy.map((floor) => (
                      <Card key={floor.floor}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Floor {floor.floor}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Total Rooms:</span>
                            <span className="font-semibold">{floor.total_rooms}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Occupied:</span>
                            <span className="font-semibold text-primary">
                              {floor.occupied}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Available:</span>
                            <span className="font-semibold text-black bg-primary/20 px-2 rounded-sm">
                              {floor.available}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm pt-2 border-t">
                            <span>Occupancy Rate:</span>
                            <span className="font-semibold">
                              {floor.occupancy_rate.toFixed(1)}%
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No room data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gate Pass Report Tab */}
        <TabsContent value="gate-passes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Gate Pass Statistics</CardTitle>
              <div className="flex gap-2">
                <Select value={gatePassPeriod} onValueChange={setGatePassPeriod}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">This Quarter</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('gate-passes')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {gatePassLoading ? (
                <div className="space-y-4 py-2">
                  <Skeleton className="h-[400px] w-full rounded-sm" />
                </div>
              ) : gatePassReport && gatePassReport.length > 0 ? (
                <div className="h-[400px] w-full">
                  <Suspense fallback={<Skeleton className="h-full w-full rounded-sm" />}>
                    {/* Simplified for now, or could create a StackedBarChart in Charts.tsx if needed */}
                    <DashboardBarChart 
                      data={gatePassReport} 
                      nameKey="month"
                      bars={[
                        { key: 'approved', fill: '#10b981', name: 'Approved' },
                        { key: 'pending', fill: '#f59e0b', name: 'Pending' },
                        { key: 'rejected', fill: '#ef4444', name: 'Rejected' }
                      ]}
                    />
                  </Suspense>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No gate pass data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gate Pass Summary */}
          {gatePassLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Skeleton className="h-28 rounded-sm" />
              <Skeleton className="h-28 rounded-sm" />
              <Skeleton className="h-28 rounded-sm" />
              <Skeleton className="h-28 rounded-sm" />
            </div>
          ) : gatePassReport && gatePassReport.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {gatePassReport.reduce((acc, curr) => acc + curr.total, 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-muted-foreground uppercase">Approved</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-foreground">
                    {gatePassReport.reduce((acc, curr) => acc + curr.approved, 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-muted-foreground uppercase">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-primary">
                    {gatePassReport.reduce((acc, curr) => acc + curr.pending, 0)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-black">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-white/60 uppercase">Rejected</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black text-primary">
                    {gatePassReport.reduce((acc, curr) => acc + curr.rejected, 0)}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
