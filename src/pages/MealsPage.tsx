import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Utensils, Calendar as CalendarIcon, Check, Users, UserMinus, Star, Plus, Trash2, MessageSquare, Filter } from 'lucide-react';
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
} from '@/hooks/features/useMeals';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';
import { useRealtimeQuery, useWebSocketEvent } from '@/hooks/useWebSocket';
import { isWarden, isTopLevelManagement } from '@/lib/rbac';
import type { Meal, MealFeedback, MealSpecialRequest, MealAttendance } from '@/types';
import { SEO } from '@/components/common/SEO';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';

// Extracted Components
import { FeedbackDialog } from '@/components/meals/FeedbackDialog';
import { RequestFeedbackDialog } from '@/components/meals/RequestFeedbackDialog';
import { MenuUploadDialog } from '@/components/meals/MenuUploadDialog';
import { SpecialRequestForm } from '@/components/meals/SpecialRequestForm';

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

      {/* Next Meal Premium Showcase */}
      {meals && meals.length > 0 && (
        <Card className="rounded-lg border border-border bg-card shadow-sm overflow-hidden relative group">
           <CardContent className="p-8 relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="relative">
                 <div className="w-24 h-24 rounded-sm bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <Utensils className="h-10 w-10" />
                 </div>
                 <Badge className="absolute -bottom-2 -right-2 bg-success text-white border-0 font-black tracking-widest px-3 py-1 scale-110 shadow-lg">NEXT</Badge>
              </div>

              <div className="flex-1 text-center md:text-left space-y-2">
                 <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/80">Upcoming Service</span>
                    {getNextMeal(meals) && getMealTypeBadge(getNextMeal(meals)!.meal_type)}
                 </div>
                 <h2 className="text-3xl font-black tracking-tight leading-tight text-foreground">
                    {getNextMeal(meals)?.menu || 'Updating Menu Data...'}
                 </h2>
                 <p className="text-muted-foreground font-medium text-sm">
                    {getNextMeal(meals)?.available ? 'Service is currently open' : 'Service starting soon'}
                 </p>
              </div>

              <div className="flex flex-col gap-3 shrink-0">
                 <Button 
                    className="h-14 px-8 rounded-sm primary-gradient text-white font-black text-sm uppercase tracking-widest shadow-sm hover:scale-105 active:scale-95 transition-all"
                    onClick={() => {
                       const nextMeal = getNextMeal(meals);
                       if (nextMeal && user?.role === 'student') {
                          markMealMutation.mutate({ meal_id: nextMeal.id, status: 'taken' }, {
                            onSuccess: () => toast.success('Meal attendance marked successfully'),
                            onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to mark meal attendance')),
                          });
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
        <Card className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 font-black">
              <div className="p-1.5 bg-primary/10 rounded-sm text-primary">
                <Users className="h-4 w-4" />
              </div>
              Dining Forecast <span className="text-sm font-bold text-muted-foreground/60 ml-2">(Based on Gate Passes)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {forecastLoading ? (
              <CardGridSkeleton cols={3} rows={2} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="bg-card p-5 rounded-lg border border-border shadow-sm flex flex-col justify-center gap-1">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-2">
                    <Users className="h-3 w-3" /> Total Students
                  </p>
                  <p className="text-3xl font-black text-foreground">{forecast?.total_students || 0}</p>
                </div>
                
                <div className="bg-card p-5 rounded-lg border border-border shadow-sm flex flex-col justify-center gap-1 border-l-4 border-l-blue-400">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-2">
                    <CalendarIcon className="h-3 w-3" /> On Leave
                  </p>
                  <p className="text-3xl font-black text-blue-500">{forecast?.excluded_leave || 0}</p>
                </div>

                <div className="bg-card p-5 rounded-lg border border-border shadow-sm flex flex-col justify-center gap-1 border-l-4 border-l-orange-400">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-2">
                    <Utensils className="h-3 w-3" /> Skipped Meal
                  </p>
                  <p className="text-3xl font-black text-orange-500">{forecast?.excluded_skipped_meal || 0}</p>
                </div>

                <div className="bg-card p-5 rounded-lg border border-border shadow-sm flex flex-col justify-center gap-1 border-l-4 border-l-red-400">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-2">
                    <UserMinus className="h-3 w-3" /> Absent
                  </p>
                  <p className="text-3xl font-black text-red-500">{forecast?.excluded_absent || forecast?.students_marked_absent || 0}</p>
                </div>

                <div className="bg-card p-5 rounded-lg border border-border shadow-sm flex flex-col justify-center gap-1 relative overflow-hidden lg:col-span-1 sm:col-span-2">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Utensils className="h-12 w-12 text-foreground" />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider flex items-center gap-2 relative z-10">
                    <Utensils className="h-3 w-3" /> Expected Diners
                  </p>
                  <p className="text-4xl font-black text-foreground relative z-10">{forecast?.expected_diners || 0}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* ── MOBILE STUDENT SIMPLIFIED VIEW ── */}
      {user?.role === 'student' && !isAuthority && (
        <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-500">
          {/* Next Meal & Countdown */}
          {(() => {
            const nextMeal = getNextMeal(meals);
            const mealTime = nextMeal?.start_time 
              ? parseInt(nextMeal.start_time.split(':')[0], 10) 
              : nextMeal?.meal_type === 'breakfast' ? 7 : nextMeal?.meal_type === 'lunch' ? 12 : 19;
            
            return (
              <Card className="rounded-xl border border-border bg-card shadow-sm overflow-hidden relative group">
                <div className="absolute inset-0 opacity-40 pointer-events-none" 
                     style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--primary) / 0.22) 1px, transparent 0)', backgroundSize: '24px 24px' }}>
                </div>
                <CardContent className="p-6 relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/20 rounded-sm text-primary">
                          <Utensils className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">Coming Up Next</p>
                          <p className="text-lg font-black tracking-tight">{nextMeal?.meal_type?.toUpperCase() || 'UPDATING...'}</p>
                        </div>
                     </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80 mb-1">Starts In</p>
                        <div className="text-lg font-black font-mono text-primary bg-primary/10 px-3 py-1 rounded-sm">
                           <CountdownTimer targetHour={mealTime} />
                        </div>
                     </div>
                  </div>

                  <div className="bg-muted/30 backdrop-blur-md rounded-sm p-5 border border-border/60 space-y-3">
                     <h2 className="text-xl font-bold leading-tight line-clamp-2">
                        {nextMeal?.menu || 'Fetching today\'s menu...'}
                     </h2>
                     <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                          "px-2 py-0.5 rounded-sm text-[10px] font-black border-0",
                          nextMeal?.available ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                        )}>
                          {nextMeal?.available ? '• OPEN NOW' : '• STARTING SOON'}
                        </Badge>
                        <Badge variant="outline" className="bg-secondary/50 text-secondary-foreground/80 border-0 px-2 text-[10px]">
                          {nextMeal?.meal_type === 'special' ? 'Chef Special ⭐' : 'Regular Service'}
                        </Badge>
                     </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <Button 
                      className="flex-1 w-full sm:w-auto h-12 primary-gradient font-black rounded-sm shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center"
                      disabled={!nextMeal?.available || markMealMutation.isPending}
                      onClick={() => nextMeal && markMealMutation.mutate({ meal_id: nextMeal.id, status: 'taken' }, {
                        onSuccess: () => toast.success('Meal attendance marked successfully'),
                        onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to mark meal attendance')),
                      })}
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
          <Card className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-secondary/20 rounded-sm text-foreground">
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
                       <Select defaultValue={currentPref} onValueChange={(val) => updatePreferenceMutation.mutate({ meal_type: type, preference: val }, {
                          onSuccess: () => toast.success('Meal preference updated'),
                          onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to update preference')),
                        })}>
                        <SelectTrigger className="h-10 rounded-sm text-xs capitalize border-muted bg-muted/30">
                          <SelectValue placeholder={type} />
                        </SelectTrigger>
                        <SelectContent className="rounded-sm border-0 shadow-sm">
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
          <Card className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
             <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-sm text-primary">
                    <Plus className="h-4 w-4" />
                  </div>
                  Special Meal Request
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                <SpecialRequestForm />
                
                {specialRequests && specialRequests.length > 0 && (
                  <div className="space-y-2 mt-4 pt-4 border-t border-dashed">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Recent Requests</p>
                    {specialRequests.slice(0, 3).map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-sm">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-white rounded-sm shadow-sm border border-border/10">
                              <Utensils className="h-3 w-3 text-primary" />
                           </div>
                           <div>
                              <p className="text-xs font-bold">{req.item_name}</p>
                              <p className="text-[9px] text-muted-foreground">{req.status.toUpperCase()} · {req.requested_for_date}</p>
                           </div>
                        </div>
                        <Badge variant="outline" className={cn(
                           "text-[8px] font-black border-0 px-2 py-0.5 rounded-sm",
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

      <Tabs defaultValue="schedule" className={cn("space-y-3 sm:space-y-4", user?.role === 'student' && !isAuthority && "hidden")}>
        <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <TabsList className="flex w-max sm:w-full">
            <TabsTrigger value="schedule" className="rounded-sm px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Meal Schedule</TabsTrigger>
            {isAuthority && <TabsTrigger value="attendance" className="rounded-sm px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Meal Attendance</TabsTrigger>}
            <TabsTrigger value="preferences" className="rounded-sm px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Preferences</TabsTrigger>
            <TabsTrigger value="special" className="rounded-sm px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Special Requests</TabsTrigger>
            {isAuthority && isHR && <TabsTrigger value="feedback" className="rounded-sm px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Meal Feedback</TabsTrigger>}
          </TabsList>
        </div>

        {/* Meal Schedule Tab */}
        <TabsContent value="schedule" className="space-y-3 sm:space-y-4">
          <Card className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
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
                    className="w-full h-11 rounded-sm border-gray-200 bg-white shadow-sm"
                    placeholder="Pick a date"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Meal Type</Label>
                  <Select value={selectedMealType} onValueChange={setSelectedMealType}>
                    <SelectTrigger className="h-11 rounded-sm border-gray-200 bg-white shadow-sm">
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
                 <CardGridSkeleton cols={3} rows={1} />
              ) : filteredMeals && filteredMeals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {filteredMeals.map((meal) => (
                    <Card key={meal.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow">
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
                             <div className="p-2 bg-muted rounded-sm">
                               <CalendarIcon className="h-4 w-4 text-primary" />
                             </div>
                             {new Date(meal.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                          </div>
                          
                          <div className="flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-sm border border-primary/10">
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
                          <div className="flex flex-col sm:flex-row w-full gap-3 mt-4">
                             {user?.role === 'student' && (
                               <Button
                                  className="flex-1 w-full sm:w-auto rounded-sm h-12 font-bold shadow-lg shadow-primary/10 transition-transform active:scale-95 flex items-center justify-center"
                                  onClick={() =>
                                    markMealMutation.mutate({ meal_id: meal.id, status: 'taken' }, {
                                      onSuccess: () => toast.success('Meal attendance marked successfully'),
                                      onError: (e: unknown) => toast.error(getApiErrorMessage(e, 'Failed to mark meal attendance')),
                                    })
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
                    const pref = preferences?.find((p) => p.meal_type === mealType);
                    return (
                      <div key={mealType} className="p-5 rounded-sm bg-gray-50/50 border border-gray-100 space-y-4">
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
                      <Label htmlFor="dietary-restrictions" className="text-sm font-black uppercase tracking-widest text-red-900/70">
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
                    <div className="flex items-center gap-2 text-[10px] text-red-600/60 font-bold uppercase tracking-tighter pl-1">
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
                  <h3 className="font-black text-lg tracking-tight uppercase">New Request</h3>
                </div>
                <SpecialRequestForm />
              </div>

              {/* Submitted Requests List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-lg tracking-tight uppercase flex items-center gap-2">
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
                          <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground/60 uppercase tracking-tighter">
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
                              'capitalize h-9 px-4 rounded-sm font-black text-[10px] tracking-widest',
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
                      <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Total Feedback</p>
                      <p className="text-3xl font-bold text-blue-900">{feedbackStats.total_feedback || 0}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl bg-card border border-border shadow-sm">
                  <CardContent className="pt-6">
                    <div className="space-y-1">
                      <p className="text-xs text-yellow-600 font-semibold uppercase tracking-wider">Avg Rating</p>
                      <p className="text-3xl font-bold text-yellow-900">{feedbackStats.average_rating?.toFixed(1) || 'N/A'}/5</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl bg-card border border-border shadow-sm">
                  <CardContent className="pt-6">
                    <div className="space-y-1">
                      <p className="text-xs text-success font-semibold uppercase tracking-wider">Positive</p>
                      <p className="text-3xl font-bold text-success">{feedbackStats.positive_count || 0}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl bg-card border border-border shadow-sm">
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
