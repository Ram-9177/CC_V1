import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Users, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  Activity, Zap, Target, ArrowUpRight, ArrowDownRight,
  UtensilsCrossed, Shield, DoorOpen
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Navigate } from 'react-router-dom'
import { PageSkeleton } from '@/components/common/PageSkeleton'

const ALLOWED_ROLES = ['admin', 'super_admin', 'principal', 'head_warden', 'security_head', 'head_chef']

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  trend?: number
  color: string
}

function KpiCard({ label, value, sub, icon: Icon, trend, color }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md group dark:bg-card">
      <div className="flex items-start justify-between">
        <div className={cn('h-11 w-11 rounded-lg flex items-center justify-center shrink-0', color)}>
          <Icon className="h-5 w-5" />
        </div>
        {trend !== undefined && (
          <div className={cn('flex items-center gap-1 text-xs font-bold', trend >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
            {trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-black text-foreground tracking-tight">{value}</p>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SectionCard({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm dark:bg-card">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/50">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-black text-sm uppercase tracking-widest text-foreground">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export default function AnalyticsPage() {
  const user = useAuthStore(s => s.user)
  const role = user?.role ?? ''

  const showHostel = ['admin', 'super_admin', 'principal', 'head_warden'].includes(role)
  const showMess = ['head_chef', 'admin', 'super_admin'].includes(role)
  const showSecurity = ['security_head', 'admin', 'super_admin'].includes(role)

  const { data: overview, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    enabled: showHostel,
    queryFn: async () => {
      const r = await api.get('/analytics/dashboard/overview/')
      return r.data
    },
    staleTime: 5 * 60_000,
  })

  const { data: drilldown } = useQuery({
    queryKey: ['analytics-drilldown'],
    enabled: showHostel,
    queryFn: async () => {
      const r = await api.get('/analytics/dashboard/drilldown/?module=all')
      return r.data
    },
    staleTime: 5 * 60_000,
  })

  const { data: metricsData } = useQuery({
    queryKey: ['metrics-analytics'],
    enabled: showHostel,
    queryFn: async () => {
      const r = await api.get('/metrics/metrics/latest/')
      return r.data.results ?? r.data
    },
    staleTime: 60_000,
  })

  const { data: messData, isLoading: messLoading } = useQuery({
    queryKey: ['analytics-mess-summary'],
    enabled: showMess,
    queryFn: async () => {
      const r = await api.get('/analytics/dashboard/mess_summary/')
      return r.data
    },
    staleTime: 5 * 60_000,
  })

  const { data: securityData, isLoading: securityLoading } = useQuery({
    queryKey: ['analytics-security-summary'],
    enabled: showSecurity,
    queryFn: async () => {
      const r = await api.get('/analytics/dashboard/security_summary/')
      return r.data
    },
    staleTime: 5 * 60_000,
  })

  if (!ALLOWED_ROLES.includes(user?.role ?? '')) {
    return <Navigate to="/dashboard" replace />
  }

  if (isLoading || messLoading || securityLoading) {
    return (
      <div className="page-frame mx-auto min-w-0 w-full max-w-6xl py-6">
        <PageSkeleton variant="analytics" />
      </div>
    )
  }

  const metrics = metricsData ?? []
  const occupancy = metrics.find((m: { metric_type: string }) => m.metric_type === 'occupancy')
  const attendance = metrics.find((m: { metric_type: string }) => m.metric_type === 'attendance')
  const mealSat = metrics.find((m: { metric_type: string }) => m.metric_type === 'meal_satisfaction')
  const activeUsers = metrics.find((m: { metric_type: string }) => m.metric_type === 'active_users')

  const hotspots: string[] = drilldown?.hotspots ?? []
  const trend: string = drilldown?.trends ?? ''
  const actions: string = drilldown?.action_items ?? ''

  const kpis: KpiCardProps[] = [
    { label: 'Room Occupancy',     value: occupancy   ? `${occupancy.value}%`  : overview?.room_occupancy_rate  ?? '—', icon: Users,        color: 'bg-blue-50 text-blue-600',    trend: 3  },
    { label: 'Attendance Rate',    value: attendance  ? `${attendance.value}%` : overview?.avg_attendance_rate  ?? '—', icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600', trend: -1 },
    { label: 'Meal Satisfaction',  value: mealSat     ? `${mealSat.value}%`    : '—',                                  icon: TrendingUp,   color: 'bg-amber-50 text-amber-600',  trend: 5  },
    { label: 'Active Users',       value: activeUsers ? activeUsers.value       : '—',                                  icon: Activity,     color: 'bg-purple-50 text-purple-600' },
    { label: 'Open Complaints',    value: overview?.open_complaints_count      ?? '—',                                  icon: AlertTriangle, color: 'bg-rose-50 text-rose-600' },
    { label: 'Pending Gate Passes', value: overview?.pending_gate_passes_count ?? '—',                                  icon: Clock,        color: 'bg-slate-100 text-slate-600' },
    { label: 'Pending Leaves',     value: overview?.pending_leave_requests     ?? '—',                                  icon: Target,       color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Unread Messages',    value: overview?.unread_messages_count      ?? '—',                                  icon: Zap,          color: 'bg-pink-50 text-pink-600' },
  ]

  return (
    <div className="page-frame mx-auto min-w-0 w-full max-w-6xl pb-8">
      <div className="page-hero-card mb-4 sm:mb-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="page-title text-2xl">Institutional Analytics</h1>
            <p className="page-lead mt-0 text-sm">Live campus intelligence — occupancy, welfare, operations</p>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
        {/* Hostel KPI Grid — admin, super_admin, principal, head_warden */}
        {showHostel && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map(k => <KpiCard key={k.label} {...k} />)}
        </div>
        )}

        {/* Drilldown insights */}
        {showHostel && (
        <div className="grid md:grid-cols-2 gap-4">
          <SectionCard title="Risk Hotspots" icon={AlertTriangle}>
            {hotspots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No active hotspots detected</p>
            ) : (
              <ul className="space-y-2">
                {hotspots.map((h, i) => (
                  <li key={i} className="flex items-center gap-3 p-3 bg-rose-50 rounded-lg border border-rose-100">
                    <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                    <span className="text-sm text-rose-700 font-medium">{h}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Trend Analysis" icon={TrendingUp}>
            {trend ? (
              <div className="space-y-3">
                <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed text-foreground">{trend}</p>
                {actions && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <Target className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs font-medium text-amber-800">{actions}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No trend data available</p>
            )}
          </SectionCard>
        </div>
        )}
        {showHostel && (
        <SectionCard title="Live System Metrics" icon={Activity}>
          {metrics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No metrics data available yet</p>
          ) : (
            <div className="space-y-2">
              {metrics.slice(0, 10).map((m: { metric_type: string; value: number; timestamp: string }, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <span className="text-sm font-medium capitalize text-foreground">
                    {m.metric_type.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(m.value, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-black text-foreground w-12 text-right">{m.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        )}

        {/* Mess/Kitchen Analytics — head_chef, admin, super_admin */}
        {showMess && (
          <>
            <div className="flex items-center gap-2.5 mt-4">
              <UtensilsCrossed className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-black text-foreground tracking-tight">Mess & Kitchen Analytics</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Meals Served Today" value={messData?.total_meals_served ?? '—'} icon={UtensilsCrossed} color="bg-amber-50 text-amber-600" />
              <KpiCard label="Average Rating" value={messData?.average_rating ? `${messData.average_rating}/5` : '—'} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
              <KpiCard label="Food Wastage (kg)" value={messData?.total_wastage_kg ?? '—'} icon={AlertTriangle} color="bg-rose-50 text-rose-600" />
              <KpiCard label="Feedback Count" value={messData?.feedback_count ?? '—'} icon={Activity} color="bg-blue-50 text-blue-600" />
            </div>
          </>
        )}

        {/* Security Analytics — security_head, admin, super_admin */}
        {showSecurity && (
          <>
            <div className="flex items-center gap-2.5 mt-4">
              <Shield className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-black text-foreground tracking-tight">Security Analytics</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total Passes Today" value={securityData?.total_passes_today ?? '—'} icon={DoorOpen} color="bg-slate-100 text-slate-600" />
              <KpiCard label="Currently Outside" value={securityData?.currently_outside ?? '—'} icon={ArrowUpRight} color="bg-rose-50 text-rose-600" />
              <KpiCard label="Returned Today" value={securityData?.returned_today ?? '—'} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
              <KpiCard label="Pending Approval" value={securityData?.pending_approval ?? '—'} icon={Clock} color="bg-amber-50 text-amber-600" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KpiCard label="Scans IN" value={securityData?.scans_in ?? '—'} icon={Shield} color="bg-green-50 text-green-600" />
              <KpiCard label="Scans OUT" value={securityData?.scans_out ?? '—'} icon={Shield} color="bg-orange-50 text-orange-600" />
              <KpiCard label="Total Scans" value={securityData?.total_scans ?? '—'} icon={Activity} color="bg-purple-50 text-purple-600" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
