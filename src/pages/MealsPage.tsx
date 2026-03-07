import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Utensils, Calendar as CalendarIcon, Check, Users, UserMinus, Star, Plus, Trash2, MessageSquare, Filter } from 'lucide-react';
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
import { useRealtimeQuery, useWebSocketEvent } from '@/hooks/useWebSocket';
// rbac imports removed — authority check is inline
import type { Meal, MealFeedback, MealSpecialRequest, MealAttendance } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { SEO } from '@/components/common/SEO';

interface MealPreference {
  id: number;
  meal_type: string;
  preference: string;
  dietary_restrictions: string;
}

const CountdownTimer = ({ targetHour }: { targetHour: number }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(targetHour, 0, 0, 0);
      
      if (now > target) {
        target.setDate(target.getDate() + 1);
      }

      const diff = target.getTime() - now.getTime();
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetHour]);

  return <span>{timeLeft}</span>;
};

interface MealForecast {
  date: string;
  meal_type?: string;
  total_students: number;
  excluded_leave: number;
  excluded_absent: number;
  excluded_skipped_meal: number;
  students_on_leave: number; // For backward compatibility
  students_marked_absent: number; // For backward compatibility
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

    const isHR = user && (['admin', 'super_admin', 'warden', 'head_warden', 'chef', 'head_chef'].includes(user.role) || user.is_student_hr);
    const isRequested = meal.is_feedback_active;

    const buttonLabel = isRequested ? 'Submit Feedback' : 'Feedback Closed';

    return (
        <Dialog open={open} onOpenChange={(val) => (isRequested || isHR) && setOpen(val)}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    disabled={!isRequested && !isHR}
                    className={cn(
                    "flex-1 rounded-xl h-11 font-black transition-all shadow-sm",
                    isRequested ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 animate-pulse ring-2 ring-primary/10" : "opacity-50 grayscale"
                )}>
                    <Star className="h-4 w-4 mr-2" />
                    {buttonLabel}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl text-black">
                <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
                  <DialogHeader>
                      <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <Star className="h-6 w-6 text-primary fill-primary" />
                        {isRequested ? 'Feedback Requested' : 'Rate Meal Quality'}
                      </DialogTitle>
                      <DialogDescription className="font-medium">
                          {meal.feedback_prompt || `Provide feedback for ${meal.meal_type} on ${new Date(meal.date).toLocaleDateString()}.`}
                      </DialogDescription>
                  </DialogHeader>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex flex-col items-center gap-4 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Rating</Label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    className={cn(
                                        "p-1 transition-all active:scale-75 focus:outline-none hover:scale-110",
                                        star <= rating ? "text-primary" : "text-gray-200"
                                    )}
                                >
                                    <Star className={cn("h-10 w-10 fill-current", star <= rating ? "fill-primary" : "")} />
                                </button>
                            ))}
                        </div>
                        <p className="text-xs font-bold text-primary/60">
                          {rating === 5 ? 'Excellent! 😍' : rating === 4 ? 'Very Good! 😊' : rating === 3 ? 'Good! 🙂' : rating === 2 ? 'Fair 😐' : 'Poor ☹️'}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Comments (Optional)</Label>
                        <Textarea
                            placeholder="Describe taste, quality, hygiene, or suggestions..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="resize-none h-32 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary p-4"
                        />
                    </div>
                </div>

                <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 px-6 pb-6 border-t flex flex-col gap-3">
                    <Button 
                        onClick={() => feedbackMutation.mutate({ rating, comment })}
                        disabled={feedbackMutation.isPending}
                        className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-2xl shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
                    </Button>
                    <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                </div>
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
                    "rounded-xl font-bold h-11 px-4 transition-all active:scale-95",
                    meal.is_feedback_active ? "bg-black text-white hover:bg-black/90 shadow-lg shadow-black/20" : "bg-gray-100 text-foreground hover:bg-gray-200 border-0"
                )}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {meal.is_feedback_active ? 'Stop Requests' : 'Request Feedback'}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white rounded-3xl text-black">
                <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-6 py-4 border-b">
                  <DialogHeader>
                      <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                        <MessageSquare className="h-6 w-6 text-primary" />
                        Request Student Feedback
                      </DialogTitle>
                      <DialogDescription className="font-medium">
                          Students will see a popup on their dashboard to rate this {meal.meal_type}.
                      </DialogDescription>
                  </DialogHeader>
                </div>

                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Feedback Prompt / Question</Label>
                        <Input
                            placeholder="e.g. How was the special Sunday biryani today?"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="h-14 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary text-base px-5"
                        />
                    </div>
                </div>

                <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur-md pt-4 px-6 pb-6 border-t flex flex-col gap-3">
                    <Button 
                        onClick={() => toggleMutation.mutate({ is_active: !meal.is_feedback_active, prompt })}
                        disabled={toggleMutation.isPending}
                        className={cn(
                            "w-full h-14 font-black text-lg uppercase tracking-wider rounded-2xl transition-all active:scale-95 shadow-sm",
                            meal.is_feedback_active ? "bg-black text-white" : "primary-gradient text-white"
                        )}
                    >
                        {toggleMutation.isPending ? 'Processing...' : meal.is_feedback_active ? 'Stop Feedback Session' : 'Start Feedback Session'}
                    </Button>
                    <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function MenuUploadDialog({ date }: { date: string }) {
    const [open, setOpen] = useState(false);
    const [mealType, setMealType] = useState('breakfast');
    const [menu, setMenu] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const queryClient = useQueryClient();

    const uploadMutation = useMutation({
        mutationFn: async (data: { date: string; meal_type: string; menu: string; start_time?: string; end_time?: string }) => {
            const payload: Record<string, unknown> = { ...data };
            if (!payload.start_time) delete payload.start_time;
            if (!payload.end_time) delete payload.end_time;
            await api.post('/meals/', payload);
        },
        onSuccess: () => {
            toast.success('Menu updated successfully');
            setOpen(false);
            setMenu('');
            setStartTime('');
            setEndTime('');
            queryClient.invalidateQueries({ queryKey: ['meals'] });
        },
        onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, 'Failed to update menu'));
        }
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="rounded-2xl h-11 primary-gradient text-white font-bold shadow-lg shadow-primary/20 transition-all active:scale-95">
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Menu
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md w-[95vw] p-0 border-none bg-white rounded-3xl text-black">
                <div className="p-6 space-y-6">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Upload Menu</DialogTitle>
                        <DialogDescription>Schedule a menu item for {new Date(date).toLocaleDateString()}.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Meal Type</Label>
                            <Select value={mealType} onValueChange={setMealType}>
                                <SelectTrigger className="h-12 rounded-2xl border-0 bg-gray-50 focus:ring-primary">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="breakfast">Breakfast</SelectItem>
                                    <SelectItem value="lunch">Lunch</SelectItem>
                                    <SelectItem value="dinner">Dinner</SelectItem>
                                    <SelectItem value="special">Special</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Start Time (Optional)</Label>
                                <Input 
                                    type="time" 
                                    value={startTime} 
                                    onChange={(e) => setStartTime(e.target.value)} 
                                    className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">End Time (Optional)</Label>
                                <Input 
                                    type="time" 
                                    value={endTime} 
                                    onChange={(e) => setEndTime(e.target.value)} 
                                    className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Menu Description</Label>
                            <Textarea 
                                placeholder="e.g. Chicken Biryani, Raita, and Gulab Jamun"
                                value={menu}
                                onChange={(e) => setMenu(e.target.value)}
                                className="h-32 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary p-4"
                            />
                        </div>
                    </div>

                    <Button 
                        onClick={() => uploadMutation.mutate({ date, meal_type: mealType, menu, start_time: startTime, end_time: endTime })}
                        disabled={uploadMutation.isPending || !menu.trim()}
                        className="w-full h-14 primary-gradient text-white font-black rounded-2xl shadow-sm hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        {uploadMutation.isPending ? 'Uploading...' : 'Save Menu'}
                    </Button>
                </div>
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="item-name" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
          Select Item
        </Label>
        <div className="flex gap-2 flex-wrap mb-2">
          {COMMON_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setItemName(item)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold transition-all border-2 active:scale-90',
                itemName === item
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105'
                  : 'bg-white text-foreground border-gray-100 hover:border-primary/30'
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
          className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="quantity" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
            Quantity
          </Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            max="10"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="h-12 rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary px-4 font-medium"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="request-date" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
            Requested For
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-medium border-0 h-12 rounded-2xl bg-gray-50 px-4 transition-all hover:bg-gray-100",
                  !requestDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                {requestDate ? format(requestDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl" align="start">
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
        <Label htmlFor="notes" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
          Additional Notes (Optional)
        </Label>
        <Textarea
          id="notes"
          placeholder="e.g., Hot water for tea, Extra spicy, etc..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-2xl border-0 bg-gray-50 focus-visible:ring-primary p-4 min-h-[100px] font-medium"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-2xl shadow-sm hover:scale-[1.02] active:scale-95 transition-all mt-2"
      >
        <Plus className="h-5 w-5 mr-1" />
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

  // Calculate Next Meal
  const getNextMeal = (mealsData: Meal[] | undefined) => {
    if (!mealsData || mealsData.length === 0) return null;
    const now = new Date();
    const currentHour = now.getHours();
    
    // Sort meals by type for logical progression
    const mealOrder = { breakfast: 1, lunch: 2, dinner: 3 };
    const sortedMeals = [...mealsData].sort((a, b) => 
        (mealOrder[a.meal_type as keyof typeof mealOrder] || 9) - 
        (mealOrder[b.meal_type as keyof typeof mealOrder] || 9)
    );

    if (currentHour < 10) return sortedMeals.find(m => m.meal_type === 'breakfast') || sortedMeals[0];
    if (currentHour < 14) return sortedMeals.find(m => m.meal_type === 'lunch') || sortedMeals[0];
    return sortedMeals.find(m => m.meal_type === 'dinner') || sortedMeals[sortedMeals.length - 1];
  };

  // Realtime updates for special requests
  useWebSocketEvent('special_request_status', () => {
    queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] });
  });
  
  useWebSocketEvent('new_special_request_pending', () => {
    if (['warden', 'head_warden', 'admin', 'super_admin'].includes(user?.role || '')) {
       queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] });
    }
  });

  useWebSocketEvent('special_request_approved', () => {
     if (user?.role === 'chef' || user?.role === 'head_chef') {
        queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] });
     }
  });

  // Real-time zero-refresh sync for dining forecast
  useRealtimeQuery('forecast_updated', 'meal-forecast');

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
  const isHR = user && (['admin', 'super_admin', 'warden', 'head_warden', 'chef', 'head_chef'].includes(user.role) || user.is_student_hr);
  
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

  const approveSpecialRequestMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/meals/special-requests/${id}/approve/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] });
      toast.success('Request approved');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to approve request'));
    },
  });

  const rejectSpecialRequestMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/meals/special-requests/${id}/reject/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] });
      toast.success('Request rejected');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to reject request'));
    },
  });

  const deliverSpecialRequestMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/meals/special-requests/${id}/deliver/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-special-requests'] });
      toast.success('Marked as delivered');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Failed to deliver request'));
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
      <SEO 
        title="Meal Management" 
        description="View daily hostel menus, submit meal feedback, and manage kitchen forecasts. Coordinate dining services for the SMG community."
      />
      <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black flex items-center gap-2 text-foreground tracking-tight">
            <div className="p-2 bg-primary/10 rounded-2xl text-primary">
                <Utensils className="h-6 w-6" />
            </div>
            Dining & Nutrition
          </h1>
          <p className="text-muted-foreground font-medium pl-1">Daily menus, special requests, and nutritional tracking</p>
      </div>

      {/* Next Meal Premium Showcase */}
      {meals && meals.length > 0 && (
        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-[#0F172A] text-white relative group">
           <div className="absolute inset-0 opacity-10 pointer-events-none" 
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}>
           </div>
           <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform duration-700">
              <Utensils className="h-32 w-32" />
           </div>
           
           <CardContent className="p-8 relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="relative">
                 <div className="w-24 h-24 rounded-3xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_40px_rgba(var(--primary-rgb),0.3)]">
                    <Utensils className="h-10 w-10" />
                 </div>
                 <Badge className="absolute -bottom-2 -right-2 bg-success text-white border-0 font-black tracking-widest px-3 py-1 scale-110 shadow-lg">NEXT</Badge>
              </div>

              <div className="flex-1 text-center md:text-left space-y-2">
                 <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/80">Upcoming Service</span>
                    {getNextMeal(meals) && getMealTypeBadge(getNextMeal(meals)!.meal_type)}
                 </div>
                 <h2 className="text-3xl font-black tracking-tight leading-tight">
                    {getNextMeal(meals)?.menu || 'Updating Menu Data...'}
                 </h2>
                 <p className="text-white/60 font-medium text-sm">
                    {getNextMeal(meals)?.available ? 'Service is currently open' : 'Service starting soon'}
                 </p>
              </div>

              <div className="flex flex-col gap-3 shrink-0">
                 <Button 
                    className="h-14 px-8 rounded-2xl primary-gradient text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                    onClick={() => {
                       const nextMeal = getNextMeal(meals);
                       if (nextMeal && user?.role === 'student') {
                          markMealMutation.mutate({ meal_id: nextMeal.id, status: 'taken' });
                       }
                    }}
                 >
                    {user?.role === 'student' ? 'Confirm Consumption' : 'Service Status'}
                 </Button>
              </div>
           </CardContent>
           
           <div className="h-1.5 w-full bg-primary/20">
              <div className="h-full bg-primary animate-pulse w-2/3" />
           </div>
        </Card>
      )}

      {/* Authority-only Forecast Card */}
      {isAuthority && (
        <Card className="rounded-3xl border-0 shadow-sm bg-gradient-to-r from-primary/5 to-white overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 font-black">
              <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-3xl border-0 shadow-sm flex flex-col justify-center gap-1 group hover:scale-[1.02] transition-transform">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-2">
                    <Users className="h-3 w-3" /> Total Students
                  </p>
                  <p className="text-3xl font-black text-foreground">{forecast?.total_students || 0}</p>
                </div>
                
                <div className="bg-white p-5 rounded-3xl border-0 shadow-sm flex flex-col justify-center gap-1 group hover:scale-[1.02] transition-transform border-l-4 border-l-blue-400">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-2">
                    <CalendarIcon className="h-3 w-3" /> On Leave
                  </p>
                  <p className="text-3xl font-black text-blue-500">{forecast?.excluded_leave || 0}</p>
                </div>

                <div className="bg-white p-5 rounded-3xl border-0 shadow-sm flex flex-col justify-center gap-1 group hover:scale-[1.02] transition-transform border-l-4 border-l-orange-400">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-2">
                    <Utensils className="h-3 w-3" /> Skipped Meal
                  </p>
                  <p className="text-3xl font-black text-orange-500">{forecast?.excluded_skipped_meal || 0}</p>
                </div>

                <div className="bg-white p-5 rounded-3xl border-0 shadow-sm flex flex-col justify-center gap-1 group hover:scale-[1.02] transition-transform border-l-4 border-l-red-400">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-2">
                    <UserMinus className="h-3 w-3" /> Absent
                  </p>
                  <p className="text-3xl font-black text-red-500">{forecast?.excluded_absent || forecast?.students_marked_absent || 0}</p>
                </div>

                <div className="bg-black text-white p-5 rounded-3xl border-0 shadow-lg shadow-black/20 flex flex-col justify-center gap-1 group hover:scale-[1.02] transition-transform relative overflow-hidden lg:col-span-1 sm:col-span-2">
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
      {/* ── MOBILE STUDENT SIMPLIFIED VIEW ── */}
      {user?.role === 'student' && !isAuthority && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Next Meal & Countdown */}
          {(() => {
            const nextMeal = getNextMeal(meals);
            const mealTime = nextMeal?.start_time 
              ? parseInt(nextMeal.start_time.split(':')[0], 10) 
              : nextMeal?.meal_type === 'breakfast' ? 7 : nextMeal?.meal_type === 'lunch' ? 12 : 19;
            
            return (
              <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-[#0F172A] text-white relative group">
                <div className="absolute inset-0 opacity-10 pointer-events-none" 
                     style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}>
                </div>
                <CardContent className="p-6 relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/20 rounded-xl text-primary">
                          <Utensils className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">Coming Up Next</p>
                          <p className="text-lg font-black tracking-tight">{nextMeal?.meal_type?.toUpperCase() || 'UPDATING...'}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Starts In</p>
                        <div className="text-lg font-black font-mono text-primary bg-primary/10 px-3 py-1 rounded-xl">
                           <CountdownTimer targetHour={mealTime} />
                        </div>
                     </div>
                  </div>

                  <div className="bg-white/5 backdrop-blur-md rounded-3xl p-5 border border-white/10 space-y-3">
                     <h2 className="text-xl font-bold leading-tight line-clamp-2">
                        {nextMeal?.menu || 'Fetching today\'s menu...'}
                     </h2>
                     <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-black border-0",
                          nextMeal?.available ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                        )}>
                          {nextMeal?.available ? '• OPEN NOW' : '• STARTING SOON'}
                        </Badge>
                        <Badge variant="outline" className="bg-white/10 text-white/60 border-0 px-2 text-[10px]">
                          {nextMeal?.meal_type === 'special' ? 'Chef Special ⭐' : 'Regular Service'}
                        </Badge>
                     </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 h-11 primary-gradient text-white font-black rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all"
                      disabled={!nextMeal?.available || markMealMutation.isPending}
                      onClick={() => nextMeal && markMealMutation.mutate({ meal_id: nextMeal.id, status: 'taken' })}
                    >
                      {markMealMutation.isPending ? 'Processing...' : 'Confirm'}
                    </Button>
                    {nextMeal && <FeedbackDialog meal={nextMeal} />}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Preferences Quick Card */}
          <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-secondary/20 rounded-xl text-foreground">
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Meal Preferences</h3>
                  <p className="text-[10px] text-muted-foreground font-medium">Synced with kitchen forecast</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {['breakfast', 'lunch', 'dinner'].map((type) => {
                  const currentPref = preferences?.find((p) => p.meal_type === type)?.preference || 'regular';
                  return (
                    <div key={type} className="space-y-1.5">
                       <p className="text-[9px] font-black uppercase tracking-widest text-center opacity-40">{type}</p>
                       <Select defaultValue={currentPref} onValueChange={(val) => updatePreferenceMutation.mutate({ meal_type: type, preference: val })}>
                        <SelectTrigger className="h-10 rounded-xl text-xs capitalize border-muted bg-muted/30">
                          <SelectValue placeholder={type} />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-0 shadow-2xl">
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="veg">Veg</SelectItem>
                          <SelectItem value="non_veg">Non-Veg</SelectItem>
                          <SelectItem value="special">Special</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* New Special Request Section */}
          <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden">
             <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                    <Plus className="h-4 w-4" />
                  </div>
                  Special Meal Request
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                <SpecialRequestForm mutation={createSpecialRequestMutation} loading={createSpecialRequestMutation.isPending} />
                
                {specialRequests && specialRequests.length > 0 && (
                  <div className="space-y-2 mt-4 pt-4 border-t border-dashed">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Recent Requests</p>
                    {specialRequests.slice(0, 3).map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-2xl">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-white rounded-lg shadow-sm border border-border/10">
                              <Utensils className="h-3 w-3 text-primary" />
                           </div>
                           <div>
                              <p className="text-xs font-bold">{req.item_name}</p>
                              <p className="text-[9px] text-muted-foreground">{req.status.toUpperCase()} · {req.requested_for_date}</p>
                           </div>
                        </div>
                        <Badge variant="outline" className={cn(
                           "text-[8px] font-black border-0 px-2 py-0.5 rounded-full",
                           req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                           req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                           req.status === 'delivered' ? 'bg-blue-100 text-blue-700' : 'bg-primary/20 text-primary'
                        )}>
                          {req.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
             </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="schedule" className={cn("space-y-6", user?.role === 'student' && !isAuthority && "hidden")}>
        <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <TabsList className="flex w-max sm:w-full bg-gray-100/50 p-1 rounded-2xl border border-gray-100">
            <TabsTrigger value="schedule" className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Meal Schedule</TabsTrigger>
            {isAuthority && <TabsTrigger value="attendance" className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Meal Attendance</TabsTrigger>}
            <TabsTrigger value="preferences" className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Preferences</TabsTrigger>
            <TabsTrigger value="special" className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Special Requests</TabsTrigger>
            {isAuthority && isHR && <TabsTrigger value="feedback" className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Meal Feedback</TabsTrigger>}
          </TabsList>
        </div>

        {/* Meal Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden">
            <CardHeader className="pb-2 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider font-black text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  Filters
                </CardTitle>
                {user && (['chef', 'head_chef', 'admin', 'super_admin'].includes(user.role)) && (
                  <MenuUploadDialog date={selectedDate} />
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Date</Label>
                  <DatePicker
                    date={selectedDate ? new Date(selectedDate) : undefined}
                    onSelect={(date) => setSelectedDate(date ? format(date, 'yyyy-MM-dd') : '')}
                    className="w-full h-11 rounded-xl border-gray-200 bg-white shadow-sm"
                    placeholder="Pick a date"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Meal Type</Label>
                  <Select value={selectedMealType} onValueChange={setSelectedMealType}>
                    <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white shadow-sm">
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
                        <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium flex-wrap">
                          <div className="flex items-center gap-2">
                             <div className="p-2 bg-muted rounded-xl">
                               <CalendarIcon className="h-4 w-4 text-primary" />
                             </div>
                             {new Date(meal.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                          </div>
                          
                          <div className="flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/10">
                            <Utensils className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-black tracking-widest text-primary/80 uppercase">
                              {meal.start_time && meal.end_time 
                                ? `${meal.start_time.substring(0, 5)} - ${meal.end_time.substring(0, 5)}`
                                : meal.meal_type === 'breakfast' ? '07:00 AM - 09:00 AM' 
                                : meal.meal_type === 'lunch' ? '12:20 PM - 01:30 PM' 
                                : meal.meal_type === 'dinner' ? '07:30 PM - 08:50 PM'
                                : 'Custom Time'}
                            </span>
                          </div>
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
                              {(['chef', 'head_chef', 'warden', 'head_warden'].includes(user?.role || '')) && (
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
        <TabsContent value="preferences" className="space-y-6">
          <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden">
            <CardHeader className="pb-4 border-b border-gray-100 bg-gray-50/20">
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <div className="p-1.5 bg-black/5 rounded-lg text-black">
                  <Star className="h-5 w-5" />
                </div>
                Dietary Preferences
              </CardTitle>
              <p className="text-sm text-muted-foreground font-medium mt-1">
                Customize your meal choices and notify the kitchen about allergies.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {['breakfast', 'lunch', 'dinner'].map((mealType) => {
                    const pref = preferences?.find((p) => p.meal_type === mealType);
                    return (
                      <div key={mealType} className="p-5 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{mealType}</Label>
                          {getMealTypeBadge(mealType)}
                        </div>
                        <div className="space-y-2">
                          <Select
                            defaultValue={pref?.preference || 'regular'}
                            onValueChange={(value) =>
                              updatePreferenceMutation.mutate({
                                meal_type: mealType,
                                preference: value,
                              })
                            }
                          >
                            <SelectTrigger id={`pref-${mealType}`} className="h-11 rounded-xl border-0 bg-white shadow-sm ring-1 ring-gray-100 focus:ring-primary">
                              <SelectValue placeholder="Select type" />
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
                </div>

                <div className="pt-4 space-y-4">
                  <div className="bg-red-50/30 p-6 rounded-3xl border border-red-100/50 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 bg-red-400 rounded-full" />
                      <Label htmlFor="dietary-restrictions" className="text-sm font-black uppercase tracking-widest text-red-900/70">
                        Restrictions & Allergies
                      </Label>
                    </div>
                    <Textarea
                      id="dietary-restrictions"
                      placeholder="e.g. No Peanuts, Gluten-free, Jain food only..."
                      defaultValue={preferences?.[0]?.dietary_restrictions || ''}
                      className="rounded-2xl border-0 bg-white/80 focus-visible:ring-red-400 p-4 min-h-[120px] font-medium shadow-inner"
                      onBlur={(e) => updateDietaryMutation.mutate(e.target.value)}
                    />
                    <div className="flex items-center gap-2 text-[10px] text-red-600/60 font-bold uppercase tracking-tighter pl-1">
                      <div className="w-1 h-1 bg-red-400 rounded-full" />
                      Changes are saved automatically when you click away.
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Special Requests Tab */}
        <TabsContent value="special" className="space-y-6">
          {/* Special Requests Card */}
          <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden">
            <CardHeader className="pb-4 border-b border-gray-100 bg-gray-50/20">
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                  <Utensils className="h-5 w-5" />
                </div>
                Special Item Requests
              </CardTitle>
              <p className="text-sm text-muted-foreground font-medium mt-1">
                {isAuthority ? 'View, manage, and submit food requests for students.' : 'Request special items like chapati, hot water, or other meal additions.'}
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {/* Request Form */}
              <div className="bg-gradient-to-br from-primary/5 to-white p-6 rounded-3xl border border-gray-100 shadow-inner space-y-6">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 bg-primary rounded-full" />
                  <h3 className="font-black text-lg tracking-tight uppercase">New Request</h3>
                </div>
                <SpecialRequestForm 
                  mutation={createSpecialRequestMutation}
                  loading={createSpecialRequestMutation.isPending}
                />
              </div>

              {/* Submitted Requests List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-lg tracking-tight uppercase flex items-center gap-2">
                    <div className="w-1 h-6 bg-black rounded-full" />
                    {isAuthority ? 'Global Request Feed' : 'Your Application History'}
                  </h3>
                </div>
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
                        className="p-5 rounded-2xl bg-gray-50/50 hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100 flex items-center justify-between gap-4 group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-lg text-foreground truncate">
                              {request.quantity}x {request.item_name}
                            </h4>
                            {isAuthority && (
                                <Badge variant="secondary" className="text-[10px] h-5 rounded-full font-mono uppercase bg-black text-white px-2">
                                  {request.student_name || 'STUDENT'}
                                </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground/60 uppercase tracking-tighter">
                            <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" /> Scheduled: {new Date(request.requested_for_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                          {/* Role-Based Actions */}
                          {user && (['admin', 'super_admin', 'warden', 'head_warden'].includes(user.role)) && request.status === 'pending' && (
                              <div className="flex gap-2">
                                 <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="h-9 px-3 rounded-xl border-success/30 text-success hover:bg-success/10 font-bold"
                                    onClick={() => approveSpecialRequestMutation.mutate(request.id)}
                                    disabled={approveSpecialRequestMutation.isPending}
                                 >
                                    Approve
                                 </Button>
                                 <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="h-9 px-3 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-bold"
                                    onClick={() => rejectSpecialRequestMutation.mutate(request.id)}
                                    disabled={rejectSpecialRequestMutation.isPending}
                                 >
                                    Reject
                                 </Button>
                              </div>
                          )}

                          {user && (['chef', 'head_chef'].includes(user.role)) && request.status === 'approved' && (
                              <Button 
                                size="sm" 
                                className="h-9 px-4 rounded-xl primary-gradient text-white font-bold shadow-lg shadow-primary/20"
                                onClick={() => deliverSpecialRequestMutation.mutate(request.id)}
                                disabled={deliverSpecialRequestMutation.isPending}
                              >
                                Mark Delivered
                              </Button>
                          )}

                          <Badge
                              variant="outline"
                              className={cn(
                              'capitalize h-9 px-4 rounded-xl font-black text-[10px] tracking-widest',
                              request.status === 'approved' && 'bg-success/5 text-success border-success/20',
                              request.status === 'delivered' && 'bg-blue-50 text-blue-700 border-blue-200',
                              request.status === 'pending' && 'bg-yellow-50 text-yellow-700 border-yellow-200',
                              request.status === 'rejected' && 'bg-red-50 text-red-700 border-red-200'
                              )}
                          >
                              {request.status.toUpperCase()}
                          </Badge>
                          
                          {user?.role === 'student' && request.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0 hover:bg-red-50 hover:text-red-500 rounded-xl"
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
