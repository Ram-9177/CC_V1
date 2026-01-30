import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, MapPin, Plus, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { getApiErrorMessage } from '@/lib/utils';

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
    end_date: '',
    location: '',
    max_participants: '',
    is_mandatory: false,
  });

  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
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
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to register for event'));
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: formData.title,
        event_type: formData.event_type,
        description: formData.description,
        start_date: formData.start_date,
        end_date: formData.end_date,
        location: formData.location,
        is_mandatory: formData.is_mandatory,
      };
      if (formData.max_participants) {
        payload.max_participants = Number(formData.max_participants);
      }
      await api.post('/events/events/', payload);
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
        end_date: '',
        location: '',
        max_participants: '',
        is_mandatory: false,
      });
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to create event'));
    },
  });

  const getTypeBadge = (type: string) => {
    const colorMap: Record<string, string> = {
      sports: 'bg-green-100 text-green-800',
      cultural: 'bg-purple-100 text-purple-800',
      educational: 'bg-blue-100 text-blue-800',
      social: 'bg-yellow-100 text-yellow-800',
      maintenance: 'bg-orange-100 text-orange-800',
    };
    return <Badge className={colorMap[type] || 'bg-gray-100 text-gray-800'}>{type}</Badge>;
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
          <Button onClick={() => setCreateDialogOpen(true)}>
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
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">Loading events...</CardContent>
        </Card>
      ) : events && events.length > 0 ? (
        <div className="grid gap-4">
          {events.map((event) => {
            const isRegistered = registeredEventIds.has(event.id);
            const capacityText = event.max_participants
              ? `${event.registration_count || 0}/${event.max_participants}`
              : `${event.registration_count || 0}`;
            return (
              <Card key={event.id}>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2">
                      <CardTitle className="text-xl">{event.title}</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        {getTypeBadge(event.event_type)}
                        {event.is_mandatory && (
                          <Badge className="bg-red-100 text-red-800">Mandatory</Badge>
                        )}
                      </div>
                    </div>
                    {!isAdmin && (
                      <Button
                        variant={isRegistered ? 'outline' : 'default'}
                        disabled={isRegistered || registerMutation.isPending}
                        onClick={() => registerMutation.mutate(event.id)}
                      >
                        {isRegistered ? 'Registered' : 'Register'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{event.description}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(event.start_date).toLocaleString()} - {new Date(event.end_date).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {event.location}
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {capacityText} registered
                    </div>
                  </div>
                  {event.organizer_details && (
                    <div className="text-sm text-muted-foreground">
                      Organized by {event.organizer_details.name}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">No events found</CardContent>
        </Card>
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
                  <Label htmlFor="start_date">Start Date & Time *</Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date & Time *</Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                  />
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.is_mandatory}
                  onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                  className="h-4 w-4"
                />
                Mandatory attendance
              </label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                Create Event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
