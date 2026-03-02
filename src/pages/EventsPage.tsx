import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { format } from 'date-fns';
import { Calendar, MapPin, Plus, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { useRealtimeQuery } from '@/hooks/useWebSocket';
import { isTopLevelManagement } from '@/lib/rbac';

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
  is_mandatory: boolean;
  registration_count?: number;
  created_at: string;
  updated_at: string;
  external_link?: string | null;
  image?: string | null;
}

interface EventRegistration {
  id: number;
  event: number;
  student: number;
  status: 'registered' | 'attended' | 'absent' | 'cancelled';
  event_details?: EventItem;
  student_details?: {
    id: number;
    name: string;
    email: string;
  };
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
    is_mandatory: false,
    external_link: '',
    image: null as File | null,
  });

  const user = useAuthStore((state) => state.user);
  const isAdmin = isTopLevelManagement(user?.role) || ['chef', 'head_chef'].includes(user?.role || '');
  const queryClient = useQueryClient();

  useRealtimeQuery('event_created', 'events');
  useRealtimeQuery('event_updated', 'events');
  useRealtimeQuery('event_deleted', 'events');
  
  useRealtimeQuery('event_registration_created', 'event-registrations');
  useRealtimeQuery('event_registration_updated', 'event-registrations');

  const { data: events, isLoading } = useQuery<EventItem[]>({
    queryKey: ['events', filter],
    queryFn: async () => {
      const url =
        filter === 'upcoming'
          ? '/events/events/upcoming/'
          : filter === 'past'
            ? '/events/events/past/'
            : '/events/events/';
      const response = await api.get(url);
      return response.data.results || response.data;
    },
  });

  const { data: registrations } = useQuery<EventRegistration[]>({
    queryKey: ['event-registrations'],
    queryFn: async () => {
      const response = await api.get('/events/registrations/');
      return response.data.results || response.data;
    },
  });

  const registeredEventIds = useMemo(() => {
    if (!user?.id) return new Set<number>();
    return new Set(
      (registrations || [])
        .filter((registration) => registration.student === user.id || registration.student_details?.id === user.id)
        .map((registration) => registration.event)
    );
  }, [registrations, user?.id]);

  const registerMutation = useMutation({
    mutationFn: async (eventId: number) => {
      await api.post('/events/registrations/register/', { event_id: eventId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Registered for event');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to register for event'));
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
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
      if (formData.image) payload.append('image', formData.image);

      await api.post('/events/events/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
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
      });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to create event'));
    },
  });

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
    return <Badge className={`font-bold border px-3 py-1 rounded-full shadow-sm capitalize ${onHero ? colors.hero : colors.card}`}>{type}</Badge>;
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black flex items-center gap-3 tracking-tight">
            <div className="p-2.5 bg-primary/10 rounded-2xl">
              <Calendar className="h-7 w-7 text-primary" />
            </div>
            Events
          </h1>
          <p className="text-gray-500 font-medium text-sm ml-1">Manage and register for hostel events</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-2xl p-1 shadow-sm ring-1 ring-black/5">
            {(['upcoming', 'past', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all capitalize ${
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
            <Button onClick={() => setCreateDialogOpen(true)} className="primary-gradient text-white font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 rounded-2xl px-5 py-2.5 transition-all active:scale-95">
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-6 w-3/4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
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

            return (
              <Card key={event.id} className="group overflow-hidden rounded-3xl border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-white backdrop-blur-md">
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
                      <div className="absolute top-4 left-4 flex flex-col items-center justify-center bg-white/95 backdrop-blur-md rounded-2xl h-16 w-16 shadow-lg">
                         <span className="text-2xl font-black leading-none text-gray-900">{day}</span>
                         <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{month}</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex gap-2">
                           {getTypeBadge(event.event_type, true)}
                           {event.is_mandatory && (
                             <Badge className="bg-white text-gray-900 border-0 font-black uppercase tracking-tighter rounded-full px-3 shadow-md">Mandatory</Badge>
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
                      <div className="p-2.5 bg-primary/10 rounded-xl">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Location</p>
                        <p className="text-xs font-bold text-gray-900 truncate">{event.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-primary/10 rounded-xl">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Capacity</p>
                        <p className="text-xs font-bold text-gray-900">{capacityText} joined</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                       <div className="h-8 w-8 rounded-full primary-gradient p-[1.5px] shadow-md shadow-primary/20">
                          <div className="h-full w-full rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-primary">
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
                          className="rounded-xl border-primary/20 hover:bg-primary/5 text-black font-bold transition-all active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(event.external_link || '', '_blank');
                          }}
                        >
                          Details Link
                        </Button>
                      )}
                      
                      {!isAdmin && (
                        <Button
                          className={cn(
                            "rounded-xl font-bold transition-all active:scale-95",
                            isRegistered 
                              ? "bg-slate-100 text-muted-foreground border-0" 
                              : "primary-gradient text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                          )}
                          disabled={isRegistered || registerMutation.isPending}
                          onClick={() => registerMutation.mutate(event.id)}
                        >
                          {isRegistered ? 'Registered' : 'Register Now'}
                        </Button>
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

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl">
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
                  className="rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary h-12 text-base font-medium px-4"
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
                    <SelectTrigger className="rounded-2xl border-0 bg-gray-50 focus:ring-primary h-12 text-base font-medium px-4">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/40 shadow-2xl">
                      {eventTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="rounded-xl my-1 mx-1 font-medium">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_participants" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Max Participants</Label>
                  <Input
                    id="max_participants"
                    type="number"
                    min="1"
                    placeholder="Infinite if empty"
                    value={formData.max_participants}
                    onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                    className="rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary h-12 text-base font-medium px-4"
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
                  className="rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary text-base font-medium p-4 min-h-[100px]"
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
                      className="w-full h-12 rounded-2xl border-0 bg-gray-50 font-medium"
                      placeholder="Pick start date"
                    />
                    <TimePicker
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                      className="w-full xs:w-[130px] h-12 rounded-2xl border-0 bg-gray-50 font-medium px-4"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">End Date & Time *</Label>
                  <div className="flex flex-col xs:flex-row gap-2">
                    <DatePicker
                      date={formData.end_date ? new Date(formData.end_date) : undefined}
                      onSelect={(date) => setFormData({ ...formData, end_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                      className="w-full h-12 rounded-2xl border-0 bg-gray-50 font-medium"
                      placeholder="Pick end date"
                    />
                    <TimePicker
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                      className="w-full xs:w-[130px] h-12 rounded-2xl border-0 bg-gray-50 font-medium px-4"
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
                    className="rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary h-12 text-base font-medium pl-12 pr-4"
                    required
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-primary/5 space-y-4">
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
                      className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:uppercase file:tracking-widest file:bg-primary file:text-white hover:file:opacity-90 transition-all bg-white/50 border-dashed border-2 border-primary/20 h-auto py-2"
                    />
                    {formData.image && (
                      <span className="text-[10px] font-bold text-primary truncate max-w-[150px] bg-white px-3 py-1 rounded-full shadow-sm">
                        {formData.image.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white/50 p-3 rounded-xl border border-primary/10">
                  <input
                    id="mandatory"
                    type="checkbox"
                    checked={formData.is_mandatory}
                    onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                    className="h-5 w-5 rounded-md border-primary/30 text-primary focus:ring-primary cursor-pointer accent-primary"
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
                  className="rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary h-12 text-base font-medium px-4"
                />
                <p className="text-[10px] text-muted-foreground ml-1 font-medium">Add a Google Form, Registration form or external website link.</p>
              </div>
            </div>

            <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 -mx-6 px-6 -mb-6 pb-6 border-t flex flex-col gap-3">
              <Button 
                type="submit" 
                disabled={createMutation.isPending} 
                className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-2xl shadow-sm hover:shadow-2xl hover:shadow-primary/40 active:scale-95 transition-all"
              >
                {createMutation.isPending ? 'Scheduling...' : 'Schedule Event'}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setCreateDialogOpen(false)}
                className="w-full h-10 font-bold text-muted-foreground uppercase tracking-widest text-[10px] hover:bg-gray-50 rounded-xl"
              >
                Nah, Maybe Later
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
