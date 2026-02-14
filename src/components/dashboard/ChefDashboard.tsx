import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, LogOut, Utensils, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { useRealtimeQuery, useWebSocketEvent } from '@/hooks/useWebSocket';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ChefStats {
  chef_stats: {
    daily: {
      total_students: number;
      students_out: number;
      expected_students: number;
      total_present: number;
      total_absent: number;
      total_skipped: number;
      not_eaten: number;
      meal_type: string;
    };
    trend: Array<{
      date: string;
      attendance: number;
      forecast: number;
    }>;
  };
}

export function ChefDashboard() {
  const queryClient = useQueryClient();
  
  // Realtime updates
  useRealtimeQuery('gate_scan_logged', 'chef-advanced-stats');
  useWebSocketEvent('meal_attendance_updated', () => {
    queryClient.invalidateQueries({ queryKey: ['chef-advanced-stats'] });
  });

  const { data: stats, isLoading } = useQuery<ChefStats>({
    queryKey: ['chef-advanced-stats'],
    queryFn: async () => {
      const response = await api.get('/metrics/advanced-dashboard/');
      return response.data;
    },
    refetchInterval: 30000, 
  });

  if (isLoading) {
    return <div className="p-4 text-muted-foreground animate-pulse">Syncing kitchen data...</div>;
  }

  const chefData = stats?.chef_stats;
  const daily = chefData?.daily;
  const trend = chefData?.trend;

  // Cards configuration
  const cards = [
    {
      title: 'Attended',
      value: daily?.total_present || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      description: `Consumed ${daily?.meal_type}`,
      bg: 'bg-green-50',
      border: 'border-green-200'
    },
    {
       title: 'Pending / Absent',
       value: daily?.total_absent || 0,
       icon: XCircle,
       color: 'text-orange-600',
       description: 'Yet to eat or skipped',
       bg: 'bg-orange-50',
       border: 'border-orange-200'
    },
    {
      title: 'Total Expected',
      value: daily?.expected_students || 0,
      icon: Utensils,
      color: 'text-blue-600',
      description: 'Dining capacity',
      bg: 'bg-blue-50',
      border: 'border-blue-200'
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            Kitchen Overview
            {daily?.meal_type && (
                <Badge variant="outline" className="text-base capitalize px-3 py-1 border-primary/50 text-foreground bg-background">
                    {daily.meal_type}
                </Badge>
            )}
          </h2>
          <div className="flex gap-4 text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/50">
             <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Total Students: <span className="font-bold text-foreground">{daily?.total_students}</span></span>
             </div>
             <div className="h-4 w-px bg-border"></div>
             <div className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                <span>Out: <span className="font-bold text-foreground">{daily?.students_out}</span></span>
             </div>
          </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {cards.map((card, i) => {
            const Icon = card.icon;
            return (
                <Card key={i} className={`shadow-sm hover:shadow-md transition-all border ${card.border} rounded-2xl overflow-hidden`}>
                  <CardHeader className={`${card.bg} pb-4 border-b ${card.border}`}>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground/80">
                          {card.title}
                        </CardTitle>
                        <div className="p-2 bg-white rounded-full shadow-sm ring-1 ring-black/5">
                             <Icon className={`h-5 w-5 ${card.color}`} />
                        </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="text-4xl font-black mb-1 text-foreground">{card.value}</div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                      {card.description}
                    </p>
                  </CardContent>
                </Card>
            )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Graph */}
        <Card className="lg:col-span-2 rounded-2xl shadow-sm border-border overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Attendance Trend
                    </CardTitle>
                    <Badge variant="secondary">Last 7 Days</Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                                dataKey="date" 
                                fontSize={12} 
                                tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { weekday: 'short' })}
                                stroke="#888888"
                            />
                            <YAxis fontSize={12} stroke="#888888" />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                            />
                            <Legend />
                            <Line 
                                type="monotone" 
                                dataKey="attendance" 
                                stroke="#10b981" 
                                strokeWidth={3} 
                                dot={{ r: 4, fill: '#10b981' }} 
                                activeDot={{ r: 6 }}
                                name="Actual Attendance"
                            />
                            <Line 
                                type="monotone" 
                                dataKey="forecast" 
                                stroke="#3b82f6" 
                                strokeWidth={2} 
                                strokeDasharray="5 5"
                                dot={false}
                                name="Expected Forecast"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>

        {/* Attendance Progress summary Card */}
        <Card className="rounded-2xl shadow-sm border-border">
            <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-lg">Daily Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Kitchen Capacity Met</span>
                        <span className="font-bold">{Math.round(((daily?.total_present || 0) / (daily?.expected_students || 1)) * 100)}%</span>
                    </div>
                    <div className="h-3 w-full bg-secondary/30 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-primary transition-all duration-1000"
                            style={{ width: `${((daily?.total_present || 0) / (daily?.expected_students || 1)) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mt-6">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-100">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm font-medium">Present</span>
                        </div>
                        <span className="font-bold text-green-700">{daily?.total_present}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-100">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm font-medium">Skipped</span>
                        </div>
                        <span className="font-bold text-red-700">{daily?.total_skipped}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-100">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                            <span className="text-sm font-medium">Pending</span>
                        </div>
                        <span className="font-bold text-orange-700">{daily?.not_eaten}</span>
                    </div>
                </div>

                <div className="pt-4 border-t text-xs text-muted-foreground text-center">
                    Dashboard auto-refreshes every 30s
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
