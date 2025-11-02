import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Users, FileText, BarChart3, Shield, Activity, TrendingUp, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Analytics, type PeriodType } from '../../Analytics';
import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function AdminDashboard() {
  const navigate = useNavigate();

  const stats = {
    totalUsers: 475,
    students: 450,
    staff: 25,
    activeNow: 445,
    gatePassesToday: 89,
    attendanceRate: 94.2,
  };

  const systemHealth = [
    { metric: 'Database', status: 'healthy', value: '99.9%' },
    { metric: 'API Response', status: 'healthy', value: '45ms' },
    { metric: 'Storage Used', status: 'warning', value: '78%' },
    { metric: 'Active Sessions', status: 'healthy', value: '445' },
  ];

  // User growth trend
  const userGrowth = [
    { month: 'May', students: 420, staff: 22 },
    { month: 'Jun', students: 430, staff: 23 },
    { month: 'Jul', students: 440, staff: 24 },
    { month: 'Aug', students: 445, staff: 25 },
    { month: 'Sep', students: 448, staff: 25 },
    { month: 'Oct', students: 450, staff: 25 },
  ];

  // System usage by module
  const moduleUsage = [
    { name: 'Gate Pass', value: 450, color: '#3b82f6' },
    { name: 'Attendance', value: 445, color: '#22c55e' },
    { name: 'Meals', value: 425, color: '#f59e0b' },
    { name: 'Notices', value: 380, color: '#8b5cf6' },
  ];

  // Daily active users
  const dailyActiveUsers = [
    { day: 'Mon', users: 442 },
    { day: 'Tue', users: 448 },
    { day: 'Wed', users: 435 },
    { day: 'Thu', users: 445 },
    { day: 'Fri', users: 450 },
    { day: 'Sat', users: 428 },
    { day: 'Sun', users: 420 },
  ];

  // API performance
  const apiPerformance = [
    { endpoint: 'Auth', avgTime: 45, requests: 1250 },
    { endpoint: 'Gate Pass', avgTime: 68, requests: 890 },
    { endpoint: 'Attendance', avgTime: 52, requests: 1100 },
    { endpoint: 'Meals', avgTime: 48, requests: 1300 },
  ];

  const [period, setPeriod] = useState<PeriodType>('DAY');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and management</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.students} students, {stats.staff} staff
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Active Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600 dark:text-green-400">{stats.activeNow}</div>
            <p className="text-xs text-muted-foreground">
              {((stats.activeNow / stats.totalUsers) * 100).toFixed(1)}% online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Gate Passes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-blue-600 dark:text-blue-400">{stats.gatePassesToday}</div>
            <p className="text-xs text-muted-foreground">Today's activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.attendanceRate}%</div>
            <p className="text-xs text-muted-foreground">Average this month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/admin/users')}
            >
              <Users className="h-4 w-4" />
              Manage All Users
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/admin/reports')}
            >
              <BarChart3 className="h-4 w-4" />
              Generate Reports
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/admin/notices')}
            >
              <FileText className="h-4 w-4" />
              Broadcast Notice
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systemHealth.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${item.status === 'healthy' ? 'bg-green-500' : 'bg-orange-500'}`} />
                    <span className="text-sm">{item.metric}</span>
                  </div>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Growth Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }} 
                />
                <Legend />
                <Area type="monotone" dataKey="students" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Students" />
                <Area type="monotone" dataKey="staff" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Staff" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Module Usage Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={moduleUsage}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {moduleUsage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyActiveUsers}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" domain={[400, 460]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }} 
                />
                <Line type="monotone" dataKey="users" stroke="#8b5cf6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={apiPerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="endpoint" type="category" className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                  formatter={(value, name) => [
                    name === 'avgTime' ? `${value}ms` : value,
                    name === 'avgTime' ? 'Avg Response' : 'Total Requests'
                  ]}
                />
                <Bar dataKey="avgTime" fill="#3b82f6" name="Avg Response Time (ms)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

  <Analytics period={period} onPeriodChange={setPeriod} data={{ stats: [] }} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>User Roles Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Students</span>
                <Badge variant="secondary">450</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Wardens</span>
                <Badge variant="secondary">5</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Gatemen</span>
                <Badge variant="secondary">8</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Chefs</span>
                <Badge variant="secondary">10</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Admins</span>
                <Badge variant="secondary">2</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="text-muted-foreground">New user created</span>
                <span>2 min ago</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="text-muted-foreground">Report generated</span>
                <span>15 min ago</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="text-muted-foreground">Notice posted</span>
                <span>1 hr ago</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">CSV imported</span>
                <span>2 hrs ago</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storage & Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Database</span>
                  <span className="text-sm font-medium">7.8 GB / 10 GB</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 dark:bg-blue-400" style={{ width: '78%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Media Files</span>
                  <span className="text-sm font-medium">1.2 GB / 5 GB</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600 dark:bg-green-400" style={{ width: '24%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Backups</span>
                  <span className="text-sm font-medium">3.5 GB / 10 GB</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-600 dark:bg-purple-400" style={{ width: '35%' }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
