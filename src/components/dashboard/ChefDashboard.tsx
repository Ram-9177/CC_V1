import { safeLazy } from "@/lib/safeLazy";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, LogOut, Utensils, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { useRealtimeQuery, useWebSocketEvent } from '@/hooks/useWebSocket';
import { Badge } from '@/components/ui/badge';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const DashboardLineChart = safeLazy(() => import('./Charts').then(m => ({ default: m.DashboardLineChart })));

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
      pending_special_requests?: number;
      is_peak_load?: boolean;
    };
    trend: Array<{
      date: string;
      attendance: number;
      forecast: number;
    }>;
    pending_priority_count?: number;
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
    staleTime: 2 * 60 * 1000, // 2 minutes, let realtime handle invalidation
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
       color: 'text-primary',
       description: 'Yet to eat or skipped',
       bg: 'bg-primary/10',
       border: 'border-primary/20'
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
    {
      title: 'Special Requests',
      value: daily?.pending_special_requests || 0,
      icon: Utensils,
      color: 'text-purple-600',
      description: 'Pending custom orders',
      bg: 'bg-purple-50',
      border: 'border-purple-200'
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
            {daily?.is_peak_load && (
                <Badge variant="destructive" className="animate-pulse">
                    ⚠️ HIGH LOAD
                </Badge>
            )}
          </h2>
          <div className="flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground bg-muted/30 p-2 rounded-sm border border-border/50">
             <div className="flex items-center gap-2">
                <Users className="h-3 w-3 md:h-4 md:w-4" />
                <span>Total: <span className="font-bold text-foreground">{daily?.total_students}</span></span>
             </div>
             <div className="hidden md:block h-4 w-px bg-border"></div>
             <div className="flex items-center gap-2">
                <LogOut className="h-3 w-3 md:h-4 md:w-4" />
                <span>Out: <span className="font-bold text-foreground">{daily?.students_out}</span></span>
             </div>
          </div>
      </div>

      <div className="grid gap-3 md:gap-6 grid-cols-2 md:grid-cols-4">
        {cards.map((card, i) => {
            const Icon = card.icon;
            return (
                <Card key={i} className={`shadow-sm hover:shadow-md transition-all border-0 rounded-sm md:rounded overflow-hidden ${card.bg}`}>
                  <CardContent className="p-4 md:p-6 relative">
                    <div className="absolute top-0 right-0 p-2 md:p-4 opacity-10">
                        <Icon className={`h-16 w-16 md:h-24 md:w-24 ${card.color}`} />
                    </div>
                    
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                             <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 md:p-2 bg-white/60 rounded-sm w-fit">
                                    <Icon className={`h-4 w-4 md:h-5 md:w-5 ${card.color}`} />
                                </div>
                                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-foreground/60 truncate">{card.title}</span>
                             </div>
                             <div className="text-2xl md:text-3xl lg:text-4xl font-black text-foreground mt-1 md:mt-2">{card.value}</div>
                        </div>
                        
                        <div className="mt-2 md:mt-4">
                            {card.title === 'Special Requests' && chefData?.pending_priority_count ? (
                                <Badge className="bg-purple-600 text-white animate-bounce border-0 text-[10px] md:text-xs">
                                    {chefData.pending_priority_count} HIGH
                                </Badge>
                            ) : (
                                <p className="text-[10px] md:text-xs font-semibold text-foreground/50 truncate">
                                  {card.description}
                                </p>
                            )}
                        </div>
                    </div>
                  </CardContent>
                </Card>
            )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Graph */}
        <Card className="lg:col-span-2 rounded shadow-sm border-0 bg-white overflow-hidden">
            <CardHeader className="border-b border-black/5 bg-gray-50/50">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Attendance Trend
                    </CardTitle>
                    <Badge variant="secondary" className="bg-white">Last 7 Days</Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="h-[300px] w-full">
                    <Suspense fallback={<Skeleton className="h-full w-full rounded-sm" />}>
                        <DashboardLineChart data={trend || []} />
                    </Suspense>
                </div>
            </CardContent>
        </Card>

        {/* Attendance Progress summary Card */}
        <Card className="rounded shadow-sm border-0 bg-white">
            <CardHeader className="border-b border-black/5 bg-gray-50/50">
                <CardTitle className="text-lg">Daily Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Kitchen Capacity Met</span>
                        <span className="font-bold">{Math.round(((daily?.total_present || 0) / (daily?.expected_students || 1)) * 100)}%</span>
                    </div>
                    <div className="h-3 w-full bg-secondary/30 rounded-sm overflow-hidden">
                        <div 
                            className="h-full bg-primary transition-all duration-1000"
                            style={{ width: `${((daily?.total_present || 0) / (daily?.expected_students || 1)) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mt-6">
                    <div className="flex items-center justify-between p-3 rounded-sm bg-green-50 border border-green-100">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-sm bg-green-500" />
                            <span className="text-sm font-medium">Present</span>
                        </div>
                        <span className="font-bold text-green-700">{daily?.total_present}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-sm bg-red-50 border border-red-100">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-sm bg-red-500" />
                            <span className="text-sm font-medium">Skipped</span>
                        </div>
                        <span className="font-bold text-red-700">{daily?.total_skipped}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-sm bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-sm bg-primary" />
                            <span className="text-sm font-medium">Pending</span>
                        </div>
                        <span className="font-bold text-primary">{daily?.not_eaten}</span>
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
