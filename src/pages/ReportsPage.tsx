import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, TrendingUp, Users, Home, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function ReportsPage() {
  const [attendancePeriod, setAttendancePeriod] = useState('week');
  const [gatePassPeriod, setGatePassPeriod] = useState('month');

  const user = useAuthStore((state) => state.user);
  const isWarden = user?.role === 'staff' || user?.role === 'admin';

  const { data: attendanceReport, isLoading: attendanceLoading } = useQuery<AttendanceReport[]>({
    queryKey: ['reports-attendance', attendancePeriod],
    queryFn: async () => {
      const response = await api.get('/reports/attendance/', {
        params: { period: attendancePeriod },
      });
      return response.data;
    },
    enabled: isWarden,
  });

  const { data: roomOccupancy, isLoading: roomsLoading } = useQuery<RoomOccupancyReport[]>({
    queryKey: ['reports-rooms'],
    queryFn: async () => {
      const response = await api.get('/reports/rooms/');
      return response.data;
    },
    enabled: isWarden,
  });

  const { data: gatePassReport, isLoading: gatePassLoading } = useQuery<GatePassReport[]>({
    queryKey: ['reports-gate-passes', gatePassPeriod],
    queryFn: async () => {
      const response = await api.get('/reports/gate-passes/', {
        params: { period: gatePassPeriod },
      });
      return response.data;
    },
    enabled: isWarden,
  });

  const handleExport = async (reportType: string) => {
    try {
      const response = await api.get(`/reports/${reportType}/export/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}-report-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Report exported successfully');
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, 'Failed to export report'));
    }
  };

  if (!isWarden) {
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
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="h-8 w-8" />
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
                  onClick={() => handleExport('attendance')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading attendance data...
                </div>
              ) : attendanceReport && attendanceReport.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={attendanceReport}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="present"
                      stroke="#00C49F"
                      strokeWidth={2}
                      name="Present"
                    />
                    <Line
                      type="monotone"
                      dataKey="absent"
                      stroke="#FF8042"
                      strokeWidth={2}
                      name="Absent"
                    />
                    <Line
                      type="monotone"
                      dataKey="percentage"
                      stroke="#0088FE"
                      strokeWidth={2}
                      name="Percentage"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No attendance data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance Summary Cards */}
          {attendanceReport && attendanceReport.length > 0 && (
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
                  <CardTitle className="text-sm font-medium">Total Present</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {attendanceReport.reduce((acc, curr) => acc + curr.present, 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Absent</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {attendanceReport.reduce((acc, curr) => acc + curr.absent, 0)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Room Occupancy Report Tab */}
        <TabsContent value="rooms" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Room Occupancy by Floor</CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleExport('rooms')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              {roomsLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading room data...
                </div>
              ) : roomOccupancy && roomOccupancy.length > 0 ? (
                <div className="space-y-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={roomOccupancy}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="floor" label={{ value: 'Floor', position: 'insideBottom', offset: -5 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="occupied" fill="#00C49F" name="Occupied" />
                      <Bar dataKey="available" fill="#0088FE" name="Available" />
                    </BarChart>
                  </ResponsiveContainer>
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
                            <span className="font-semibold text-green-600">
                              {floor.occupied}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Available:</span>
                            <span className="font-semibold text-blue-600">
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
                <div className="text-center py-12 text-muted-foreground">
                  Loading gate pass data...
                </div>
              ) : gatePassReport && gatePassReport.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={gatePassReport}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="approved" stackId="a" fill="#00C49F" name="Approved" />
                    <Bar dataKey="pending" stackId="a" fill="#FFBB28" name="Pending" />
                    <Bar dataKey="rejected" stackId="a" fill="#FF8042" name="Rejected" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No gate pass data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gate Pass Summary */}
          {gatePassReport && gatePassReport.length > 0 && (
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
                  <CardTitle className="text-sm font-medium">Approved</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {gatePassReport.reduce((acc, curr) => acc + curr.approved, 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">
                    {gatePassReport.reduce((acc, curr) => acc + curr.pending, 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {gatePassReport.reduce((acc, curr) => acc + curr.rejected, 0)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
