import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useMetrics as useAdminMetrics,
  useHealthStatus,
  useSystemSettings,
  useUpdateSystemSettings,
} from '@/hooks/features/useAdmin';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';
import { PageSkeleton } from '@/components/common/PageSkeleton';

interface MetricItem {
  id: number;
  metric_type: string;
  value: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const metricTypes = [
  { value: 'occupancy', label: 'Occupancy Rate' },
  { value: 'attendance', label: 'Attendance Rate' },
  { value: 'meal_satisfaction', label: 'Meal Satisfaction' },
  { value: 'api_response_time', label: 'API Response Time' },
  { value: 'active_users', label: 'Active Users' },
];

export default function MetricsPage() {
  const user = useAuthStore((state) => state.user);
  const canViewMetrics = ['admin', 'super_admin', 'warden', 'head_warden', 'security_head'].includes(user?.role || '');
  const [selectedType, setSelectedType] = useState(metricTypes[0].value);
  const [averageValue, setAverageValue] = useState<number | null>(null);

  const { data: adminMetrics, isLoading: adminMetricsLoading } = useAdminMetrics(canViewMetrics);
  const { data: healthStatus, isLoading: healthLoading } = useHealthStatus(canViewMetrics);
  const {
    data: systemSettings,
    isLoading: settingsLoading,
    refetch: refetchSystemSettings,
  } = useSystemSettings(canViewMetrics);
  const updateSystemSettings = useUpdateSystemSettings();

  const { data: metrics, isLoading } = useQuery<MetricItem[]>({
    queryKey: ['metrics-latest'],
    enabled: canViewMetrics,
    queryFn: async () => {
      const response = await api.get('/metrics/metrics/latest/');
      return response.data.results || response.data;
    },
    staleTime: 60 * 1000,
  });

  const loadAverage = async () => {
    try {
      const response = await api.get(`/metrics/metrics/average/?metric_type=${selectedType}`);
      setAverageValue(response.data.average ?? null);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'Failed to load average metric'));
    }
  };

  const settingsCount =
    systemSettings && typeof systemSettings === 'object'
      ? Object.keys(systemSettings as Record<string, unknown>).length
      : 0;

  const reloadSystemSettings = () => {
    void refetchSystemSettings();
  };

  const syncSystemSettings = () => {
    if (!systemSettings || typeof systemSettings !== 'object') {
      toast.error('No settings data available to sync');
      return;
    }

    updateSystemSettings.mutate(systemSettings as Record<string, unknown>, {
      onSuccess: () => {
        toast.success('System settings synced');
      },
      onError: (error: unknown) => {
        toast.error(getApiErrorMessage(error, 'Failed to sync system settings'));
      },
    });
  };

  if (!canViewMetrics) {
    return (
      <div className="page-frame min-w-0 w-full pb-6">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="text-center py-12 text-muted-foreground">
            Metrics are available to authorized staff only.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-frame min-w-0 w-full space-y-3 sm:space-y-4 pb-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="h-8 w-8" />
          Metrics
        </h1>
        <p className="text-muted-foreground">Track system performance and utilization</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Latest Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{metrics?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{averageValue ?? '--'}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl capitalize">
              {healthLoading ? 'Loading...' : healthStatus?.status || 'unknown'}
            </div>
            <div className="text-sm text-muted-foreground">
              {healthStatus?.last_check ? new Date(healthStatus.last_check).toLocaleTimeString() : 'No recent check'}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">API Latency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {adminMetricsLoading ? '--' : adminMetrics?.api_latency_ms ?? '--'}
              {adminMetricsLoading ? '' : 'ms'}
            </div>
            <div className="text-sm text-muted-foreground">
              DB: {healthStatus?.database ? 'ok' : 'issue'} | Cache: {healthStatus?.cache ? 'ok' : 'issue'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-2xl">{settingsLoading ? '--' : settingsCount}</div>
            <div className="text-sm text-muted-foreground">settings keys loaded</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reloadSystemSettings} disabled={settingsLoading}>
              Reload
            </Button>
            <Button onClick={syncSystemSettings} disabled={settingsLoading || updateSystemSettings.isPending}>
              {updateSystemSettings.isPending ? 'Syncing...' : 'Sync'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Average Metric
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row md:items-center gap-4">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Metric type" />
            </SelectTrigger>
            <SelectContent>
              {metricTypes.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAverage}>
            Load Average
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Latest Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <PageSkeleton variant="analytics" />
          ) : metrics && metrics.length > 0 ? (
            <div className="space-y-3">
              {metrics.map((metric) => (
                <div key={metric.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <div className="font-medium capitalize">{metric.metric_type.replace('_', ' ')}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(metric.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-lg font-semibold">{metric.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No metrics found</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
