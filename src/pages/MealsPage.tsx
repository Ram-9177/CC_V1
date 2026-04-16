import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Utensils, Calendar as CalendarIcon, Check, Users, UserMinus, Star, Plus, Trash2, MessageSquare, Filter, Megaphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CardGridSkeleton, ListSkeleton } from '@/components/common/PageSkeleton';
import { EmptyState } from '@/components/ui/empty-state';
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
import {
  useMealsList,
  useMealForecast,
  useMealAttendance,
  useMealPreferences,
  useMealSpecialRequests,
  useMealFeedback,
  useMealFeedbackStats,
  useMarkMealAttendance,
  useUpdateMealPreferences,
  useDeleteSpecialRequest,
  useApproveSpecialRequest,
  useRejectSpecialRequest,
  useDeliverSpecialRequest,
  useResolveMealFeedback,
  useUpdateMeal,
  useBulkUpdateMealSchedule,
} from '@/hooks/features/useMeals';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { useRealtimeQuery, useWebSocketEvent } from '@/hooks/useWebSocket';
import { isWarden, isTopLevelManagement } from '@/lib/rbac';
import type { Meal, MealFeedback, MealSpecialRequest, MealAttendance } from '@/types';
import { SEO } from '@/components/common/SEO';
import { DatePicker } from '@/components/ui/date-picker';
import { format, addDays } from 'date-fns';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

// Extracted Components
import { FeedbackDialog } from '@/components/meals/FeedbackDialog';
import { RequestFeedbackDialog } from '@/components/meals/RequestFeedbackDialog';
import { MenuUploadDialog } from '@/components/meals/MenuUploadDialog';
import { SpecialRequestForm } from '@/components/meals/SpecialRequestForm';

// Dedicated Dialog for Chefs to update meal info
const MealTimingDialog = ({ meal }: { meal: Meal }) => {
  const [menu, setMenu] = useState(meal.menu || '');
  const [startTime, setStartTime] = useState(meal.start_time?.substring(0, 5) || '07:00');
  const [endTime, setEndTime] = useState(meal.end_time?.substring(0, 5) || '09:00');
  const [isBulk, setIsBulk] = useState(false);
  const [bulkDays, setBulkDays] = useState('7');
  
  const updateMealMutation = useUpdateMeal();
  const bulkUpdateMutation = useBulkUpdateMealSchedule();

  const handleUpdate = () => {
    if (isBulk) {
      const startDate = meal.meal_date;
      const endDate = format(addDays(new Date(meal.meal_date), parseInt(bulkDays)), 'yyyy-MM-dd');
      
      bulkUpdateMutation.mutate({
        meal_type: meal.meal_type,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        start_date: startDate,
        end_date: endDate,
        description: menu
      }, {
        onSuccess: () => toast.success(`Updated schedule for next ${bulkDays} days`),
        onError: (e) => toast.error(getApiErrorMessage(e, 'Bulk update failed')),
      });
    } else {
      updateMealMutation.mutate({ 
        id: meal.id, 
        menu, 
        start_time: `${startTime}:00`, 
        end_time: `${endTime}:00` 
      }, {
        onSuccess: () => toast.success('Meal information updated successfully'),
        onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to update meal')),
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
          <Filter className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl border-border/60 shadow-2xl sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" />
            Service Management
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Menu Description</Label>
            <Textarea 
              value={menu} 
              onChange={(e) => setMenu(e.target.value)}
              placeholder="What are we serving?"
              className="rounded-xl border-border/60 bg-muted/20 min-h-[80px] font-medium"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Starts At</Label>
               <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-xl border-border/60" />
            </div>
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Ends At</Label>
               <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-xl border-border/60" />
            </div>
          </div>
          
          <div className="pt-4 border-t border-border/40 space-y-4">
             <div className="flex items-center space-x-2">
                <Checkbox id="bulk" checked={isBulk} onCheckedChange={(val: boolean) => setIsBulk(val)} />
                <Label htmlFor="bulk" className="text-xs font-bold text-foreground/80 cursor-pointer">Apply settings for multiple days</Label>
             </div>
             
             {isBulk && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Duration (Next X Days)</Label>
                   <Input 
                      type="number" 
                      value={bulkDays} 
                      onChange={(e) => setBulkDays(e.target.value)} 
                      min="1" max="30"
                      className="rounded-xl border-border/60" 
                   />
                </div>
             )}
          </div>
        </div>
        <DialogFooter>
          <Button 
            className="w-full h-12 rounded-xl font-black uppercase tracking-wider shadow-lg shadow-primary/20"
            onClick={handleUpdate}
            disabled={updateMealMutation.isPending || bulkUpdateMutation.isPending}
          >
            {updateMealMutation.isPending || bulkUpdateMutation.isPending ? 'Syncing...' : isBulk ? 'Apply to Range' : 'Update Today'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface MealPreference {
  id: number;
  meal_type: string;
  preference: string;
  dietary_restrictions: string;
}

interface FeedbackStatsData {
  total_feedback: number;
  average_rating: number;
  positive_count: number;
  negative_count: number;
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

export default function MealsPage() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedMealType, setSelectedMealType] = useState<string>('all');

  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  
  // Unified authority check using RBAC helpers
  const isAuthority = user && (
    isTopLevelManagement(user.role) || 
    isWarden(user.role) || 
    ['chef', 'head_chef'].includes(user.role) || 
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

  // Calculate Next Meal with Robust Defaults
  const getNextMeal = (mealsData: Meal[] | undefined): Partial<Meal> | null => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Default system meal objects if none exist in DB
    const defaultMeals: Partial<Meal>[] = [
      { id: -1, meal_type: 'breakfast', start_time: '07:00:00', end_time: '09:00:00', menu: 'Breakfast loading...', available: true, meal_date: format(now, 'yyyy-MM-dd') },
      { id: -2, meal_type: 'lunch', start_time: '12:20:00', end_time: '14:20:00', menu: 'Lunch loading...', available: true, meal_date: format(now, 'yyyy-MM-dd') },
      { id: -3, meal_type: 'dinner', start_time: '19:30:00', end_time: '21:30:00', menu: 'Dinner loading...', available: true, meal_date: format(now, 'yyyy-MM-dd') }
    ];

    const sourceData = (mealsData && mealsData.length > 0) ? mealsData : defaultMeals as Meal[];
    
    // Sort meals by type for logical progression
    const mealOrder = { breakfast: 1, lunch: 2, dinner: 3 };
    const sortedMeals = [...sourceData].sort((a, b) => 
        (mealOrder[a.meal_type as keyof typeof mealOrder] || 9) - 
        (mealOrder[b.meal_type as keyof typeof mealOrder] || 9)
    );

    if (currentHour < 10) return sortedMeals.find(m => m.meal_type === 'breakfast') || sortedMeals[0];
    if (currentHour < 14) return sortedMeals.find(m => m.meal_type === 'lunch') || sortedMeals[0];
    return sortedMeals.find(m => m.meal_type === 'dinner') || sortedMeals[sortedMeals.length - 1];
  };

  const getMealWithFallback = (type: string): Partial<Meal> => {
    const meal = meals?.find(m => m.meal_type === type);
    if (meal) return meal;
    
    const now = new Date();
    const fallbacks: Record<string, Partial<Meal>> = {
      breakfast: { id: -1, meal_type: 'breakfast', start_time: '07:00:00', end_time: '09:00:00', menu: 'No menu posted', available: false, meal_date: format(now, 'yyyy-MM-dd') },
      lunch: { id: -2, meal_type: 'lunch', start_time: '12:20:00', end_time: '14:20:00', menu: 'No menu posted', available: false, meal_date: format(now, 'yyyy-MM-dd') },
      dinner: { id: -3, meal_type: 'dinner', start_time: '19:30:00', end_time: '21:30:00', menu: 'No menu posted', available: false, meal_date: format(now, 'yyyy-MM-dd') }
    };
    return fallbacks[type] || fallbacks.breakfast;
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

  // Queries from hooks
  const { data: meals, isLoading: mealsLoading } = useMealsList<Meal>(selectedDate);
  const { data: forecast, isLoading: forecastLoading } = useMealForecast<MealForecast>(selectedDate, selectedMealType, !!isAuthority);
  const { data: mealAttendance, isLoading: attendanceLoading } = useMealAttendance<MealAttendance>(selectedDate, selectedMealType, !!isAuthority);
  const { data: preferences } = useMealPreferences<MealPreference>(user?.id);
  const { data: specialRequests, isLoading: requestsLoading } = useMealSpecialRequests<MealSpecialRequest>();

  // HR-specific check using refined role system
  const isHR = user && (
    isTopLevelManagement(user.role) || 
    isWarden(user.role) || 
    ['chef', 'head_chef'].includes(user.role) || 
    user.is_student_hr
  );

  const { data: mealFeedback, isLoading: feedbackLoading } = useMealFeedback<MealFeedback>(selectedDate, !!isHR);
  const { data: feedbackStats } = useMealFeedbackStats<FeedbackStatsData>(selectedDate, selectedMealType, !!isHR);

  // Mutations from hooks — toasts added at call sites
  const deleteSpecialRequestMutation = useDeleteSpecialRequest();
  const markMealMutation = useMarkMealAttendance();
  const updatePreferenceMutation = useUpdateMealPreferences();
  const updateDietaryMutation = useUpdateMealPreferences();
  const markFeedbackAsResolvedMutation = useResolveMealFeedback();
  const approveSpecialRequestMutation = useApproveSpecialRequest();
  const rejectSpecialRequestMutation = useRejectSpecialRequest();
  const deliverSpecialRequestMutation = useDeliverSpecialRequest();

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
    <div className="page-frame pb-6">
      <SEO 
        title="Meal Management" 
        description="View daily hostel menus, submit meal feedback, and manage kitchen forecasts. Coordinate dining services for the SMG community."
      />
      <div className="flex flex-col gap-2">
          <h1 className="page-title flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-sm text-primary">
                <Utensils className="h-6 w-6" />
            </div>
            Dining & Nutrition
          </h1>
          <p className="page-lead pl-1">Daily menus, special requests, and nutritional tracking</p>
      </div>

      {/* Premium Hero Section: Unified Next Meal & Status */}
      {meals && meals.length > 0 && (
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg mb-8">
           <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <Utensils className="h-48 w-48" />
           </div>
           
           <div className="p-6 sm:p-10 relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
                 {/* Left: Visual & Status */}
                 <div className="flex items-center gap-6 shrink-0">
                    <div className="relative">
                       <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                          <Utensils className="h-10 w-10 sm:h-12" />
                       </div>
                       <div className="absolute -bottom-2 -right-2 bg-success text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg border-2 border-white ring-2 ring-success/20">
                          LIVE
                       </div>
                    </div>
                    
                    <div className="space-y-1">
                       <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold uppercase tracking-wider text-[10px] px-2">
                             Current Service
                          </Badge>
                       </div>
                       <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                          {getNextMeal(meals)?.meal_type?.toUpperCase() || 'Meals'}
                       </h2>
                       <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100 text-sm font-bold">
                             <CountdownTimer targetHour={getNextMeal(meals)?.start_time ? parseInt(getNextMeal(meals)?.start_time?.split(':')[0] || '12') : 12} />
                          </div>
                          <span className="text-muted-foreground text-xs font-medium">until next transition</span>
                       </div>
                    </div>
                 </div>

                 {/* Middle: Menu Details */}
                 <div className="flex-1 space-y-3 pb-6 lg:pb-0 lg:border-l lg:pl-12 border-border/50">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1 opacity-60">Chef's Today Selection</p>
                    <h3 className="text-xl sm:text-2xl font-bold leading-tight text-foreground/90 transition-all hover:text-primary cursor-default">
                       {getNextMeal(meals)?.menu || 'Our team is preparing your menu...'}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                       {getNextMeal(meals)?.available ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 px-3 py-1 font-bold text-[10px]">
                             • OPEN FOR DINING
                          </Badge>
                       ) : (
                          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20 px-3 py-1 font-bold text-[10px]">
                             • SERVICE CLOSED
                          </Badge>
                       )}
                       {getNextMeal(meals)?.meal_type === 'special' && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 px-3 py-1 font-bold text-[10px]">
                             PREMIUM SELECTION ⭐
                          </Badge>
                       )}
                    </div>
                 </div>

                 {/* Right: Actions */}
                 <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-3">
                    <Button 
                       disabled={!getNextMeal(meals)?.available || markMealMutation.isPending}
                       className="h-14 px-10 rounded-xl primary-gradient text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-primary/20 hover:translate-y-[-2px] hover:shadow-2xl transition-all active:translate-y-[1px]"
                       onClick={() => {
                          const nextMeal = getNextMeal(meals);
                          if (nextMeal && user?.role === 'student') {
                             markMealMutation.mutate({ meal_id: nextMeal.id!, status: 'taken' }, {
                               onSuccess: () => toast.success('Meal attendance marked successfully'),
                               onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to mark meal attendance')),
                             });
                          }
                       }}
                    >
                       {user?.role === 'student' ? 'Confirm Dining' : 'Check Service'}
                    </Button>
                    {getNextMeal(meals) && <FeedbackDialog meal={getNextMeal(meals) as Meal} />}
                 </div>
              </div>
           </div>
           
           <div className="h-2 w-full bg-muted/20">
              <div 
                 className="h-full bg-primary/40 animate-pulse transition-all duration-1000" 
                 style={{ width: getNextMeal(meals)?.available ? '100%' : '30%' }}
              />
           </div>
        </section>
      )}

      {/* Real-time Service Progress: Visible to All Roles */}
      <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden mb-8">
        <CardHeader className="bg-muted/10 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-border/50 text-foreground">
                <Utensils className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xs font-black uppercase tracking-widest">Active Service Timeline</CardTitle>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Live tracking of institutional dining windows</p>
              </div>
            </div>
            {(user?.role === 'chef' || user?.role === 'head_chef') && (
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-black uppercase">Service Management Mode</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-4 relative px-4 pt-12">
            <div className="absolute top-1/2 left-4 right-4 h-1 bg-muted/30 -translate-y-1/2 z-0 rounded-full" />
            <div className="relative z-10 flex justify-between items-center">
              {['breakfast', 'lunch', 'dinner'].map((type) => {
                const meal = getMealWithFallback(type);
                const currentHour = new Date().getHours();
                
                const startHour = meal?.start_time ? parseInt(meal.start_time.split(':')[0]) : (type === 'breakfast' ? 7 : type === 'lunch' ? 12 : 19);
                const endHour = meal?.end_time ? parseInt(meal.end_time.split(':')[0]) : (startHour + 2);
                const isActive = currentHour >= startHour && currentHour < endHour;
                
                return (
                  <div key={type} className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className={cn(
                        "w-6 h-6 rounded-full border-4 shadow-md transition-all duration-700 flex items-center justify-center",
                        isActive ? "bg-primary border-white ring-8 ring-primary/10 scale-110" : "bg-white border-muted"
                      )}>
                         {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                      </div>
                      
                      {/* Chef Context Menu for Timeline Nodes */}
                      {(user?.role === 'chef' || user?.role === 'head_chef') && (
                         <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                            <MealTimingDialog meal={meal as Meal} />
                         </div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className={cn("text-[10px] font-black uppercase tracking-widest", isActive ? "text-primary" : "text-muted-foreground/60")}>
                         {type}
                      </p>
                      <p className="text-[9px] font-black text-muted-foreground/80 mt-0.5 tabular-nums">
                         {meal?.start_time?.substring(0, 5) || (type === 'breakfast' ? '07:00' : type === 'lunch' ? '12:20' : '19:30')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authority-only Forecast Dashboard: Streamlined Metrics */}
      {isAuthority && (
        <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden mb-8">
          <CardHeader className="bg-muted/30 pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 font-black uppercase tracking-wider text-muted-foreground">
                <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                  <Users className="h-4 w-4" />
                </div>
                Logistics & Operations Dashboard
              </CardTitle>
              <Badge variant="secondary" className="font-bold text-[9px] px-2 py-0">REAL-TIME DATA</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {forecastLoading ? (
              <CardGridSkeleton cols={5} rows={1} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-border/60 hover:border-primary/30 transition-colors group">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-2 mb-2 group-hover:text-primary transition-colors">
                    <Users className="h-3 w-3" /> Resident Population
                  </p>
                  <p className="text-3xl font-black text-foreground">{forecast?.total_students || 0}</p>
                  <div className="h-1 w-8 bg-primary/10 rounded-full mt-3" />
                </div>
                
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-border/60 hover:border-orange-200 transition-colors">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-2 mb-2">
                    <CalendarIcon className="h-3 w-3" /> Off-Campus
                  </p>
                  <p className="text-3xl font-black text-orange-600">{forecast?.excluded_leave || 0}</p>
                  <div className="h-1 w-8 bg-orange-100 rounded-full mt-3" />
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-xl border border-border/60 hover:border-blue-200 transition-colors">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-2 mb-2">
                    <Utensils className="h-3 w-3" /> Voluntary Skip
                  </p>
                  <p className="text-3xl font-black text-blue-600">{forecast?.excluded_skipped_meal || 0}</p>
                  <div className="h-1 w-8 bg-blue-100 rounded-full mt-3" />
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-xl border border-border/60 hover:border-red-200 transition-colors">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-2 mb-2">
                    <UserMinus className="h-3 w-3" /> Absent Record
                  </p>
                  <p className="text-3xl font-black text-red-600">{forecast?.excluded_absent || forecast?.students_marked_absent || 0}</p>
                  <div className="h-1 w-8 bg-red-100 rounded-full mt-3" />
                </div>

                <div className="bg-primary/5 p-4 sm:p-5 rounded-xl border border-primary/20 shadow-inner col-span-2 sm:col-span-1">
                  <p className="text-[10px] text-primary font-black uppercase tracking-widest flex items-center gap-2 mb-2">
                    <Check className="h-3 w-3" /> Net Production
                  </p>
                  <p className="text-4xl font-black text-primary">{forecast?.expected_diners || 0}</p>
                  <p className="text-[9px] font-bold text-primary/60 mt-1 uppercase">Plates to Prepare</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
       {/* ── MOBILE STUDENT REDESIGNED VIEW ── */}
      {user?.role === 'student' && !isAuthority && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Preferences Dashboard */}
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex-1">
              <CardHeader className="bg-muted/20 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white rounded-lg shadow-sm border border-border/50 text-foreground">
                    <Star className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-black uppercase tracking-widest">Dining Profile</CardTitle>
                    <p className="text-[10px] text-muted-foreground font-medium">Configure your nutritional preferences for automated kitchen sync</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {['breakfast', 'lunch', 'dinner'].map((type) => {
                    const currentPref = preferences?.find((p) => p.meal_type === type)?.preference || 'regular';
                    return (
                      <div key={type} className="bg-muted/30 p-4 rounded-xl border border-transparent hover:border-primary/20 transition-all space-y-3">
                         <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">{type}</p>
                         <Select defaultValue={currentPref} onValueChange={(val) => updatePreferenceMutation.mutate({ meal_type: type, preference: val }, {
                            onSuccess: () => toast.success('Meal preference updated'),
                            onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to update preference')),
                          })}>
                          <SelectTrigger className="h-12 rounded-xl text-xs font-bold capitalize bg-white shadow-sm border-border/60">
                            <SelectValue placeholder={type} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/60 shadow-xl">
                            <SelectItem value="regular">Regular Menu</SelectItem>
                            <SelectItem value="veg">Vegetarian</SelectItem>
                            <SelectItem value="non_veg">Non-Veg</SelectItem>
                            <SelectItem value="special">Chef Special</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-border/40">
                  {/* Next 24 Hours Mini-Schedule */}
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Coming Up Next</h4>
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-bold">NEXT 24 HOURS</Badge>
                     </div>
                     <div className="space-y-3">
                        {['breakfast', 'lunch', 'dinner'].map((type) => {
                           const meal = getMealWithFallback(type);
                           const currentHour = new Date().getHours();
                           
                           const startHour = meal?.start_time ? parseInt(meal.start_time?.split(':')[0] || '0') : (type === 'breakfast' ? 7 : type === 'lunch' ? 12 : 19);
                           const isNext = currentHour >= startHour && currentHour < (startHour + 2);

                           return (
                              <div key={type} className={cn(
                                 "flex items-center justify-between p-3 rounded-xl border transition-all",
                                 isNext ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-muted/20 border-transparent opacity-60"
                              )}>
                                 <div className="flex items-center gap-3">
                                    <div className={cn(
                                       "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black",
                                       isNext ? "bg-primary text-white" : "bg-white text-muted-foreground shadow-sm"
                                    )}>
                                       {type[0].toUpperCase()}
                                    </div>
                                    <div className="flex items-center gap-2">
                                       <div>
                                          <p className="text-xs font-bold capitalize">{type}</p>
                                          <p className="text-[10px] text-muted-foreground font-medium">Standard Service</p>
                                       </div>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-[10px] font-bold text-foreground">
                                       {meal?.start_time?.substring(0, 5) || (type === 'breakfast' ? '07:00' : type === 'lunch' ? '12:20' : '19:30')} 
                                       - {meal?.end_time?.substring(0, 5) || (type === 'breakfast' ? '09:00' : type === 'lunch' ? '14:20' : '21:30')}
                                    </p>
                                    {isNext && (
                                       <div className="flex items-center gap-1.5 text-primary text-[9px] font-black mt-0.5">
                                          <div className="w-1 h-1 bg-primary rounded-full animate-ping" />
                                          <CountdownTimer targetHour={startHour} />
                                       </div>
                                    )}
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  </div>

                  {/* Chef's Notice Board & Community Feedback */}
                  <div className="space-y-6">
                     <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 flex gap-4 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                           <MessageSquare className="h-12 w-12 text-amber-900" />
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-amber-200/50 flex items-center justify-center shrink-0">
                           <Megaphone className="h-5 w-5 text-amber-700" />
                        </div>
                        <div className="space-y-1">
                           <p className="text-[10px] font-black uppercase tracking-widest text-amber-700/70">Chef's Note</p>
                           <p className="text-xs font-bold text-amber-900 leading-relaxed">
                              "Don't miss today's lunch—the chicken is marinated with herbs from our own hostel garden!" 🌿
                           </p>
                        </div>
                     </div>

                     <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100 flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-200/50 flex items-center justify-center shrink-0">
                           <Star className="h-5 w-5 text-indigo-700" />
                        </div>
                        <div className="space-y-3 flex-1">
                           <div className="space-y-0.5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700/70">Community Poll</p>
                              <p className="text-xs font-bold text-indigo-900">Which dessert would you like for Sunday's Grand Feast?</p>
                           </div>
                           <div className="grid grid-cols-2 gap-2">
                              <Button variant="outline" className="h-8 text-[10px] font-bold bg-white border-indigo-200 hover:bg-indigo-100/50 rounded-lg">Gulab Jamun</Button>
                              <Button variant="outline" className="h-8 text-[10px] font-bold bg-white border-indigo-200 hover:bg-indigo-100/50 rounded-lg">Fruit Custard</Button>
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Special Request Quick Access */}
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex-1 flex flex-col">
               <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <div className="p-1.5 bg-white rounded-lg shadow-sm text-primary">
                      <Plus className="h-4 w-4" />
                    </div>
                    Express Request
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6 space-y-6 flex-1">
                  <SpecialRequestForm />
                  
                  {specialRequests && specialRequests.length > 0 && (
                    <div className="space-y-3 pt-6 border-t border-dashed border-border/60 mt-auto">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Recent Activity</p>
                      {specialRequests.slice(0, 2).map((req) => (
                        <div key={req.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-transparent hover:border-border/50 transition-all">
                          <div className="flex items-center gap-3 min-w-0">
                             <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">
                                <Utensils className="h-3.5 w-3.5 text-primary" />
                             </div>
                             <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{req.item_name}</p>
                                <p className="text-[9px] text-muted-foreground font-medium">{req.requested_for_date}</p>
                             </div>
                          </div>
                          <Badge variant="outline" className={cn(
                             "text-[9px] font-black border-0 px-2 py-0.5 rounded-full shrink-0 shadow-sm",
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
        </div>
      )}

      <Tabs defaultValue="schedule" className={cn("space-y-6", user?.role === 'student' && !isAuthority && "hidden")}>
        <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <TabsList className="inline-flex h-12 items-center justify-center rounded-2xl bg-muted/50 p-1 text-muted-foreground w-full sm:w-auto">
            <TabsTrigger value="schedule" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-6 py-2 text-xs font-black ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Meal Schedule</TabsTrigger>
            {isAuthority && <TabsTrigger value="attendance" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-6 py-2 text-xs font-black ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Attendance</TabsTrigger>}
            <TabsTrigger value="preferences" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-6 py-2 text-xs font-black ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Preferences</TabsTrigger>
            <TabsTrigger value="special" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-6 py-2 text-xs font-black ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Special Requests</TabsTrigger>
            {isAuthority && isHR && <TabsTrigger value="feedback" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-6 py-2 text-xs font-black ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Feedback</TabsTrigger>}
          </TabsList>
        </div>

        {/* Meal Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-base font-black uppercase tracking-wider text-foreground">
                    Menu Explorer
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Filter specific dates and services</p>
                </div>
                {user && (['chef', 'head_chef', 'admin', 'super_admin'].includes(user.role)) && (
                  <MenuUploadDialog date={selectedDate} />
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                    <CalendarIcon className="h-3 w-3" /> Select Day
                  </Label>
                  <DatePicker
                    date={selectedDate ? new Date(selectedDate) : undefined}
                    onSelect={(date) => setSelectedDate(date ? format(date, 'yyyy-MM-dd') : '')}
                    className="w-full h-12 rounded-xl border-border/60 bg-white shadow-sm hover:border-primary/40 transition-colors"
                    placeholder="Pick a date"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                    <Filter className="h-3 w-3" /> Service Category
                  </Label>
                  <Select value={selectedMealType} onValueChange={setSelectedMealType}>
                    <SelectTrigger className="h-12 rounded-xl border-border/60 bg-white shadow-sm hover:border-primary/40 transition-colors">
                      <SelectValue placeholder="Select meal type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/60 shadow-xl">
                      <SelectItem value="all">Full Daily Menu</SelectItem>
                      <SelectItem value="breakfast">Breakfast Service</SelectItem>
                      <SelectItem value="lunch">Lunch Service</SelectItem>
                      <SelectItem value="dinner">Dinner Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="w-1 h-6 bg-primary rounded-full" />
              <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Active Menu Listing</h2>
            </div>
            
            {mealsLoading ? (
               <CardGridSkeleton cols={3} rows={1} />
            ) : filteredMeals && filteredMeals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMeals.map((meal: Meal) => (
                  <Card key={meal.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 group">
                    <div className={cn(
                      "h-2.5 w-full",
                      meal.meal_type === 'breakfast' ? "primary-gradient" :
                      meal.meal_type === 'lunch' ? "bg-emerald-400" : "bg-blue-400"
                    )} />
                    <CardHeader className="pb-3 px-6 pt-6">
                      <div className="flex items-center justify-between">
                        {getMealTypeBadge(meal.meal_type)}
                        {meal.available ? (
                          <Badge className="bg-success/10 text-success border-success/20 px-3 py-1 font-black text-[9px] rounded-full uppercase">LIVE NOW</Badge>
                        ) : (
                          <Badge variant="secondary" className="px-3 py-1 font-black text-[9px] rounded-full opacity-60 uppercase bg-muted">CONCLUDED</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[11px] font-black text-primary/70 uppercase tracking-widest bg-primary/5 w-max px-3 py-1 rounded-lg">
                           <CalendarIcon className="h-3 w-3" />
                           {new Date(meal.meal_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                        
                        <h4 className="text-lg font-bold leading-tight group-hover:text-primary transition-colors min-h-[3rem]">
                           {meal.menu}
                        </h4>
                      </div>

                      <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-xl border border-border/40">
                         <div className="flex items-center gap-2">
                           <Utensils className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
                           <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                             {meal.start_time?.substring(0, 5) || '00:00'} - {meal.end_time?.substring(0, 5) || '00:00'}
                           </span>
                         </div>
                         <div className="text-[9px] font-black text-black/40 uppercase">Dining Window</div>
                      </div>

                      {meal.available && (
                        <div className="flex flex-col gap-3 pt-2">
                           {user?.role === 'student' && (
                             <Button
                                className="w-full rounded-xl h-12 font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95"
                                onClick={() =>
                                  markMealMutation.mutate({ meal_id: meal.id, status: 'taken' }, {
                                    onSuccess: () => toast.success('Meal attendance marked successfully'),
                                    onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to mark meal attendance')),
                                  })
                                }
                                disabled={markMealMutation.isPending}
                              >
                                <Check className="h-4 w-4 mr-2 stroke-[3px]" />
                                Mark Consumed
                              </Button>
                           )}
                            
                            <div className="grid grid-cols-2 gap-3">
                              {(['chef', 'head_chef', 'warden', 'head_warden'].includes(user?.role || '')) && (
                                 <RequestFeedbackDialog meal={meal} />
                              )}
                              <FeedbackDialog meal={meal} />
                            </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Utensils}
                title="Table Empty"
                description="No menu has been curated for the selected period"
                variant="default"
              />
            )}
          </div>
        </TabsContent>

        {/* Meal Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <Card className="rounded-lg border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Meal Attendance Records</CardTitle>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                <ListSkeleton rows={6} />
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
                              {new Date(record.meal.meal_date).toLocaleDateString()}
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
                     {mealAttendance.map((record: MealAttendance) => (
                       <div key={record.id} className="flex items-center justify-between p-4 rounded-sm bg-card border shadow-sm">
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
        <TabsContent value="preferences" className="space-y-3 sm:space-y-4">
          <Card className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-gray-100 bg-gray-50/20">
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <div className="p-1.5 bg-black/5 rounded-sm text-black">
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
                    const pref = preferences?.find((p: MealPreference) => p.meal_type === mealType);
                    return (
                      <div key={mealType} className="p-5 rounded-sm bg-gray-50/50 border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-black uppercase tracking-normal text-muted-foreground">{mealType}</Label>
                          {getMealTypeBadge(mealType)}
                        </div>
                        <div className="space-y-2">
                          <Select
                            defaultValue={pref?.preference || 'regular'}
                            onValueChange={(value) =>
                              updatePreferenceMutation.mutate({
                                meal_type: mealType,
                                preference: value,
                              }, {
                                onSuccess: () => toast.success('Meal preference updated'),
                                onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to update preference')),
                              })
                            }
                          >
                            <SelectTrigger id={`pref-${mealType}`} className="h-11 rounded-sm border-0 bg-white shadow-sm ring-1 ring-gray-100 focus:ring-primary">
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
                  <div className="bg-red-50/30 p-6 rounded-sm border border-red-100/50 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 bg-red-400 rounded-sm" />
                      <Label htmlFor="dietary-restrictions" className="text-sm font-black uppercase tracking-normal text-red-900/70">
                        Restrictions & Allergies
                      </Label>
                    </div>
                    <Textarea
                      id="dietary-restrictions"
                      placeholder="e.g. No Peanuts, Gluten-free, Jain food only..."
                      defaultValue={preferences?.[0]?.dietary_restrictions || ''}
                      className="rounded-sm border-0 bg-white/80 focus-visible:ring-red-400 p-4 min-h-[120px] font-medium shadow-inner"
                      onBlur={(e) => updateDietaryMutation.mutate({ dietary_restrictions: e.target.value }, {
                        onSuccess: () => toast.success('Dietary restrictions updated'),
                        onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Failed to update restrictions')),
                      })}
                    />
                    <div className="flex items-center gap-2 text-[10px] text-red-600/60 font-bold uppercase tracking-normaler pl-1">
                      <div className="w-1 h-1 bg-red-400 rounded-sm" />
                      Changes are saved automatically when you click away.
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Special Requests Tab */}
        <TabsContent value="special" className="space-y-3 sm:space-y-4">
          {/* Special Requests Card */}
          <Card className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-gray-100 bg-gray-50/20">
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <div className="p-1.5 bg-primary/10 rounded-sm text-primary">
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
              <div className="bg-primary/5 p-6 rounded-sm border border-gray-100 space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 bg-primary rounded-sm" />
                  <h3 className="font-black text-lg tracking-normal uppercase">New Request</h3>
                </div>
                <SpecialRequestForm />
              </div>

              {/* Submitted Requests List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-lg tracking-normal uppercase flex items-center gap-2">
                    <div className="w-1 h-6 bg-black rounded-sm" />
                    {isAuthority ? 'Global Request Feed' : 'Your Application History'}
                  </h3>
                </div>
                {requestsLoading ? (
                   <ListSkeleton rows={4} />
                ) : specialRequests && specialRequests.length > 0 ? (
                  <div className="space-y-3">
                    {specialRequests.map((request: MealSpecialRequest) => (
                      <div
                        key={request.id}
                        className="p-5 rounded-sm bg-gray-50/50 hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100 flex items-center justify-between gap-4 group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-lg text-foreground truncate">
                              {request.quantity}x {request.item_name}
                            </h4>
                            {isAuthority && (
                                <Badge variant="secondary" className="text-[10px] h-5 rounded-sm font-mono uppercase bg-black text-white px-2">
                                  {request.student_name || 'STUDENT'}
                                </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground/60 uppercase tracking-normaler">
                            <span className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" /> Scheduled: {new Date(request.requested_for_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          {request.notes && (
                            <p className="text-xs text-muted-foreground italic bg-slate-100 p-2 rounded-sm mt-2">
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
                                    className="h-9 px-3 rounded-sm border-success/30 text-success hover:bg-success/10 font-bold"
                                    onClick={() => approveSpecialRequestMutation.mutate(request.id, {
                                      onSuccess: () => toast.success('Request approved'),
                                      onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to approve request')),
                                    })}
                                    disabled={approveSpecialRequestMutation.isPending}
                                 >
                                    Approve
                                 </Button>
                                 <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="h-9 px-3 rounded-sm border-red-200 text-red-600 hover:bg-red-50 font-bold"
                                    onClick={() => rejectSpecialRequestMutation.mutate(request.id, {
                                      onSuccess: () => toast.success('Request rejected'),
                                      onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to reject request')),
                                    })}
                                    disabled={rejectSpecialRequestMutation.isPending}
                                 >
                                    Reject
                                 </Button>
                              </div>
                          )}

                          {user && (['chef', 'head_chef'].includes(user.role)) && request.status === 'approved' && (
                              <Button 
                                size="sm" 
                                className="h-9 px-4 rounded-sm primary-gradient text-white font-bold shadow-lg shadow-primary/20"
                                onClick={() => deliverSpecialRequestMutation.mutate(request.id, {
                                  onSuccess: () => toast.success('Marked as delivered'),
                                  onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to deliver request')),
                                })}
                                disabled={deliverSpecialRequestMutation.isPending}
                              >
                                Mark Delivered
                              </Button>
                          )}

                          <Badge
                              variant="outline"
                              className={cn(
                              'capitalize h-9 px-4 rounded-sm font-black text-[10px] tracking-normal',
                              request.status === 'approved' && 'bg-success/5 text-success border-success/20',
                              request.status === 'delivered' && 'bg-orange-50 text-blue-700 border-orange-200',
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
                              className="h-9 w-9 p-0 hover:bg-red-50 hover:text-red-500 rounded-sm"
                              onClick={() => deleteSpecialRequestMutation.mutate(request.id, {
                                onSuccess: () => toast.success('Request cancelled'),
                                onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to cancel request')),
                              })}
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
                  <div className="p-12 text-center text-muted-foreground bg-slate-50 rounded-sm border border-dashed">
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
                <Card className="rounded-xl bg-card border border-border shadow-sm">
                  <CardContent className="pt-6">
                    <div className="space-y-1">
                      <p className="text-xs text-orange-600 font-semibold uppercase tracking-normal">Total Feedback</p>
                      <p className="text-3xl font-bold text-blue-900">{feedbackStats.total_feedback || 0}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl bg-card border border-border shadow-sm">
                  <CardContent className="pt-6">
                    <div className="space-y-1">
                      <p className="text-xs text-yellow-600 font-semibold uppercase tracking-normal">Avg Rating</p>
                      <p className="text-3xl font-bold text-yellow-900">{feedbackStats.average_rating?.toFixed(1) || 'N/A'}/5</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl bg-card border border-border shadow-sm">
                  <CardContent className="pt-6">
                    <div className="space-y-1">
                      <p className="text-xs text-success font-semibold uppercase tracking-normal">Positive</p>
                      <p className="text-3xl font-bold text-success">{feedbackStats.positive_count || 0}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl bg-card border border-border shadow-sm">
                  <CardContent className="pt-6">
                    <div className="space-y-1">
                      <p className="text-xs text-red-600 font-semibold uppercase tracking-normal">Negative</p>
                      <p className="text-3xl font-bold text-red-900">{feedbackStats.negative_count || 0}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Feedback List */}
            <Card className="rounded-lg border border-border bg-card shadow-sm">
              <CardHeader>
                <CardTitle>Student Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                {feedbackLoading ? (
                   <ListSkeleton rows={4} />
                ) : mealFeedback && mealFeedback.length > 0 ? (
                  <div className="space-y-3">
                    {mealFeedback.map((feedback: MealFeedback) => (
                      <div
                        key={feedback.id}
                        className="p-4 border rounded-sm bg-white hover:bg-slate-50 transition-colors space-y-2"
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
                          <p className="text-sm text-foreground bg-slate-50 p-3 rounded-sm italic">
                            "{feedback.comment}"
                          </p>
                        )}

                        {!feedback.resolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markFeedbackAsResolvedMutation.mutate(feedback.id, {
                              onSuccess: () => toast.success('Feedback marked as resolved'),
                              onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to update feedback')),
                            })}
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
