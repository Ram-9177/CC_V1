import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { CheckCircle2, Clock, Users, AlertCircle, TrendingUp, FileText, Activity, BedDouble } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Analytics, PeriodType } from '../../Analytics';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function WardenDashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = React.useState<PeriodType>('WEEK');

  const stats = {
    pendingApprovals: 12,
    totalStudents: 450,
    presentToday: 423,
    activeGatePasses: 23,
  };

  const recentApprovals = [
    { hallticket: 'HT001', name: 'Ravi Kumar', status: 'approved', time: '10:30 AM' },
    { hallticket: 'HT045', name: 'Anita Sharma', status: 'approved', time: '10:15 AM' },
    { hallticket: 'HT023', name: 'Suresh Reddy', status: 'rejected', time: '10:00 AM' },
  ];

  // Weekly attendance trend
  const attendanceTrend = [
    { day: 'Mon', rate: 96 },
    { day: 'Tue', rate: 95 },
    { day: 'Wed', rate: 93 },
    { day: 'Thu', rate: 94 },
    { day: 'Fri', rate: 97 },
    { day: 'Sat', rate: 92 },
    { day: 'Sun', rate: 91 },
  ];

  // Gate pass statistics
  const gatePassStats = [
    { time: '6 AM', count: 2 },
    { time: '9 AM', count: 8 },
    { time: '12 PM', count: 15 },
    { time: '3 PM', count: 12 },
    { time: '6 PM', count: 25 },
    { time: '9 PM', count: 18 },
  ];

  // Student presence over time
  const studentPresence = [
    { time: '8 AM', inside: 445, outside: 5 },
    { time: '12 PM', inside: 425, outside: 25 },
    { time: '4 PM', inside: 430, outside: 20 },
    { time: '8 PM', inside: 440, outside: 10 },
    { time: 'Now', inside: 423, outside: 27 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Warden Dashboard</h1>
        <p className="text-muted-foreground">Overview of hostel management</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate('/warden/approvals')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-orange-600 dark:text-orange-400">{stats.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">Require action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">Registered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Present Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600 dark:text-green-400">{stats.presentToday}</div>
            <p className="text-xs text-muted-foreground">{((stats.presentToday / stats.totalStudents) * 100).toFixed(1)}% attendance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Active Passes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-blue-600 dark:text-blue-400">{stats.activeGatePasses}</div>
            <p className="text-xs text-muted-foreground">Currently outside</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/warden/approvals')}
            >
              <Clock className="h-4 w-4" />
              Review Gate Pass Approvals ({stats.pendingApprovals})
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/warden/attendance')}
            >
              <CheckCircle2 className="h-4 w-4" />
              Take Attendance
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/warden/users')}
            >
              <Users className="h-4 w-4" />
              Manage Students (CSV)
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/warden/rooms')}
            >
              <BedDouble className="h-4 w-4" />
              Manage Rooms & Assignments
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/warden/notices')}
            >
              <FileText className="h-4 w-4" />
              Post Notice
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentApprovals.map((approval, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{approval.hallticket}</span>
                      <span className="text-muted-foreground">•</span>
                      <span>{approval.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{approval.time}</p>
                  </div>
                  <Badge variant={approval.status === 'approved' ? 'default' : 'destructive'}>
                    {approval.status}
                  </Badge>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/warden/approvals')}>
              View All Approvals
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" domain={[85, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }} 
                />
                <Area type="monotone" dataKey="rate" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gate Pass Activity (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={gatePassStats}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }} 
                />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Presence (Real-time)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={studentPresence}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="time" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }} 
              />
              <Legend />
              <Line type="monotone" dataKey="inside" stroke="#22c55e" strokeWidth={2} name="Inside Hostel" />
              <Line type="monotone" dataKey="outside" stroke="#f59e0b" strokeWidth={2} name="Outside Hostel" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Analytics
        period={period}
        onPeriodChange={setPeriod}
        data={{
          stats: [
            { label: 'Students', value: stats.totalStudents, change: 2, trend: 'up' },
            { label: 'Present Today', value: stats.presentToday, change: -1, trend: 'down' },
            { label: 'Active Passes', value: stats.activeGatePasses, change: 5, trend: 'up' },
            { label: 'Pending Approvals', value: stats.pendingApprovals, trend: 'neutral' },
          ],
          charts: {
            timeSeries: [
              { date: 'Mon', value: 95 },
              { date: 'Tue', value: 96 },
              { date: 'Wed', value: 94 },
              { date: 'Thu', value: 95 },
              { date: 'Fri', value: 97 },
              { date: 'Sat', value: 92 },
              { date: 'Sun', value: 91 },
            ],
            distribution: [
              { name: 'Block A', value: 180 },
              { name: 'Block B', value: 150 },
              { name: 'Block C', value: 120 },
            ],
            comparison: [
              { category: 'Attendance', current: 95, previous: 93 },
              { category: 'Gate Passes', current: 67, previous: 60 },
            ],
          },
        }}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Weekly Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Average Attendance</span>
                <span className="font-medium">94.2%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Gate Passes Issued</span>
                <span className="font-medium">67</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Notices Posted</span>
                <span className="font-medium">8</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerts & Reminders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">12 pending approvals</p>
                  <p className="text-xs text-muted-foreground">Requires immediate attention</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Room inspection due</p>
                  <p className="text-xs text-muted-foreground">Scheduled for next week</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
