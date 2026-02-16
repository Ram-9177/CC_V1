import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Utensils, Calendar as CalendarIcon, Check, Users, UserMinus, Star, Plus, Trash2, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { useWebSocketEvent } from '@/hooks/useWebSocket';
import { isStaff } from '@/lib/rbac';
import type { Meal, MealFeedback, MealSpecialRequest, MealAttendance } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';

interface MealPreference {
  id: number;
  meal_type: string;
  preference: string;
  dietary_restrictions: string;
}

interface MealForecast {
  date: string;
  meal_type?: string;
  total_students: number;
  students_on_leave: number;
  students_marked_absent: number;
  expected_diners: number;
}

function FeedbackDialog({ meal }: { meal: Meal }) {
    const user = useAuthStore(state => state.user);
    const [open, setOpen] = useState(false);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const queryClient = useQueryClient();

    const feedbackMutation = useMutation({
        mutationFn: async (data: { rating: number; comment: string }) => {
            await api.post(`/meals/${meal.id}/add_feedback/`, data);
        },
        onSuccess: () => {
            toast.success('Feedback submitted successfully');
            setOpen(false);
            setRating(5);
            setComment('');
            queryClient.invalidateQueries({ queryKey: ['meals'] });
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to submit feedback'));
        }
    });

    const isHR = user && (['admin', 'super_admin', 'warden', 'head_warden'].includes(user.role) || user.is_student_hr);
    const isRequested = meal.is_feedback_active;

    if (!isHR && !isRequested) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" className={cn(
                    "h-11 w-11 rounded-xl border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/30",
                    isRequested && "animate-pulse ring-2 ring-primary/20"
                )}>
                    <Star className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle>{isRequested ? 'Feedback Requested' : 'Rate Meal Quality'}</DialogTitle>
                    <DialogDescription>
                        {meal.feedback_prompt || `Provide feedback for ${meal.meal_type} on ${new Date(meal.date).toLocaleDateString()}. Your feedback helps improve food quality.`}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex flex-col items-center gap-2">
                        <Label>Rating</Label>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    className={cn(
                                        "p-1 transition-all active:scale-90 focus:outline-none",
                                        star <= rating ? "text-primary" : "text-muted"
                                    )}
                                >
                                    <Star className={cn("h-8 w-8 fill-current", star <= rating ? "fill-primary" : "")} />
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Comments (Optional)</Label>
                        <Textarea
                            placeholder="Describe taste, quality, hygiene, or suggestions..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="resize-none h-24 rounded-xl"
                        />
                    </div>
                </div>
                <DialogFooter className="sm:justify-end gap-2">
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button 
                        onClick={() => feedbackMutation.mutate({ rating, comment })}
                        disabled={feedbackMutation.isPending}
                        className="bg-primary hover:bg-primary/90 text-foreground font-bold"
                    >
                        {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function RequestFeedbackDialog({ meal }: { meal: Meal }) {
    const [open, setOpen] = useState(false);
    const [prompt, setPrompt] = useState(meal.feedback_prompt || '');
    const queryClient = useQueryClient();

    const toggleMutation = useMutation({
        mutationFn: async (data: { is_active: boolean; prompt: string }) => {
            await api.post(`/meals/${meal.id}/toggle_feedback/`, data);
        },
        onSuccess: () => {
            toast.success(meal.is_feedback_active ? 'Feedback closed' : 'Feedback requested from all students');
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: ['meals'] });
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to toggle feedback'));
        }
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className={cn(
                    "rounded-xl font-bold h-11 px-4",
                    meal.is_feedback_active ? "bg-black text-white hover:bg-black/90" : "bg-secondary text-foreground hover:bg-secondary/80"
                )}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {meal.is_feedback_active ? 'Stop Requests' : 'Request Feedback'}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Request Student Feedback</DialogTitle>
                    <DialogDescription>
                        This will show a prompt on all student dashboards to rate this {meal.meal_type}.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Feedback Prompt / Question</Label>
                        <Input
                            placeholder="e.g. How was the special Sunday biryani today?"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="rounded-xl"
                        />
                    </div>
                </div>
                <DialogFooter className="sm:justify-end gap-2">
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button 
                        onClick={() => toggleMutation.mutate({ is_active: !meal.is_feedback_active, prompt })}
                        disabled={toggleMutation.isPending}
                        className={cn(
                            "font-bold rounded-xl",
                            meal.is_feedback_active ? "bg-black text-white" : "bg-primary text-foreground"
                        )}
                    >
                        {toggleMutation.isPending ? 'Processing...' : meal.is_feedback_active ? 'Stop Requests' : 'Send Request'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface SpecialRequestFormProps {
  mutation: ReturnType<typeof useMutation>;
  loading: boolean;
}

function SpecialRequestForm({ mutation, loading }: SpecialRequestFormProps) {
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [requestDate, setRequestDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');

  const COMMON_ITEMS = ['Chapati', 'Hot Water', 'Extra Rice', 'Milk', 'Butter', 'Jam', 'Extra Vegetables', 'Pickle', 'Bread', 'Tea'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !requestDate) {
      toast.error('Please fill required fields');
      return;
    }
    mutation.mutate(
      {
        item_name: itemName,
        quantity,
        requested_for_date: format(requestDate, 'yyyy-MM-dd'),
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          setItemName('');
          setQuantity(1);
          setRequestDate(undefined);
          setNotes('');
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="item-name" className="text-sm font-semibold">
          Item Name *
        </Label>
        <div className="flex gap-2 flex-wrap mb-2">
          {COMMON_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setItemName(item)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                itemName === item
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-foreground border-input hover:bg-slate-100'
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <Input
          id="item-name"
          placeholder="Or type custom item..."
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          className="rounded-xl"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity" className="text-sm font-semibold">
            Quantity *
          </Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            max="10"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="request-date" className="text-sm font-semibold">
            Requested For *
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal border-input h-11 rounded-xl",
                  !requestDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {requestDate ? format(requestDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={requestDate}
                onSelect={setRequestDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-semibold">
          Additional Notes (Optional)
        </Label>
        <Textarea
          id="notes"
          placeholder="e.g., Hot water for tea, Extra spicy, etc..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-xl min-h-[80px]"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl font-bold h-11 bg-primary hover:bg-primary/90 text-white"
      >
        <Plus className="h-4 w-4 mr-2" />
        {loading ? 'Submitting...' : 'Submit Request'}
      </Button>
    </form>
  );
}

export default function MealsPage() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedMealType, setSelectedMealType] = useState<string>('all');

  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isAuthority = user && (
    ['admin', 'super_admin', 'warden', 'head_warden', 'chef', 'head_chef'].includes(user.role) || 
    user.is_student_hr
  );

  // Realtime updates for meals
  useWebSocketEvent('meal_updated', () => {
    queryClient.invalidateQueries({ queryKey: ['meals'] });
  });
  
  // Realtime updates for meal attendance
  useWebSocketEvent('meal_attendance_updated', () => {
    queryClient.invalidateQueries({ queryKey: ['meal-attendance'] });
  });

  const { data: meals, isLoading: mealsLoading } = useQuery<Meal[]>({
    queryKey: ['meals', selectedDate],
    queryFn: async () => {
      const response = await api.get('/meals/', {
        params: { date: selectedDate },
      });
      return response.data.results || response.data;
    },
  });

  const { data: forecast, isLoading: forecastLoading } = useQuery<MealForecast>({
    queryKey: ['meal-forecast', selectedDate, selectedMealType],
    enabled: !!isAuthority,
    queryFn: async () => {
      const params: Record<string, string> = { date: selectedDate };
      if (selectedMealType !== 'all') {
          params.meal_type = selectedMealType;
      }
      const response = await api.get('/meals/forecast/', { params });
      return response.data;
    }
  });

  const { data: mealAttendance, isLoading: attendanceLoading } = useQuery<MealAttendance[]>({
    queryKey: ['meal-attendance', selectedDate, selectedMealType],
    enabled: !!isAuthority,
    queryFn: async () => {
      const params: Record<string, string> = { date: selectedDate };
      if (selectedMealType !== 'all') params.meal_type = selectedMealType;

      const response = await api.get('/meals/attendance/', { params });
      return response.data.results || response.data;
    },
  });

  const { data: preferences } = useQuery<MealPreference[]>({
    queryKey: ['meal-preferences'],
    enabled: !!isAuthority,
    queryFn: async () => {
      const response = await api.get('/meals/preferences/');
      return response.data.results || response.data;
    },
  });

  const { data: specialRequests, isLoading: requestsLoading } = useQuery<MealSpecialRequest[]>({
    queryKey: ['meal-special-requests'],
    queryFn: async () => {
      const response = await api.get('/meals/special-requests/');
      return response.data.results || response.data || [];
    },
  });

  const createSpecialRequestMutation = useMutation({
    mutationFn: async (data: { item_name: string; quantity: number; requested_for_date: string; notes?: string }) => {
      await api.post('/meals/special-requests/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] });
      toast.success('Special request submitted successfully!');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to submit request'));
    },
  });

  const deleteSpecialRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      await api.delete(`/meals/special-requests/${requestId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] });
      toast.success('Request cancelled');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to cancel request'));
    },
  });

  const markMealMutation = useMutation({
    mutationFn: async (data: { meal_id: number; status: string }) => {
      await api.post('/meals/mark/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-attendance'] });
      toast.success('Meal attendance marked successfully');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to mark meal attendance'));
    },
  });

  const updatePreferenceMutation = useMutation({
    mutationFn: async (data: { meal_type: string; preference: string }) => {
      await api.post('/meals/preferences/', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-preferences'] });
      toast.success('Meal preference updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to update preference'));
    },
  });

  const updateDietaryMutation = useMutation({
    mutationFn: async (restrictions: string) => {
      await api.post('/meals/preferences/', { dietary_restrictions: restrictions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-preferences'] });
      toast.success('Dietary restrictions updated');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to update restrictions'));
    },
  });

  // HR-specific feedback queries
  const isHR = user && (['admin', 'super_admin', 'warden', 'head_warden'].includes(user.role) || user.is_student_hr);
  
  const { data: mealFeedback, isLoading: feedbackLoading } = useQuery({
    queryKey: ['meal-feedback', selectedDate],
    enabled: !!isHR,
    queryFn: async () => {
      const response = await api.get('/meals/feedback/', {
        params: { date: selectedDate },
      });
      return response.data.results || response.data || [];
    },
  });

  const { data: feedbackStats } = useQuery({
    queryKey: ['meal-feedback-stats', selectedDate, selectedMealType],
    enabled: !!isHR,
    queryFn: async () => {
      const params: Record<string, unknown> = { date: selectedDate };
      if (selectedMealType !== 'all') params.meal_type = selectedMealType;
      const response = await api.get('/meals/feedback-stats/', { params });
      return response.data;
    },
  });

  const markFeedbackAsResolvedMutation = useMutation({
    mutationFn: async (feedbackId: number) => {
      await api.patch(`/meals/feedback/${feedbackId}/`, { resolved: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-feedback'] });
      toast.success('Feedback marked as resolved');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to update feedback'));
    },
  });

  const updateSpecialRequestStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await api.patch(`/meals/special-requests/${id}/`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] });
      toast.success('Request status updated');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to update status'));
    },
  });

  const getMealTypeBadge = (mealType: string) => {
    switch (mealType) {
      case 'breakfast':
        return <Badge variant="outline" className="bg-secondary/60 text-black border-secondary/70 font-bold">Breakfast</Badge>;
      case 'lunch':
        return <Badge variant="outline" className="bg-primary/20 text-black border-primary/30 font-bold">Lunch</Badge>;
      case 'dinner':
        return <Badge variant="outline" className="bg-black/10 text-black border-black/20 font-bold">Dinner</Badge>;
      default:
        return <Badge variant="outline" className="text-black font-bold">{mealType}</Badge>;
    }
  };

  const filteredMeals = meals?.filter(
    (meal) => selectedMealType === 'all' || meal.meal_type === selectedMealType
  );

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black flex items-center gap-2 text-foreground tracking-tight">
            <div className="p-2 bg-orange-100 rounded-2xl text-orange-600">
                <Utensils className="h-6 w-6" />
            </div>
            Meal Management
          </h1>
          <p className="text-muted-foreground font-medium pl-1">Manage meal schedules and track meal attendance</p>
        </div>

      {isAuthority && (
        <Card className="rounded-3xl border-0 shadow-sm bg-gradient-to-r from-orange-50/50 to-white overflow-hidden">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 font-black">
                    <div className="p-1.5 bg-orange-100 rounded-lg text-orange-600">
                        <Users className="h-4 w-4" />
                    </div>
                    Dining Forecast <span className="text-sm font-bold text-muted-foreground/60 ml-2">(Based on Gate Passes)</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {forecastLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Skeleton className="h-24 w-full rounded-2xl" />
                        <Skeleton className="h-24 w-full rounded-2xl" />
                        <Skeleton className="h-24 w-full rounded-2xl" />
                        <Skeleton className="h-24 w-full rounded-2xl" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                         <div className="bg-white p-5 rounded-3xl border-0 shadow-sm flex flex-col justify-center gap-1 group hover:scale-[1.02] transition-transform">
                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-2">
                                    <Users className="h-3 w-3" /> Total Strength
                                </p>
                                <p className="text-3xl font-black text-foreground">{forecast?.total_students || 0}</p>
                         </div>
                         
                         <div className="bg-white p-5 rounded-3xl border-0 shadow-sm flex flex-col justify-center gap-1 group hover:scale-[1.02] transition-transform">
                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-2">
                                    <UserMinus className="h-3 w-3" /> On Leave
                                </p>
                                <p className="text-3xl font-black text-orange-500">{forecast?.students_on_leave || 0}</p>
                         </div>

                         <div className="bg-white p-5 rounded-3xl border-0 shadow-sm flex flex-col justify-center gap-1 group hover:scale-[1.02] transition-transform">
                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-2">
                                    <UserMinus className="h-3 w-3" /> Skipped Meal
                                </p>
                                <p className="text-3xl font-black text-red-500">{forecast?.students_marked_absent || 0}</p>
                         </div>

                         <div className="bg-black text-white p-5 rounded-3xl border-0 shadow-lg shadow-black/20 flex flex-col justify-center gap-1 group hover:scale-[1.02] transition-transform relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Utensils className="h-12 w-12" />
                                </div>
                                <p className="text-[10px] text-white/60 font-black uppercase tracking-wider flex items-center gap-2 relative z-10">
                                    <Utensils className="h-3 w-3" /> Expected Diners
                                </p>
                                <p className="text-4xl font-black text-white relative z-10">{forecast?.expected_diners || 0}</p>
                         </div>
                    </div>
                )}
            </CardContent>
        </Card>
      )}

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList className={cn("grid w-full", (isHR && isAuthority) ? "grid-cols-5" : isAuthority ? "grid-cols-4" : "grid-cols-2")}>
          <TabsTrigger value="schedule">Meal Schedule</TabsTrigger>
          {isAuthority && <TabsTrigger value="attendance">Meal Attendance</TabsTrigger>}
          {isAuthority && <TabsTrigger value="preferences">Preferences</TabsTrigger>}
          <TabsTrigger value="special">Special Requests</TabsTrigger>
          {isHR && <TabsTrigger value="feedback">Meal Feedback</TabsTrigger>}
        </TabsList>

        {/* Meal Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <DatePicker
                    date={selectedDate ? new Date(selectedDate) : undefined}
                    onSelect={(date) => setSelectedDate(date ? format(date, 'yyyy-MM-dd') : '')}
                    className="w-full"
                    placeholder="Pick a date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Meal Type</Label>
                  <Select value={selectedMealType} onValueChange={setSelectedMealType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select meal type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Meals</SelectItem>
                      <SelectItem value="breakfast">Breakfast</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

            <CardHeader>
              <CardTitle>Today's Menu</CardTitle>
            </CardHeader>
            <CardContent>
              {mealsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden border shadow-sm rounded-3xl">
                      <Skeleton className="h-2 w-full" />
                      <CardHeader className="pb-3 px-6 pt-6">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-6 w-20 rounded-full" />
                          <Skeleton className="h-6 w-24 rounded-full" />
                        </div>
                      </CardHeader>
                      <CardContent className="px-6 pb-6 space-y-4">
                        <Skeleton className="h-5 w-32" />
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-5 w-full" />
                          <Skeleton className="h-5 w-3/4" />
                        </div>
                        <Skeleton className="h-11 w-full rounded-2xl" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredMeals && filteredMeals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {filteredMeals.map((meal) => (
                    <Card key={meal.id} className="overflow-hidden border-0 shadow-sm rounded-3xl hover:shadow-md transition-shadow">
                      <div className={cn(
                        "h-2",
                        meal.meal_type === 'breakfast' ? "bg-secondary" :
                        meal.meal_type === 'lunch' ? "bg-success" : "bg-primary"
                      )} />
                      <CardHeader className="pb-3 px-6 pt-6">
                        <div className="flex items-center justify-between">
                          {getMealTypeBadge(meal.meal_type)}
                          {meal.available ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20 px-3 font-bold">AVAILABLE</Badge>
                          ) : (
                            <Badge variant="secondary" className="px-3 font-bold opacity-50">CLOSED</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="px-6 pb-6 space-y-4">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium">
                          <div className="p-2 bg-muted rounded-xl">
                            <Calendar className="h-4 w-4" />
                          </div>
                          {new Date(meal.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </div>
                        
                        <div className="space-y-2">
                           <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Main Menu</p>
                           <p className="text-base font-semibold leading-relaxed line-clamp-3">
                             {meal.menu}
                           </p>
                        </div>

                        {meal.available && (
                          <div className="flex gap-2 flex-wrap">
                             {user?.role === 'student' && (
                               <Button
                                  className="flex-1 rounded-2xl h-11 font-bold shadow-lg shadow-primary/10 transition-transform active:scale-95"
                                  onClick={() =>
                                    markMealMutation.mutate({ meal_id: meal.id, status: 'taken' })
                                  }
                                  disabled={markMealMutation.isPending}
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  Consumed
                                </Button>
                             )}
                              
                             {/* Chef/Staff Actions */}
                             {(['chef', 'head_chef'].includes(user?.role || '') || isStaff(user?.role)) && (
                                <RequestFeedbackDialog meal={meal} />
                             )}

                             {/* Feedback Action (for HRs or if active session) */}
                             <FeedbackDialog meal={meal} />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Utensils}
                  title="No meals scheduled"
                  description="No meals have been scheduled for this date"
                  variant="default"
                />
              )}
            </CardContent>
        </TabsContent>

        {/* Meal Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Meal Attendance Records</CardTitle>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              ) : mealAttendance && mealAttendance.length > 0 ? (
                <>
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Meal Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Marked At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mealAttendance.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              <div className="font-medium">{record.student.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {record.student.hall_ticket || record.student.username || '—'}
                              </div>
                            </TableCell>
                            <TableCell>{getMealTypeBadge(record.meal.meal_type)}</TableCell>
                            <TableCell>
                              {new Date(record.meal.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {record.status === 'taken' ? (
                                <Badge variant="outline" className="bg-success/10 text-success border-success/20">Taken</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-secondary/60 text-foreground border-secondary/70">Skipped</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(record.marked_at).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Card List */}
                  <div className="lg:hidden space-y-3">
                     {mealAttendance.map((record) => (
                       <div key={record.id} className="flex items-center justify-between p-4 rounded-2xl bg-card border shadow-sm">
                          <div className="flex-1 min-w-0">
                             <div className="font-bold text-sm truncate">{record.student.name}</div>
                             <div className="text-[10px] text-muted-foreground font-mono truncate">
                               {record.student.hall_ticket} | {record.meal.meal_type.toUpperCase()}
                             </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 ml-4">
                             {record.status === 'taken' ? (
                                <Badge variant="outline" className="bg-success/10 text-success border-success/20 h-5 px-2 text-[10px] font-bold">TAKEN</Badge>
                             ) : (
                                <Badge variant="secondary" className="h-5 px-2 text-[10px] font-bold">SKIPPED</Badge>
                             )}
                             <span className="text-[9px] text-muted-foreground">
                               {new Date(record.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                          </div>
                       </div>
                     ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={Utensils}
                  title="No attendance records"
                  description="No meal attendance has been recorded for this date"
                  variant="info"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        {isAuthority && (
        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Meal Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {['breakfast', 'lunch', 'dinner'].map((mealType) => {
                  const pref = preferences?.find((p) => p.meal_type === mealType);
                  return (
                    <div key={mealType} className="space-y-3 pb-6 border-b last:border-0">
                      <div className="flex items-center justify-between">
                        <Label className="text-base capitalize">{mealType}</Label>
                        {getMealTypeBadge(mealType)}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`pref-${mealType}`} className="text-sm">
                          Preference
                        </Label>
                        <Select
                          defaultValue={pref?.preference || 'regular'}
                          onValueChange={(value) =>
                            updatePreferenceMutation.mutate({
                              meal_type: mealType,
                              preference: value,
                            })
                          }
                        >
                          <SelectTrigger id={`pref-${mealType}`}>
                            <SelectValue placeholder="Select preference" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="regular">Regular</SelectItem>
                            <SelectItem value="vegetarian">Vegetarian</SelectItem>
                            <SelectItem value="vegan">Vegan</SelectItem>
                            <SelectItem value="non-vegetarian">Non-Vegetarian</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dietary-restrictions" className="text-base font-semibold">
                      Dietary Restrictions / Allergies
                    </Label>
                    <Textarea
                      id="dietary-restrictions"
                      placeholder="e.g. No Peanuts, Gluten-free, Jain food only..."
                      defaultValue={preferences?.[0]?.dietary_restrictions || ''}
                      className="rounded-2xl min-h-[100px]"
                      onBlur={(e) => updateDietaryMutation.mutate(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      * Changes are saved automatically when you click away.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Special Requests Tab */}
        <TabsContent value="special" className="space-y-4">
          {/* Special Requests Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                Special Item Requests
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                {isAuthority ? 'View, manage, and submit food requests' : 'Request special items like chapati, hot water, or other meal additions'}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Request Form */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100 space-y-4">
                <h3 className="font-semibold text-foreground">Add New Request</h3>
                <SpecialRequestForm 
                  mutation={createSpecialRequestMutation}
                  loading={createSpecialRequestMutation.isPending}
                />
              </div>

              {/* Submitted Requests */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">
                    {isAuthority ? 'All Student Requests' : 'Your Requests'}
                </h3>
                {requestsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-xl" />
                    ))}
                  </div>
                ) : specialRequests && specialRequests.length > 0 ? (
                  <div className="space-y-3">
                    {specialRequests.map((request: MealSpecialRequest) => (
                      <div
                        key={request.id}
                        className="p-4 border rounded-xl bg-white hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-foreground capitalize">{request.item_name}</p>
                            {isAuthority && (
                                <Badge variant="secondary" className="text-[10px]">
                                    {request.student_name} ({request.hall_ticket})
                                </Badge>
                            )}
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground font-medium">
                            <span className="flex items-center gap-1">
                                <Plus className="h-3 w-3" /> Qty: {request.quantity}
                            </span>
                            <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" /> For: {new Date(request.requested_for_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          {request.notes && (
                            <p className="text-xs text-muted-foreground italic bg-slate-100 p-2 rounded-lg mt-2">
                                <MessageSquare className="h-3 w-3 inline mr-1 opacity-50" />
                                {request.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isAuthority ? (
                              <Select 
                                value={request.status} 
                                onValueChange={(val) => updateSpecialRequestStatusMutation.mutate({ id: request.id, status: val })}
                              >
                                  <SelectTrigger className={cn(
                                      "w-32 h-9 rounded-lg text-xs font-bold",
                                      request.status === 'pending' && "border-yellow-200 bg-yellow-50 text-yellow-700",
                                      request.status === 'approved' && "border-success-200 bg-success-50 text-success-700",
                                      request.status === 'rejected' && "border-red-200 bg-red-50 text-red-700",
                                      request.status === 'delivered' && "border-blue-200 bg-blue-50 text-blue-700"
                                  )}>
                                      <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="pending">⏳ Pending</SelectItem>
                                      <SelectItem value="approved">✅ Approve</SelectItem>
                                      <SelectItem value="delivered">🍽️ Delivered</SelectItem>
                                      <SelectItem value="rejected">❌ Reject</SelectItem>
                                  </SelectContent>
                              </Select>
                          ) : (
                            <Badge
                                variant="outline"
                                className={cn(
                                'capitalize h-8 px-3 rounded-lg font-bold',
                                request.status === 'approved' && 'bg-success/10 text-success border-success/20',
                                request.status === 'delivered' && 'bg-blue-100 text-blue-700 border-blue-200',
                                request.status === 'pending' && 'bg-yellow-100 text-yellow-700 border-yellow-200',
                                request.status === 'rejected' && 'bg-red-100 text-red-700 border-red-200'
                                )}
                            >
                                {request.status}
                            </Badge>
                          )}
                          
                          {!isAuthority && request.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0 hover:bg-red-50 hover:text-red-500 rounded-lg"
                              onClick={() => deleteSpecialRequestMutation.mutate(request.id)}
                              disabled={deleteSpecialRequestMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center text-muted-foreground bg-slate-50 rounded-3xl border border-dashed">
                    <Utensils className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="font-bold">No special requests found</p>
                    <p className="text-sm">New requests will appear here once submitted</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HR Meal Feedback Tab */}
        {isHR && (
          <TabsContent value="feedback" className="space-y-4">
            {/* Feedback Summary Cards */}
            {feedbackStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="pt-6">
                    <div className="space-y-1">
                      <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Total Feedback</p>
                      <p className="text-3xl font-bold text-blue-900">{feedbackStats.total_feedback || 0}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                  <CardContent className="pt-6">
                    <div className="space-y-1">
                      <p className="text-xs text-yellow-600 font-semibold uppercase tracking-wider">Avg Rating</p>
                      <p className="text-3xl font-bold text-yellow-900">{feedbackStats.average_rating?.toFixed(1) || 'N/A'}/5</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-success/20 to-success/30 border-success/40">
                  <CardContent className="pt-6">
                    <div className="space-y-1">
                      <p className="text-xs text-success font-semibold uppercase tracking-wider">Positive</p>
                      <p className="text-3xl font-bold text-success">{feedbackStats.positive_count || 0}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                  <CardContent className="pt-6">
                    <div className="space-y-1">
                      <p className="text-xs text-red-600 font-semibold uppercase tracking-wider">Negative</p>
                      <p className="text-3xl font-bold text-red-900">{feedbackStats.negative_count || 0}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Feedback List */}
            <Card>
              <CardHeader>
                <CardTitle>Student Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                {feedbackLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-xl" />
                    ))}
                  </div>
                ) : mealFeedback && mealFeedback.length > 0 ? (
                  <div className="space-y-3">
                    {mealFeedback.map((feedback: MealFeedback) => (
                      <div
                        key={feedback.id}
                        className="p-4 border rounded-xl bg-white hover:bg-slate-50 transition-colors space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="capitalize">
                                {feedback.meal_type || 'meal'}
                              </Badge>
                              <span className="text-sm font-semibold text-foreground">
                                {feedback.student_name || 'Unknown'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({feedback.hall_ticket || 'N/A'})
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(feedback.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    'h-4 w-4',
                                    i < feedback.rating
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'text-muted-foreground'
                                  )}
                                />
                              ))}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                feedback.resolved
                                  ? 'bg-success/10 text-success border-success/20'
                                  : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                              )}
                            >
                              {feedback.resolved ? 'Resolved' : 'Pending'}
                            </Badge>
                          </div>
                        </div>

                        {feedback.comment && (
                          <p className="text-sm text-foreground bg-slate-50 p-3 rounded-lg italic">
                            "{feedback.comment}"
                          </p>
                        )}

                        {!feedback.resolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markFeedbackAsResolvedMutation.mutate(feedback.id)}
                            disabled={markFeedbackAsResolvedMutation.isPending}
                            className="text-xs h-8"
                          >
                            Mark as Resolved
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    <Star className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>No feedback received yet</p>
                    <p className="text-xs">Student feedback will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
