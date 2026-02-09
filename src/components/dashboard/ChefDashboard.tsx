import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, LogOut, Utensils } from 'lucide-react';
import { useRealtimeQuery } from '@/hooks/useWebSocket';

interface ChefStats {
  total_students: number;
  students_out: number;
  expected_students: number;
}

export function ChefDashboard() {
  useRealtimeQuery('gate_scan_logged', 'chef-stats');

  const { data: stats, isLoading } = useQuery<ChefStats>({
    queryKey: ['chef-stats'],
    queryFn: async () => {
      const response = await api.get('/metrics/chef-stats/');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  if (isLoading) {
    return <div>Loading kitchen stats...</div>;
  }

  const cards = [
    {
      title: 'Total Students',
      value: stats?.total_students || 0,
      icon: Users,
      color: 'text-primary',
      description: 'Registered in hostel',
      bg: 'bg-primary/10',
    },
    {
      title: 'Currently Out',
      value: stats?.students_out || 0,
      icon: LogOut,
      color: 'text-muted-foreground',
      description: 'On leave / Gate pass',
      bg: 'bg-secondary/50',
    },
    {
      title: 'Expected for Meal',
      value: stats?.expected_students || 0,
      icon: Utensils,
      color: 'text-primary',
      description: 'In hostel premises',
      bg: 'bg-primary/10',
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Kitchen Overview</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {cards.map((card, i) => {
            const Icon = card.icon;
            return (
                <Card key={i} className="shadow-lg hover:shadow-xl transition-shadow border-0">
                  <CardHeader className={`${card.bg} rounded-t-lg pb-4`}>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg font-medium text-foreground">
                          {card.title}
                        </CardTitle>
                        <Icon className={`h-6 w-6 ${card.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="text-4xl font-extrabold mb-1">{card.value}</div>
                    <p className="text-sm text-muted-foreground">
                      {card.description}
                    </p>
                  </CardContent>
                </Card>
            )
        })}
      </div>
      
      {/* Visual Indicator */}
      <Card>
        <CardHeader>
             <CardTitle>Attendance Ratio</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="h-4 w-full bg-muted rounded-full overflow-hidden flex">
                <div 
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${((stats?.expected_students || 0) / (stats?.total_students || 1)) * 100}%` }}
                />
            </div>
            <div className="flex justify-between text-xs mt-2 text-muted-foreground">
                <span>Present</span>
                <span>Total Capacity</span>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
