import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Calendar, QrCode, ArrowRight, Settings, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuthStore } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRScanner } from '@/components/sports/QRScanner';
import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

interface SportParticipant {
  name: string;
  role: string;
  match_group: string | null;
}

interface SportEvent {
  id: number;
  title: string;
  start_date: string;
  location: string;
  registration_count: number;
  max_participants: number | null;
  is_match_ready: boolean;
  court_details: { name: string } | null;
  participants: SportParticipant[];
}

export default function SportsDashboard() {
  const user = useAuthStore((state) => state.user);
  const [scannerOpen, setScannerOpen] = useState(false);
  const queryClient = useQueryClient();
  const [configData, setConfigData] = useState({
    id: null as number | null,
    max_bookings_per_day: '',
    max_bookings_per_week: ''
  });
  
  const isPD = ['pd', 'admin', 'super_admin'].includes(user?.role || '');
  
  const { data: courtsList } = useQuery<{ id: number; name: string; is_active: boolean }[]>({
    queryKey: ['sports-courts'],
    queryFn: async () => {
      const resp = await api.get('/events/sports-courts/');
      return resp.data.results || resp.data;
    }
  });

  useQuery<{ id: number; max_bookings_per_day: number; max_bookings_per_week: number }>({
    queryKey: ['sports-config'],
    enabled: isPD,
    queryFn: async () => {
      const resp = await api.get('/events/sports-config/');
      const data = resp.data.results?.[0] || resp.data?.[0];
      if (data) {
        setConfigData({
          id: data.id,
          max_bookings_per_day: data.max_bookings_per_day.toString(),
          max_bookings_per_week: data.max_bookings_per_week.toString()
        });
      }
      return data;
    }
  });

  const configMutation = useMutation({
    mutationFn: async (payload: { max_bookings_per_day: number; max_bookings_per_week: number }) => {
      if (configData.id) {
        await api.put(`/events/sports-config/${configData.id}/`, payload);
      } else {
        await api.post('/events/sports-config/', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sports-config'] });
      toast.success('Sports configuration updated');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to update configuration'));
    }
  });

  const { data: upcomingSports, isLoading: eventsLoading } = useQuery<SportEvent[]>({
    queryKey: ['upcoming-sports'],
    queryFn: async () => {
      const resp = await api.get('/events/events/sports_upcoming/');
      return resp.data.results || resp.data;
    },
    staleTime: 60_000,
  });

  const stats = useMemo(() => {
    const sportsEvents = upcomingSports || [];
    return {
      activeBookings: sportsEvents.length,
      totalPlayersToday: sportsEvents.reduce((acc, e) => acc + (e.registration_count || 0), 0),
      courtsOccupied: new Set(sportsEvents.map((e) => e.court_details?.name || e.location)).size,
      upcomingMatches: sportsEvents.filter((e) => e.is_match_ready).length,
    };
  }, [upcomingSports]);

  if (eventsLoading) return <BrandedLoading message="Loading Sports Analytics..." />;

  const groupedParticipants = (participants: SportParticipant[]) => {
    return participants.reduce((acc, p) => {
      const group = p.match_group || 'Unassigned';
      if (!acc[group]) acc[group] = [];
      acc[group].push(p);
      return acc;
    }, {} as Record<string, SportParticipant[]>);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          Sports Central
        </h1>
        <p className="text-muted-foreground font-medium">Monitoring campus sports activities and bookings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Active Slots" value={stats?.activeBookings || 0} icon={Calendar} description="Total slots scheduled" color="blue" />
        <StatCard title="Match Ready" value={stats?.upcomingMatches || 0} icon={Trophy} description="Minimum players met" color="emerald" />
        <StatCard title="Total Players" value={stats?.totalPlayersToday || 0} icon={Users} description="Registered today" color="amber" />
        <StatCard title="Courts in Use" value={stats?.courtsOccupied || 0} icon={QrCode} description="Active court locations" color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-[2rem] border-0 shadow-2xl shadow-black/5 overflow-hidden">
            <CardHeader className="bg-white px-8 pt-8 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-black">Active Bookings</CardTitle>
                <Button variant="ghost" className="font-bold text-primary">View All <ArrowRight className="h-4 w-4 ml-2" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingSports?.length ? (
                <div className="divide-y divide-gray-50">
                  {upcomingSports.map((event) => (
                    <div key={event.id} className="p-8 hover:bg-gray-50/50 transition-all space-y-6 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div className="h-16 w-16 rounded-3xl bg-primary/5 flex flex-col items-center justify-center border border-primary/10 shrink-0">
                            <span className="text-xl font-black text-primary">{new Date(event.start_date).getDate()}</span>
                            <span className="text-[10px] font-bold text-primary uppercase">{new Date(event.start_date).toLocaleString('default', { month: 'short' })}</span>
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-bold text-lg text-gray-900 group-hover:text-primary transition-colors">{event.title}</h4>
                            <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {new Date(event.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {event.registration_count}/{event.max_participants || '∞'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                           {event.is_match_ready ? (
                             <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 px-4 py-1 rounded-full font-bold">READY</Badge>
                           ) : (
                             <Badge variant="secondary" className="px-4 py-1 rounded-full font-bold">PENDING</Badge>
                           )}
                           <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{event.court_details?.name || 'Main Field'}</span>
                        </div>
                      </div>

                      {event.is_match_ready && event.participants.length > 0 && (
                        <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {Object.entries(groupedParticipants(event.participants)).map(([group, players]) => (
                            <div key={group} className="space-y-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">{group}</p>
                              <div className="flex flex-wrap gap-2">
                                {players.map((p, pi) => (
                                  <Badge key={pi} variant="outline" className="rounded-xl py-1 px-3 border-gray-100 bg-white font-bold text-[10px] text-gray-600">
                                    {p.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12">
                  <EmptyState icon={Trophy} title="No Active Sports" description="There are no sports bookings scheduled for today." />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="rounded-[2rem] border-0 shadow-2xl shadow-primary/10 bg-primary text-white overflow-hidden relative group">
            <div className="absolute inset-0 primary-gradient opacity-90" />
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
            <CardContent className="relative p-8 space-y-6">
              <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                <QrCode className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black">QR Verification</h3>
                <p className="text-white/80 font-medium text-sm leading-relaxed">Instantly verify student entry for sports events using the QR scanner.</p>
              </div>
              <Button onClick={() => setScannerOpen(true)} className="w-full bg-white text-primary hover:bg-white/90 font-black h-12 rounded-2xl shadow-xl">
                Open Scanner
              </Button>
            </CardContent>
          </Card>
          
          <Card className="rounded-[2rem] border-0 shadow-2xl shadow-black/5 bg-white overflow-hidden">
             <CardHeader className="px-8 pt-8 pb-4">
                <CardTitle className="text-xl font-black">Court Availability</CardTitle>
             </CardHeader>
             <CardContent className="px-8 pb-8 space-y-4">
                {courtsList?.map((court) => (
                    <CourtStatus key={court.id} name={court.name} occupied={!court.is_active} />
                ))}
                {!courtsList?.length && <p className="text-xs text-muted-foreground">No courts registered.</p>}
             </CardContent>
          </Card>
        </div>
      </div>

      {isPD && (
        <Card className="rounded-[2rem] border-0 shadow-2xl shadow-black/5 overflow-hidden bg-white">
          <CardHeader className="p-8 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-xl text-gray-500">
                <Settings className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl font-black">Booking Policies</CardTitle>
            </div>
            <p className="text-sm font-medium text-muted-foreground ml-1">Configure slot limits for all students.</p>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-end">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Daily Limit</Label>
                <Input 
                  type="number"
                  value={configData.max_bookings_per_day}
                  onChange={(e) => setConfigData({ ...configData, max_bookings_per_day: e.target.value })}
                  placeholder="e.g. 1"
                  className="rounded-2xl border-0 bg-gray-50 h-14 font-bold text-lg px-6 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Weekly Limit</Label>
                <Input 
                  type="number"
                  value={configData.max_bookings_per_week}
                  onChange={(e) => setConfigData({ ...configData, max_bookings_per_week: e.target.value })}
                  placeholder="e.g. 3"
                  className="rounded-2xl border-0 bg-gray-50 h-14 font-bold text-lg px-6 focus-visible:ring-primary"
                />
              </div>
              <Button 
                onClick={() => configMutation.mutate({
                  max_bookings_per_day: Number(configData.max_bookings_per_day),
                  max_bookings_per_week: Number(configData.max_bookings_per_week)
                })}
                disabled={configMutation.isPending}
                className="rounded-2xl h-14 font-black bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all w-full lg:w-fit px-12"
              >
                {configMutation.isPending ? 'Saving...' : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    Apply Policies
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 border-none bg-white rounded-3xl overflow-hidden">
            <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-2xl font-black tracking-tight">QR Scanner</DialogTitle>
            </DialogHeader>
            <QRScanner onClose={() => setScannerOpen(false)} />
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
    <Card className="rounded-[2rem] border-0 shadow-2xl shadow-black/5 hover:scale-[1.02] transition-transform duration-300">
      <CardContent className="p-8 space-y-4">
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${colors[color]}`}>
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

function CourtStatus({ name, occupied }: { name: string; occupied: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-bold text-gray-700">{name}</span>
      {occupied ? (
        <Badge className="bg-rose-100 text-rose-600 border-0 font-bold text-[10px]">OCCUPIED</Badge>
      ) : (
        <Badge className="bg-emerald-100 text-emerald-600 border-0 font-bold text-[10px]">AVAILABLE</Badge>
      )}
    </div>
  );
}
