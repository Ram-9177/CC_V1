import { safeLazy } from "@/lib/safeLazy";

import { useState, Suspense } from 'react';
import { BarChart3, Download } from 'lucide-react';
// Card components removed during UI flattening
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ResponsiveTabsNav, ReportSectionHeader } from '@/components/common/ResponsiveTabsNav';
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

const REPORT_SECTION_TABS = [
  { value: 'attendance', label: 'Attendance' },
  { value: 'rooms', label: 'Room occupancy' },
  { value: 'gate-passes', label: 'Gate passes' },
] as const;

export default function ReportsPage() {
  const [reportTab, setReportTab] = useState<string>('attendance');
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
      <div className="page-frame min-w-0 w-full pb-6">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              You don't have permission to view reports
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-frame min-w-0 w-full space-y-3 sm:space-y-4 pb-6">
      <div className="flex flex-col gap-2 text-foreground">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground">View detailed reports and analytics</p>
        </div>

      <Tabs value={reportTab} onValueChange={setReportTab} className="min-w-0 space-y-4 sm:space-y-5">
        <ResponsiveTabsNav
          value={reportTab}
          onValueChange={setReportTab}
          options={[...REPORT_SECTION_TABS]}
          selectLabel="Report type"
        />

        {/* Attendance Report Tab */}
        <TabsContent value="attendance" className="mt-0 space-y-4 focus-visible:outline-none">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <ReportSectionHeader
              title="Attendance trends"
              actions={
                <>
                  <Select value={attendancePeriod} onValueChange={setAttendancePeriod}>
                    <SelectTrigger className="h-10 w-full min-w-0 rounded-lg border-border bg-background text-sm font-medium sm:w-[11.5rem]">
                      <SelectValue placeholder="Time period" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)]">
                      <SelectItem value="week">This week</SelectItem>
                      <SelectItem value="month">This month</SelectItem>
                      <SelectItem value="year">This year</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full shrink-0 gap-2 rounded-lg border-border font-semibold sm:w-auto"
                    onClick={() => handleExport('attendance')}
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    Export CSV
                  </Button>
                </>
              }
            />
            <div className="p-4 pt-4 sm:p-6 sm:pt-4">
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
            </div>
          </div>

          {/* Attendance Summary Cards */}
          {attendanceLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-28 rounded-sm" />
              <Skeleton className="h-28 rounded-sm" />
              <Skeleton className="h-28 rounded-sm" />
            </div>
          ) : attendanceReport && attendanceReport.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-card shadow-sm p-4">
                <p className="text-sm font-medium text-muted-foreground">Average Attendance</p>
                <div className="text-2xl font-bold mt-2">
                  {(
                    attendanceReport.reduce((acc, curr) => acc + curr.percentage, 0) /
                    attendanceReport.length
                  ).toFixed(1)}
                  %
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm p-4">
                <p className="text-sm font-bold text-muted-foreground uppercase">Total Present</p>
                <div className="text-2xl font-black text-foreground mt-2">
                  {attendanceReport.reduce((acc, curr) => acc + curr.present, 0)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm p-4">
                <p className="text-sm font-bold text-muted-foreground uppercase">Total Absent</p>
                <div className="text-2xl font-black text-foreground mt-2">
                  {attendanceReport.reduce((acc, curr) => acc + curr.absent, 0)}
                </div>
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* Room Occupancy Report Tab */}
        <TabsContent value="rooms" className="mt-0 space-y-4 focus-visible:outline-none">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <ReportSectionHeader
              title="Room occupancy by floor"
              actions={
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full shrink-0 gap-2 rounded-lg border-border font-semibold sm:w-auto"
                  onClick={() => handleExport('rooms')}
                >
                  <Download className="h-4 w-4 shrink-0" />
                  Export CSV
                </Button>
              }
            />
            <div className="p-4 pt-4 sm:p-6 sm:pt-4">
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
                      <div key={floor.floor} className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-2">
                        <p className="text-sm font-semibold">Floor {floor.floor}</p>
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
                          <span className="rounded-md bg-primary/15 px-2 py-0.5 font-semibold text-foreground">
                            {floor.available}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t">
                          <span>Occupancy Rate:</span>
                          <span className="font-semibold">
                            {floor.occupancy_rate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No room data available
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Gate Pass Report Tab */}
        <TabsContent value="gate-passes" className="mt-0 space-y-4 focus-visible:outline-none">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <ReportSectionHeader
              title="Gate pass statistics"
              actions={
                <>
                  <Select value={gatePassPeriod} onValueChange={setGatePassPeriod}>
                    <SelectTrigger className="h-10 w-full min-w-0 rounded-lg border-border bg-background text-sm font-medium sm:w-[11.5rem]">
                      <SelectValue placeholder="Time period" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)]">
                      <SelectItem value="month">This month</SelectItem>
                      <SelectItem value="quarter">This quarter</SelectItem>
                      <SelectItem value="year">This year</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full shrink-0 gap-2 rounded-lg border-border font-semibold sm:w-auto"
                    onClick={() => handleExport('gate-passes')}
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    Export CSV
                  </Button>
                </>
              }
            />
            <div className="p-4 pt-4 sm:p-6 sm:pt-4">
              {gatePassLoading ? (
                <div className="space-y-4 py-2">
                  <Skeleton className="h-[400px] w-full rounded-sm" />
                </div>
              ) : gatePassReport && gatePassReport.length > 0 ? (
                <div className="h-[400px] w-full">
                  <Suspense fallback={<Skeleton className="h-full w-full rounded-sm" />}>
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
            </div>
          </div>

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
              <div className="rounded-xl border border-border bg-card shadow-sm p-4">
                <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                <div className="text-2xl font-bold mt-2">
                  {gatePassReport.reduce((acc, curr) => acc + curr.total, 0)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm p-4">
                <p className="text-sm font-bold text-muted-foreground uppercase">Approved</p>
                <div className="text-2xl font-black text-foreground mt-2">
                  {gatePassReport.reduce((acc, curr) => acc + curr.approved, 0)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm p-4">
                <p className="text-sm font-bold text-muted-foreground uppercase">Pending</p>
                <div className="text-2xl font-black text-primary mt-2">
                  {gatePassReport.reduce((acc, curr) => acc + curr.pending, 0)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rejected</p>
                <div className="mt-2 text-2xl font-bold text-destructive">
                  {gatePassReport.reduce((acc, curr) => acc + curr.rejected, 0)}
                </div>
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
