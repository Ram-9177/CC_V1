import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { LogIn, LogOut, Users, AlertCircle, Clock, CheckCircle2, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function GatemanDashboard() {
  const navigate = useNavigate();

  const stats = {
    totalToday: 89,
    currentlyOut: 23,
    pendingApprovals: 5,
    recentEvents: 12,
  };

  const recentActivity = [
    { hallticket: 'HT001', name: 'Ravi Kumar', action: 'EXIT', time: '10:30 AM', status: 'verified' },
    { hallticket: 'HT045', name: 'Anita Sharma', action: 'ENTRY', time: '10:25 AM', status: 'verified' },
    { hallticket: 'HT023', name: 'Suresh Reddy', action: 'EXIT', time: '10:15 AM', status: 'verified' },
    { hallticket: 'HT078', name: 'Priya Singh', action: 'ENTRY', time: '10:10 AM', status: 'verified' },
  ];

  // Hourly entry/exit pattern
  const hourlyPattern = [
    { hour: '6 AM', entries: 2, exits: 8 },
    { hour: '9 AM', entries: 15, exits: 5 },
    { hour: '12 PM', entries: 8, exits: 12 },
    { hour: '3 PM', entries: 10, exits: 8 },
    { hour: '6 PM', entries: 25, exits: 5 },
    { hour: '9 PM', entries: 18, exits: 2 },
  ];

  // Weekly traffic
  const weeklyTraffic = [
    { day: 'Mon', count: 85 },
    { day: 'Tue', count: 92 },
    { day: 'Wed', count: 78 },
    { day: 'Thu', count: 88 },
    { day: 'Fri', count: 95 },
    { day: 'Sat', count: 89 },
  ];

  // Real-time student status
  const studentStatus = [
    { time: '8 AM', inside: 445 },
    { time: '10 AM', inside: 435 },
    { time: '12 PM', inside: 425 },
    { time: '2 PM', inside: 430 },
    { time: '4 PM', inside: 428 },
    { time: 'Now', inside: 427 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Gateman Dashboard</h1>
        <p className="text-muted-foreground">Monitor entry/exit activities</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.totalToday}</div>
            <p className="text-xs text-muted-foreground">Entry/Exit events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Currently Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-orange-600 dark:text-orange-400">{stats.currentlyOut}</div>
            <p className="text-xs text-muted-foreground">Students outside</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-blue-600 dark:text-blue-400">{stats.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">In gate queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Last Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.recentEvents}</div>
            <p className="text-xs text-muted-foreground">Recent events</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate('/gateman/scan')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="bg-green-100 dark:bg-green-900/20 p-2 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              Scan QR Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Scan student QR codes for entry/exit verification</p>
            <Button className="w-full mt-4">
              Start Scanning
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate('/gateman/queue')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              Gate Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">View and manage students waiting at the gate</p>
            <Button variant="outline" className="w-full mt-4">
              View Queue ({stats.pendingApprovals})
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Entry/Exit Pattern (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={hourlyPattern}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }} 
                />
                <Legend />
                <Bar dataKey="entries" fill="#22c55e" name="Entries" />
                <Bar dataKey="exits" fill="#ef4444" name="Exits" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Traffic Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={weeklyTraffic}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }} 
                />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Presence (Real-time)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={studentStatus}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="time" className="text-xs" />
              <YAxis className="text-xs" domain={[400, 450]} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }} 
              />
              <Line type="monotone" dataKey="inside" stroke="#22c55e" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.map((activity, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${activity.action === 'EXIT' ? 'bg-red-100 dark:bg-red-900/20' : 'bg-green-100 dark:bg-green-900/20'}`}>
                    {activity.action === 'EXIT' ? (
                      <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
                    ) : (
                      <LogIn className="h-4 w-4 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{activity.hallticket}</span>
                      <span className="text-muted-foreground">•</span>
                      <span>{activity.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </Badge>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/gateman/events')}>
            View All Events
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
