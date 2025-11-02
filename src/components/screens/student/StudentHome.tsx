import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../lib/context';
import { Bell, QrCode, Calendar, UtensilsCrossed, FileText, TrendingUp, CheckCircle2, XCircle, Clock, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { HallticketChip } from '../../HallticketChip';
import { t } from '../../../lib/i18n';
import { Analytics, PeriodType } from '../../Analytics';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function StudentHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analyticsPeriod, setAnalyticsPeriod] = useState<PeriodType>('WEEK');
  
  if (!user) return null;
  
  // Weekly attendance data
  const weeklyAttendance = [
    { day: 'Mon', present: 4, total: 4 },
    { day: 'Tue', present: 4, total: 4 },
    { day: 'Wed', present: 3, total: 4 },
    { day: 'Thu', present: 4, total: 4 },
    { day: 'Fri', present: 4, total: 4 },
    { day: 'Sat', present: 2, total: 2 },
  ];

  // Meal participation data
  const mealData = [
    { name: 'Breakfast', value: 6, color: '#f59e0b' },
    { name: 'Lunch', value: 6, color: '#3b82f6' },
    { name: 'Dinner', value: 6, color: '#8b5cf6' },
  ];

  // Gate pass trend
  const gatePassTrend = [
    { month: 'Jul', count: 8 },
    { month: 'Aug', count: 12 },
    { month: 'Sep', count: 10 },
    { month: 'Oct', count: 7 },
  ];

  const recentActivity = [
    { action: 'Attendance marked', time: '8:00 AM', status: 'success' },
    { action: 'Breakfast opted in', time: '7:30 AM', status: 'success' },
    { action: 'Gate pass expired', time: 'Yesterday', status: 'info' },
  ];

  const analyticsData = {
    stats: [
      { label: t('attendance') + ' Rate', value: 95, change: 2, trend: 'up' as const },
      { label: 'Gate Passes', value: 12, change: -15, trend: 'down' as const },
      { label: 'Meals This Week', value: 18, change: 5, trend: 'up' as const },
      { label: 'Notices Read', value: 8, change: 0, trend: 'neutral' as const },
    ],
    charts: {
      timeSeries: [
        { date: 'Mon', value: 4 },
        { date: 'Tue', value: 4 },
        { date: 'Wed', value: 3 },
        { date: 'Thu', value: 4 },
        { date: 'Fri', value: 3 },
      ],
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-wrap">{t('welcome')}, {user.name}!</h1>
        <HallticketChip hallticket={user.hallticket} name={user.name} className="mt-2" />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="default" className="bg-green-600">{t('inside')}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('attendance')} Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3/4</div>
            <p className="text-xs text-muted-foreground">{t('present')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Passes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('meals')} Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3/3</div>
            <p className="text-xs text-muted-foreground">All opted in</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <Button 
              variant="outline" 
              className="h-auto p-4 flex-col gap-2"
              onClick={() => navigate('/student/gate-pass/create')}
            >
              <QrCode className="h-8 w-8 text-primary" />
              <span>New {t('gatePass')}</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto p-4 flex-col gap-2"
              onClick={() => navigate('/student/attendance')}
            >
              <Calendar className="h-8 w-8 text-green-600" />
              <span>View {t('attendance')}</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-auto p-4 flex-col gap-2"
              onClick={() => navigate('/student/meals')}
            >
              <UtensilsCrossed className="h-8 w-8 text-orange-600" />
              <span>Set {t('meals')}</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-auto p-4 flex-col gap-2"
              onClick={() => navigate('/student/notices')}
            >
              <FileText className="h-8 w-8 text-purple-600" />
              <span>View {t('notices')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyAttendance}>
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
                <Legend />
                <Bar dataKey="present" fill="#22c55e" name="Present" />
                <Bar dataKey="total" fill="#94a3b8" name="Total Sessions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meal Participation (This Week)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={mealData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {mealData.map((entry, index) => (
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
            <CardTitle>Gate Pass Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={gatePassTrend}>
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
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
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
                <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                  {activity.status === 'success' && (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  )}
                  {activity.status === 'info' && (
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/student/attendance')}>View All Activity</Button>
          </CardContent>
        </Card>
      </div>

      {/* Personal Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>My Activity {t('dashboard')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Analytics
            period={analyticsPeriod}
            onPeriodChange={setAnalyticsPeriod}
            data={analyticsData}
          />
        </CardContent>
      </Card>
    </div>
  );
}
