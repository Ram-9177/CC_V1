import { safeLazy } from "@/lib/safeLazy";

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Users, Calendar, QrCode, Clock, MapPin, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuthStore } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Suspense, useState } from 'react';
import { ListSkeleton } from '@/components/common/PageSkeleton';
import type { SportCourt, CourtSlot, PDDashboardStats } from '@/types';

// QRScanner pulls in html5-qrcode (~330 kB). Lazy-load so it only
// downloads when the user actually opens the scanner dialog.
const QRScanner = safeLazy(() => import('@/components/sports/QRScanner').then(m => ({ default: m.QRScanner })));
const SportsManagement = safeLazy(() => import('@/components/sports/SportsManagement').then(m => ({ default: m.SportsManagement })));

export default function SportsDashboard() {
  const user = useAuthStore((s) => s.user);
  const [scannerOpen, setScannerOpen] = useState(false);

  const isManager = ['pt', 'pd', 'admin', 'super_admin'].includes(user?.role ?? '');
  const isPT = ['pt', 'pd', 'admin', 'super_admin'].includes(user?.role ?? '');

  const { data: pdStats } = useQuery<PDDashboardStats>({
    queryKey: ['pd-dashboard-stats'],
    queryFn: async () => { const r = await api.get('/sports/dept-requests/pd-dashboard/'); return r.data; },
    enabled: isManager,
    staleTime: 60_000,
  });

  const { data: courts = [] } = useQuery<SportCourt[]>({
    queryKey: ['sports-courts'],
    queryFn: async () => { const r = await api.get('/sports/courts/'); return r.data.results ?? r.data; },
    staleTime: 5 * 60_000,
  });

  const { data: todaySlots = [], isLoading: slotsLoading } = useQuery<CourtSlot[]>({
    queryKey: ['today-schedule'],
    queryFn: async () => { const r = await api.get('/sports/slots/today-schedule/'); return r.data; },
    staleTime: 60_000,
    enabled: isPT,
  });

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-sm">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          Sports Central
        </h1>
        <p className="text-muted-foreground font-medium">Campus sports operations dashboard. PT and PD can manage bookings, inventory, waitlists, courts and approvals here.</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-gray-100 rounded-sm p-1 gap-1 h-auto flex-wrap">
          <TabsTrigger value="overview" className="rounded-sm font-bold">Overview</TabsTrigger>
          {isPT && <TabsTrigger value="schedule" className="rounded-sm font-bold">Today's Schedule</TabsTrigger>}
          {isManager && <TabsTrigger value="manage" className="rounded-sm font-bold">Manage Courts & Grounds</TabsTrigger>}
          <TabsTrigger value="scanner" className="rounded-sm font-bold">QR Scanner</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-8">
          {isManager && pdStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard title="Bookings Today" value={pdStats.bookings_today} icon={Calendar} description="All confirmed bookings" color="blue" />
              <StatCard title="Active Players" value={pdStats.active_players} icon={Users} description="Currently playing" color="emerald" />
              <StatCard title="Courts Active" value={pdStats.courts_active} icon={MapPin} description="Open for play" color="amber" />
              <StatCard title="Match Ready" value={pdStats.match_ready} icon={Trophy} description="Min players reached" color="rose" />
              <StatCard title="Waitlist" value={pdStats.waitlisted_bookings} icon={Clock} description="Students queued for slots" color="blue" />
              <StatCard title="Low Stock Gear" value={pdStats.low_stock_items} icon={Package} description="Items near depletion" color="amber" />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded border-0 shadow-2xl shadow-black/5 overflow-hidden">
              <CardHeader className="px-8 pt-8 pb-4">
                <CardTitle className="text-xl font-black">Court Availability</CardTitle>
              </CardHeader>
              <CardContent className="px-8 pb-8 space-y-3">
                {courts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No courts registered.</p>
                ) : courts.map((court) => (
                  <CourtStatus key={court.id} name={court.name} status={court.status} />
                ))}
              </CardContent>
            </Card>

            {isManager && pdStats?.popular_sports && pdStats.popular_sports.length > 0 && (
              <Card className="rounded border-0 shadow-2xl shadow-black/5 overflow-hidden">
                <CardHeader className="px-8 pt-8 pb-4">
                  <CardTitle className="text-xl font-black">Popular Sports (30d)</CardTitle>
                </CardHeader>
                <CardContent className="px-8 pb-8 space-y-3">
                  {pdStats.popular_sports.map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <span className="text-sm font-bold text-gray-700">{s['slot__court__sport__name']}</span>
                      <Badge className="bg-primary/10 text-primary border-0 font-bold text-[10px]">{s.count} bookings</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Today's Schedule */}
        {isPT && (
          <TabsContent value="schedule" className="space-y-4">
            <h2 className="text-xl font-black">Today's Schedule</h2>
            {slotsLoading ? (
              <ListSkeleton rows={5} />
            ) : todaySlots.length === 0 ? (
              <EmptyState icon={Clock} title="No Slots Today" description="No court slots scheduled for today." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {todaySlots.map((slot) => (
                  <Card key={slot.id} className="rounded-sm border-0 shadow-lg">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-black text-gray-900">{slot.court_details?.sport_details?.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{slot.court_details?.name}</p>
                        </div>
                        <Badge className={`${slot.is_full ? 'bg-rose-100 text-rose-600' : slot.is_match_ready ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'} border-0 text-[10px] font-black uppercase`}>
                          {slot.is_full ? 'Full' : slot.is_match_ready ? 'Ready' : 'Open'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{slot.current_bookings}/{slot.max_players}</span>
                        {slot.waitlist_count > 0 && <span className="text-amber-700 font-bold">Waitlist {slot.waitlist_count}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* Manage (PD only) */}
        {isManager && (
          <TabsContent value="manage">
            <Suspense fallback={<ListSkeleton rows={10} />}>
              <SportsManagement />
            </Suspense>
          </TabsContent>
        )}

        {/* QR Scanner */}
        <TabsContent value="scanner" className="space-y-4">
          <Card className="rounded border-0 shadow-2xl shadow-primary/10 bg-primary text-white overflow-hidden relative max-w-sm">
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-sm blur-3xl" />
            <CardContent className="relative p-8 space-y-6">
              <div className="h-12 w-12 rounded-sm bg-white/20 backdrop-blur-md flex items-center justify-center">
                <QrCode className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black">QR Check-In</h3>
                <p className="text-white/80 font-medium text-sm">Verify student entry for sports slots.</p>
              </div>
              <Button onClick={() => setScannerOpen(true)} className="w-full bg-white text-primary hover:bg-white/90 font-black h-12 rounded-sm shadow-xl">
                Open Scanner
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 border-none bg-white rounded-sm overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-2xl font-black tracking-tight">QR Scanner</DialogTitle>
          </DialogHeader>
          <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading scanner…</div>}>
            <QRScanner onClose={() => setScannerOpen(false)} />
          </Suspense>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, description, color }: { title: string; value: number; icon: React.ComponentType<{ className?: string }>; description: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <Card className="rounded border-0 shadow-2xl shadow-black/5 hover:scale-[1.02] transition-transform duration-300">
      <CardContent className="p-8 space-y-4">
        <div className={`h-12 w-12 rounded-sm flex items-center justify-center ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-4xl font-black tracking-tighter text-gray-900">{value}</p>
          <div className="flex flex-col">
            <span className="text-sm font-black text-gray-400 uppercase tracking-widest">{title}</span>
            <span className="text-[10px] font-bold text-muted-foreground">{description}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CourtStatus({ name, status }: { name: string; status: string }) {
  const occupied = status !== 'open';
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-bold text-gray-700">{name}</span>
      {occupied ? (
        <Badge className="bg-rose-100 text-rose-600 border-0 font-bold text-[10px] capitalize">{status}</Badge>
      ) : (
        <Badge className="bg-emerald-100 text-emerald-600 border-0 font-bold text-[10px]">OPEN</Badge>
      )}
    </div>
  );
}
