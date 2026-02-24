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
  DialogFooter,
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
  const isAdmin = ['admin', 'super_admin'].includes(user?.role || '');
  const queryClient = useQueryClient();

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

    const getTypeBadge = (type: string) => {
      const colorMap: Record<string, string> = {
        sports: 'bg-orange-500/10 text-black border-orange-200 shadow-orange-500/10',
        cultural: 'bg-purple-500/10 text-purple-600 border-purple-200 shadow-purple-500/10',
        educational: 'bg-blue-500/10 text-blue-600 border-blue-200 shadow-blue-500/10',
        social: 'bg-pink-500/10 text-pink-600 border-pink-200 shadow-pink-500/10',
        maintenance: 'bg-slate-500/10 text-slate-600 border-slate-200 shadow-slate-500/10',
      };
    return <Badge className={`font-bold border px-3 py-1 rounded-full shadow-sm capitalize ${colorMap[type] || 'bg-muted text-black'}`}>{type}</Badge>;
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            Events
          </h1>
          <p className="text-muted-foreground">Manage and register for hostel events</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 smooth-transition rounded-lg active:scale-95 transition-all">
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={filter} onValueChange={(value) => setFilter(value as 'all' | 'upcoming' | 'past')}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Select filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="past">Past</SelectItem>
              <SelectItem value="all">All Events</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

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
              <Card key={event.id} className="group overflow-hidden rounded-3xl border-0 shadow-xl hover:shadow-2xl transition-all duration-500 bg-white/80 backdrop-blur-md">
                <div className="relative h-48 overflow-hidden">
                   {event.image ? (
                     <div className="absolute inset-0">
                       <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                       <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors" />
                     </div>
                   ) : (
                     <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary-dark opacity-90 group-hover:scale-110 transition-transform duration-700" />
                   )}
                   <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                      <div className="absolute top-4 left-4 flex flex-col items-center justify-center bg-white/20 backdrop-blur-md rounded-2xl h-16 w-16 border border-white/30">
                         <span className="text-2xl font-black leading-none">{day}</span>
                         <span className="text-xs font-bold uppercase tracking-widest">{month}</span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex gap-2">
                           {getTypeBadge(event.event_type)}
                           {event.is_mandatory && (
                             <Badge className="bg-white text-black border-0 font-black uppercase tracking-tighter rounded-full px-3">Mandatory</Badge>
                           )}
                        </div>
                        <CardTitle className="text-2xl font-black tracking-tight text-white drop-shadow-md">
                          {event.title}
                        </CardTitle>
                      </div>
                   </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  <p className="text-sm text-muted-foreground/90 line-clamp-3 leading-relaxed font-medium">
                    {event.description}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-dashed border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-xl">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Location</p>
                        <p className="text-xs font-bold truncate">{event.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-xl">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Capacity</p>
                        <p className="text-xs font-bold">{capacityText} joined</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                       <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-orange-400 p-[1.5px]">
                          <div className="h-full w-full rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-black">
                             {event.organizer_details?.name?.[0] || 'O'}
                          </div>
                       </div>
                       <div className="min-w-0">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-none">Organizer</p>
                          <p className="text-[10px] font-bold truncate">{event.organizer_details?.name || "Hostel Team"}</p>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>Schedule a new hostel event.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Event Type *</Label>
                <Select
                  value={formData.event_type}
                  onValueChange={(value) => setFormData({ ...formData, event_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date & Time *</Label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <DatePicker
                      date={formData.start_date ? new Date(formData.start_date) : undefined}
                      onSelect={(date) => setFormData({ ...formData, start_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                      className="w-full flex-1"
                      placeholder="Pick start date"
                    />
                    <TimePicker
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                      className="w-[120px]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>End Date & Time *</Label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <DatePicker
                      date={formData.end_date ? new Date(formData.end_date) : undefined}
                      onSelect={(date) => setFormData({ ...formData, end_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                      className="w-full flex-1"
                      placeholder="Pick end date"
                    />
                    <TimePicker
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                      className="w-[120px]"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_participants">Max Participants</Label>
                  <Input
                    id="max_participants"
                    type="number"
                    min="1"
                    value={formData.max_participants}
                    onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image">Banner Image (Optional)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setFormData({ ...formData, image: file });
                    }}
                    className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                  {formData.image && (
                    <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {formData.image.name}
                    </span>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.is_mandatory}
                  onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                  className="h-4 w-4"
                />
                Mandatory attendance
              </label>
              <div className="space-y-2 pt-2 border-t border-dashed">
                <Label htmlFor="external_link">Form / External Link (Optional)</Label>
                <Input
                  id="external_link"
                  placeholder="e.g. https://forms.gle/..."
                  value={formData.external_link}
                  onChange={(e) => setFormData({ ...formData, external_link: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Add a Google Form or external website link for this event.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending} className="primary-gradient text-white font-semibold hover:opacity-90 smooth-transition">
                Create Event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
