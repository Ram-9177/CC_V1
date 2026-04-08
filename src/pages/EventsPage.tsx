import { useMemo, useState, useEffect } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { format } from 'date-fns';
import { Calendar, MapPin, Plus, Users, Mail, User as UserIcon, Clock, QrCode, Trophy } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { isManagement, isTopLevelManagement } from '@/lib/rbac';
import {
  useEventsByFilter,
  useEventRegistrations,
  useSportsCourts,
  useRegisterEvent,
  useCreateEvent,
} from '@/hooks/features/useEvents';

interface EventItem {
  id: number;
  title: string;
  event_type: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  organizer?: number | null;
  organizer_details?: {
    id: number;
    name: string;
    role: string;
    email: string;
  } | null;
  max_participants?: number | null;
  min_players?: number | null;
  court?: number | null;
  court_details?: {
    id: number;
    name: string;
    sport_name: string;
    location_details: string;
  } | null;
  is_match_ready?: boolean;
  is_mandatory: boolean;
  registration_count?: number;
  vacancy?: number | null;
  created_at: string;
  updated_at: string;
  external_link?: string | null;
  target_audience?: 'hostellers' | 'day_scholars' | 'all_students' | 'staff' | 'all';
  image?: string | null;
}

interface EventRegistration {
  id: number;
  event: number;
  student: number;
  status: 'registered' | 'attended' | 'absent' | 'cancelled';
  created_at: string;
  event_details?: EventItem;
  student_details?: {
    id: number;
    name: string;
    email: string;
    registration_number: string;
  };
  qr_code_reference?: string | null;
  match_group_id?: string | null;
  check_in_time?: string | null;
}


const eventTypeOptions = [
  { value: 'sports', label: 'Sports' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'educational', label: 'Educational' },
  { value: 'social', label: 'Social' },
  { value: 'maintenance', label: 'Maintenance' },
];

export default function EventsPage() {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewRegistrationsEventId, setViewRegistrationsEventId] = useState<number | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState<{ open: boolean; registration: EventRegistration | null }>({
    open: false,
    registration: null,
  });

  const [formData, setFormData] = useState({
    title: '',
    event_type: 'sports',
    description: '',
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '10:00',
    location: '',
    max_participants: '',
    min_players: '',
    court: '',
    is_mandatory: false,
    external_link: '',
    target_audience: 'all_students',
    image: null as File | null,
  });

  const { data: courts } = useSportsCourts();

  const user = useAuthStore((state) => state.user);
  const canManageEvents = isManagement(user?.role) || ['chef', 'head_chef'].includes(user?.role || '');
  const isAdmin = canManageEvents; // For backward compatibility in this component

  useRealtimeQuery('event_created', 'events');
  useRealtimeQuery('event_updated', 'events');
  useRealtimeQuery('event_deleted', 'events');
  
  useRealtimeQuery('event_registration_created', 'event-registrations');
  useRealtimeQuery('event_registration_updated', 'event-registrations');

  const { data: events, isLoading } = useEventsByFilter<EventItem>(filter);

  // Handle view_registrations URL param
  useEffect(() => {
    if (events && !viewRegistrationsEventId) {
      const searchParams = new URLSearchParams(window.location.search);
      const viewId = searchParams.get('view_registrations');
      if (viewId) {
        setViewRegistrationsEventId(parseInt(viewId));
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [events, viewRegistrationsEventId]);

  const { data: registrations } = useEventRegistrations<EventRegistration>();

  const registeredEventIds = useMemo(() => {
    if (!user?.id) return new Set<number>();
    return new Set(
      (registrations || [])
        .filter((registration) => registration.student === user.id || registration.student_details?.id === user.id)
        .map((registration) => registration.event)
    );
  }, [registrations, user?.id]);

  const registerMutation = useRegisterEvent();

  const createEventHook = useCreateEvent();
  const createMutation = {
    ...createEventHook,
    mutate: () => {
      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('event_type', formData.event_type);
      payload.append('description', formData.description);
      
      const start = formData.start_date ? `${formData.start_date}T${formData.start_time || '00:00'}:00` : '';
      const end = formData.end_date ? `${formData.end_date}T${formData.end_time || '00:00'}:00` : '';
      if (start) payload.append('start_date', start);
      if (end) payload.append('end_date', end);
      
      payload.append('location', formData.location);
      payload.append('is_mandatory', String(formData.is_mandatory));
      if (formData.external_link) payload.append('external_link', formData.external_link);
      if (formData.max_participants) payload.append('max_participants', formData.max_participants);
      if (formData.min_players) payload.append('min_players', formData.min_players);
      if (formData.court) payload.append('court', formData.court);
      if (formData.target_audience) payload.append('target_audience', formData.target_audience);
      if (formData.image) payload.append('image', formData.image);

      createEventHook.mutate(payload, {
        onSuccess: () => {
          toast.success('Event created successfully');
          setCreateDialogOpen(false);
          setFormData({
            title: '',
            event_type: 'sports',
            description: '',
            start_date: '',
            start_time: '09:00',
            end_date: '',
            end_time: '10:00',
            location: '',
            max_participants: '',
            is_mandatory: false,
            external_link: '',
            image: null,
            min_players: '',
            court: '',
            target_audience: 'all_students',
          });
        },
        onError: (error: unknown) => {
          toast.error(getApiErrorMessage(error, 'Failed to create event'));
        },
      });
    },
  };

    const getTypeBadge = (type: string, onHero = false) => {
      const colorMap: Record<string, { hero: string; card: string }> = {
        sports: {
          hero: 'bg-primary text-white border-primary shadow-primary/30',
          card: 'bg-primary/10 text-primary border-primary/20 shadow-primary/10',
        },
        cultural: {
          hero: 'bg-purple-500 text-white border-purple-400 shadow-purple-500/30',
          card: 'bg-purple-500/10 text-purple-700 border-purple-200 shadow-purple-500/10',
        },
        educational: {
          hero: 'bg-blue-500 text-white border-blue-400 shadow-blue-500/30',
          card: 'bg-blue-500/10 text-blue-700 border-blue-200 shadow-blue-500/10',
        },
        social: {
          hero: 'bg-rose-500 text-white border-rose-400 shadow-rose-500/30',
          card: 'bg-rose-500/10 text-rose-700 border-rose-200 shadow-rose-500/10',
        },
        maintenance: {
          hero: 'bg-slate-500 text-white border-slate-400 shadow-slate-500/30',
          card: 'bg-slate-500/10 text-slate-700 border-slate-200 shadow-slate-500/10',
        },
      };
      const colors = colorMap[type] || { hero: 'bg-gray-500 text-white', card: 'bg-muted text-black' };
    return <Badge className={`font-bold border px-3 py-1 rounded-sm shadow-sm capitalize ${onHero ? colors.hero : colors.card}`}>{type}</Badge>;
  };

  return (
    <div className="page-align-shell">
      <div className="page-align-header">
        <div className="page-align-title">
          <h1 className="text-3xl font-black flex items-center gap-3 tracking-tight">
            <div className="p-2.5 bg-primary/10 rounded-sm">
              <Calendar className="h-7 w-7 text-primary" />
            </div>
            Events
          </h1>
          <p className="page-align-subtitle ml-1">Manage and register for hostel events</p>
        </div>
        <div className="page-align-actions">
          <div className="flex bg-white rounded-sm p-1 shadow-sm ring-1 ring-black/5">
            {(['upcoming', 'past', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-xs font-bold rounded-sm transition-all capitalize ${
                  filter === f 
                  ? 'bg-gray-900 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {f === 'all' ? 'All Events' : f}
              </button>
            ))}
          </div>
          {isAdmin && (
            <Button onClick={() => setCreateDialogOpen(true)} className="primary-gradient text-white font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 rounded-sm px-5 py-2.5 transition-all active:scale-95">
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <PageSkeleton variant="cards" />
      ) : events && events.length > 0 ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {events.map((event) => {
            const isRegistered = registeredEventIds.has(event.id);
            const capacityText = event.max_participants
              ? `${event.registration_count || 0}/${event.max_participants}`
              : `${event.registration_count || 0}`;
            
            const eventDate = new Date(event.start_date);
            const day = eventDate.getDate();
            const month = eventDate.toLocaleString('default', { month: 'short' });

            let registrationButtonClasses = "rounded-sm font-bold transition-all active:scale-95";
            if (isRegistered) {
                registrationButtonClasses = cn(registrationButtonClasses, "bg-slate-100 text-muted-foreground border-0");
            } else if (event.vacancy === 0) {
                registrationButtonClasses = cn(registrationButtonClasses, "bg-rose-50 text-rose-500 border border-rose-100");
            } else {
                registrationButtonClasses = cn(registrationButtonClasses, "primary-gradient text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30");
            }

            return (
              <Card key={event.id} className="group overflow-hidden rounded-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-white backdrop-blur-md">
                <div className="relative h-52 overflow-hidden">
                   {event.image ? (
                     <div className="absolute inset-0">
                       <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent group-hover:from-black/80 transition-colors" />
                     </div>
                   ) : (
                     <div className="absolute inset-0">
                       <div className="absolute inset-0 primary-gradient" />
                       {/* Decorative pattern */}
                       <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 50%, white 2px, transparent 2px), radial-gradient(circle at 75% 50%, white 2px, transparent 2px)', backgroundSize: '30px 30px' }} />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                     </div>
                   )}
                   <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                      <div className="absolute top-4 left-4 flex flex-col items-center justify-center bg-white/95 backdrop-blur-md rounded-sm h-16 w-16 shadow-lg">
                         <span className="text-2xl font-black leading-none text-gray-900">{day}</span>
                         <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{month}</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex gap-2">
                           {getTypeBadge(event.event_type, true)}
                             {event.is_mandatory && (
                                <Badge className="bg-white text-gray-900 border-0 font-black uppercase tracking-tighter rounded-sm px-3 shadow-md">Mandatory</Badge>
                             )}
                             {event.target_audience && event.target_audience !== 'all_students' && (
                               <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm font-black uppercase tracking-tighter rounded-sm px-3 shadow-md">
                                 {event.target_audience === 'hostellers' ? 'Hostellers' : 
                                  event.target_audience === 'day_scholars' ? 'Day Scholars' : 
                                  event.target_audience === 'staff' ? 'Staff Only' : 
                                  event.target_audience}
                               </Badge>
                             )}
                             {event.is_match_ready && (
                               <Badge className="bg-emerald-500 text-white border-0 font-black uppercase tracking-tighter rounded-sm px-3 shadow-md">Match Ready</Badge>
                             )}
                          </div>
                        <CardTitle className="text-2xl font-black tracking-tight text-white drop-shadow-lg">
                          {event.title}
                        </CardTitle>
                      </div>
                   </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  <p className="text-sm text-muted-foreground/90 line-clamp-3 leading-relaxed font-medium">
                    {event.description}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-primary/10 rounded-sm">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Location</p>
                        <p className="text-xs font-bold text-gray-900 truncate">{event.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-primary/10 rounded-sm">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Capacity</p>
                        <p className="text-xs font-bold text-gray-900">
                          {capacityText} joined
                          {event.event_type === 'sports' && event.vacancy !== null && (
                            <span className="text-primary ml-1">({event.vacancy} left)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                       <div className="h-8 w-8 rounded-sm primary-gradient p-[1.5px] shadow-md shadow-primary/20">
                          <div className="h-full w-full rounded-sm bg-white flex items-center justify-center text-[10px] font-bold text-primary">
                             {event.organizer_details?.name?.[0] || 'O'}
                          </div>
                       </div>
                       <div className="min-w-0">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none">Organizer</p>
                          <p className="text-[10px] font-bold text-gray-900 truncate">{event.organizer_details?.name || "Hostel Team"}</p>
                       </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {event.external_link && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-sm border-primary/20 hover:bg-primary/5 text-black font-bold transition-all active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(event.external_link || '', '_blank');
                          }}
                        >
                          Details Link
                        </Button>
                      )}
                      
                      {(isTopLevelManagement(user?.role) || event.organizer === user?.id || event.organizer_details?.id === user?.id) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-sm border-primary/20 hover:bg-primary/5 text-black font-bold transition-all active:scale-95"
                          onClick={() => setViewRegistrationsEventId(event.id)}
                        >
                          View Registrations
                        </Button>
                      )}

                      {!isAdmin && (
                        <Button
                          className={registrationButtonClasses}
                          disabled={isRegistered || (event.vacancy === 0 && !isRegistered) || registerMutation.isPending}
                          onClick={() => registerMutation.mutate(event.id, {
                            onSuccess: () => toast.success('Registered for event'),
                            onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'Failed to register for event')),
                          })}
                        >
                          {isRegistered ? 'Registered' : (event.vacancy === 0 ? 'Event Full' : 'Register Now')}
                        </Button>
                      )}

                      {isRegistered && event.event_type === 'sports' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="rounded-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200 active:scale-95"
                            onClick={() => {
                              const reg = registrations?.find(r => r.event === event.id && (r.student === user?.id || r.student_details?.id === user?.id));
                              if (reg) setQrDialogOpen({ open: true, registration: reg });
                            }}
                          >
                            <QrCode className="h-4 w-4 mr-2" />
                            View QR
                          </Button>
                          
                          {(() => {
                            const userReg = registrations?.find(r => r.event === event.id && (r.student === user?.id || r.student_details?.id === user?.id));
                            if (userReg?.match_group_id) {
                              return (
                                <Badge className="bg-primary/10 text-primary border-0 font-black px-4 flex items-center gap-2 rounded-sm">
                                  <Trophy className="h-3 w-3" />
                                  {userReg.match_group_id}
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Calendar}
          title="No events found"
          description={filter === 'upcoming' ? "No upcoming events scheduled" : "No events match your filter"}
          variant="info"
        />
      )}

      {/* Registrations Dialog */}
      <Dialog open={!!viewRegistrationsEventId} onOpenChange={(open) => !open && setViewRegistrationsEventId(null)}>
        <DialogContent className="sm:max-w-[700px] w-[95vw] max-h-[85vh] overflow-y-auto p-0 border-none bg-white rounded-sm">
          <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md px-6 py-4 border-b flex items-center justify-between">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">Event Registrations</DialogTitle>
              <DialogDescription className="font-medium">
                {events?.find(e => e.id === viewRegistrationsEventId)?.title || 'Event Details'}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {registrations?.filter(r => r.event === viewRegistrationsEventId).length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Student Name</th>
                        <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reg Number</th>
                        <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email</th>
                        <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reg Time</th>
                        <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {registrations?.filter(r => r.event === viewRegistrationsEventId).map((reg) => (
                        <tr key={reg.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-2">
                             <div className="flex items-center gap-2">
                               <UserIcon className="h-3.5 w-3.5 text-primary/40" />
                               <p className="text-sm font-bold text-gray-900">{reg.student_details?.name}</p>
                             </div>
                          </td>
                          <td className="py-4 px-2">
                             <p className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-sm inline-block uppercase tracking-wider">{reg.student_details?.registration_number}</p>
                          </td>
                          <td className="py-4 px-2">
                             <div className="flex items-center gap-1.5">
                               <Mail className="h-3 w-3 text-muted-foreground/50" />
                               <p className="text-xs font-medium text-gray-500">{reg.student_details?.email}</p>
                             </div>
                          </td>
                          <td className="py-4 px-2">
                             <div className="flex items-center gap-1.5">
                               <Clock className="h-3 w-3 text-muted-foreground/50" />
                               <p className="text-xs font-medium text-gray-500">{new Date(reg.created_at).toLocaleString()}</p>
                             </div>
                          </td>
                          <td className="py-4 px-2 text-right">
                             <Badge variant="outline" className="text-[10px] font-bold uppercase py-0 px-2 rounded-sm border-gray-200">
                                {reg.status}
                             </Badge>
                          </td>
                        </tr>

                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center bg-gray-50 rounded-sm border-2 border-dashed border-gray-200">
                   <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                   <p className="text-sm font-bold text-gray-400">No registrations yet for this event.</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-sm">
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">Create Event</DialogTitle>
              <DialogDescription className="font-medium">Schedule a new hostel event for members.</DialogDescription>
            </DialogHeader>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="p-6 space-y-6"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter a catchy title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="rounded-sm border-0 bg-gray-50 focus-visible:ring-primary h-12 text-base font-medium px-4"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Event Type *</Label>
                  <Select
                    value={formData.event_type}
                    onValueChange={(value) => setFormData({ ...formData, event_type: value })}
                  >
                    <SelectTrigger className="rounded-sm border-0 bg-gray-50 focus:ring-primary h-12 text-base font-medium px-4">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-sm border-border/40 shadow-2xl">
                      {eventTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="rounded-sm my-1 mx-1 font-medium">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="court" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Sports Court (Optional)</Label>
                  <Select
                    value={formData.court}
                    onValueChange={(value) => setFormData({ ...formData, court: value })}
                  >
                    <SelectTrigger className="rounded-sm border-0 bg-gray-50 focus:ring-primary h-12 text-base font-medium px-4">
                      <SelectValue placeholder="Select court" />
                    </SelectTrigger>
                    <SelectContent className="rounded-sm border-border/40 shadow-2xl">
                      {courts?.map((court) => (
                        <SelectItem key={court.id} value={String(court.id)} className="rounded-sm my-1 mx-1 font-medium">
                          {court.name} ({court.sport_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audience" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Target Audience *</Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(value) => setFormData({ ...formData, target_audience: value })}
                >
                  <SelectTrigger id="audience" className="rounded-sm border-0 bg-gray-50 focus:ring-primary h-12 text-base font-medium px-4">
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm border-border/40 shadow-2xl">
                    <SelectItem value="all_students" className="font-medium">All Students</SelectItem>
                    <SelectItem value="hostellers" className="font-medium">Hostellers Only</SelectItem>
                    <SelectItem value="day_scholars" className="font-medium">Day Scholars Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_participants" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Max Players</Label>
                  <Input
                    id="max_participants"
                    type="number"
                    min="1"
                    placeholder="Infinite if empty"
                    value={formData.max_participants}
                    onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                    className="rounded-sm border-0 bg-gray-50 focus-visible:ring-primary h-12 text-base font-medium px-4"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min_players" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Min Players</Label>
                  <Input
                    id="min_players"
                    type="number"
                    min="1"
                    placeholder="Min for Match Ready"
                    value={formData.min_players}
                    onChange={(e) => setFormData({ ...formData, min_players: e.target.value })}
                    className="rounded-sm border-0 bg-gray-50 focus-visible:ring-primary h-12 text-base font-medium px-4"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="What is this event about?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="rounded-sm border-0 bg-gray-50 focus-visible:ring-primary text-base font-medium p-4 min-h-[100px]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Start Date & Time *</Label>
                  <div className="flex flex-col xs:flex-row gap-2">
                    <DatePicker
                      date={formData.start_date ? new Date(formData.start_date) : undefined}
                      onSelect={(date) => setFormData({ ...formData, start_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                      className="w-full h-12 rounded-sm border-0 bg-gray-50 font-medium"
                      placeholder="Pick start date"
                    />
                    <TimePicker
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                      className="w-full xs:w-[130px] h-12 rounded-sm border-0 bg-gray-50 font-medium px-4"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">End Date & Time *</Label>
                  <div className="flex flex-col xs:flex-row gap-2">
                    <DatePicker
                      date={formData.end_date ? new Date(formData.end_date) : undefined}
                      onSelect={(date) => setFormData({ ...formData, end_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                      className="w-full h-12 rounded-sm border-0 bg-gray-50 font-medium"
                      placeholder="Pick end date"
                    />
                    <TimePicker
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                      className="w-full xs:w-[130px] h-12 rounded-sm border-0 bg-gray-50 font-medium px-4"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Location *</Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground/50" />
                  <Input
                    id="location"
                    placeholder="Where is the event happening?"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="rounded-sm border-0 bg-gray-50 focus-visible:ring-primary h-12 text-base font-medium pl-12 pr-4"
                    required
                  />
                </div>
              </div>

              <div className="p-4 rounded-sm bg-primary/5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="image" className="text-xs font-bold uppercase tracking-widest text-primary ml-1">Banner Image (Optional)</Label>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setFormData({ ...formData, image: file });
                      }}
                      className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border-0 file:text-xs file:font-black file:uppercase file:tracking-widest file:bg-primary file:text-white hover:file:opacity-90 transition-all bg-white/50 border-dashed border-2 border-primary/20 h-auto py-2"
                    />
                    {formData.image && (
                      <span className="text-[10px] font-bold text-primary truncate max-w-[150px] bg-white px-3 py-1 rounded-sm shadow-sm">
                        {formData.image.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white/50 p-3 rounded-sm border border-primary/10">
                  <input
                    id="mandatory"
                    type="checkbox"
                    checked={formData.is_mandatory}
                    onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                    className="h-5 w-5 rounded-sm border-primary/30 text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                  <Label htmlFor="mandatory" className="font-bold text-sm cursor-pointer select-none">Mandatory attendance for everyone</Label>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-dashed border-gray-200">
                <Label htmlFor="external_link" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">External Link (Optional)</Label>
                <Input
                  id="external_link"
                  placeholder="e.g. Google Form or RSVP link"
                  value={formData.external_link}
                  onChange={(e) => setFormData({ ...formData, external_link: e.target.value })}
                  className="rounded-sm border-0 bg-gray-50 focus-visible:ring-primary h-12 text-base font-medium px-4"
                />
                <p className="text-[10px] text-muted-foreground ml-1 font-medium">Add a Google Form, Registration form or external website link.</p>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 -mx-6 px-6 -mb-6 pb-6 border-t flex flex-col gap-3">
              <Button 
                type="submit" 
                disabled={createMutation.isPending} 
                className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-sm shadow-sm hover:shadow-2xl hover:shadow-primary/40 active:scale-95 transition-all"
              >
                {createMutation.isPending ? 'Scheduling...' : 'Schedule Event'}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setCreateDialogOpen(false)}
                className="w-full h-10 font-bold text-muted-foreground uppercase tracking-widest text-[10px] hover:bg-gray-50 rounded-sm"
              >
                Nah, Maybe Later
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen.open} onOpenChange={(open) => setQrDialogOpen({ ...qrDialogOpen, open })}>
        <DialogContent className="sm:max-w-[400px] w-[95vw] p-0 border-none bg-white rounded-sm overflow-hidden">
          <div className="bg-primary/5 p-8 flex flex-col items-center gap-6">
            <div className="bg-white p-6 rounded-sm shadow-2xl shadow-primary/20 border border-primary/10">
              {qrDialogOpen.registration && (
                <QRCodeCanvas
                  value={JSON.stringify({
                    booking_id: qrDialogOpen.registration.id,
                    student_id: user?.id,
                    court_id: qrDialogOpen.registration.event_details?.court,
                    date: qrDialogOpen.registration.event_details?.start_date,
                    ref: qrDialogOpen.registration.qr_code_reference,
                  })}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              )}
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black tracking-tight">{qrDialogOpen.registration?.event_details?.title}</h3>
              <p className="text-sm font-medium text-muted-foreground">Scan this at the court for entry</p>
              <div className="pt-2">
                <Badge variant="outline" className="font-mono text-[10px] py-0.5 px-3 border-primary/20 bg-white">
                  REF: {qrDialogOpen.registration?.qr_code_reference?.split('-')[0].toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
          <div className="p-4">
            <Button 
              className="w-full h-12 rounded-sm font-bold bg-gray-900 text-white"
              onClick={() => setQrDialogOpen({ open: false, registration: null })}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
