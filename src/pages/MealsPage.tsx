import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Utensils, Calendar, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { getApiErrorMessage, cn } from '@/lib/utils';

interface Meal {
  id: number;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner';
  menu: string;
  available: boolean;
}

interface MealAttendance {
  id: number;
  meal: Meal;
  student: {
    id: number;
    name: string;
    hall_ticket?: string;
    username?: string;
  };
  marked_at: string;
  status: 'taken' | 'skipped';
}

interface MealPreference {
  id: number;
  meal_type: string;
  preference: string;
  dietary_restrictions: string;
}

export default function MealsPage() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedMealType, setSelectedMealType] = useState<string>('all');

  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isAuthority = user?.role && ['admin', 'super_admin', 'warden', 'head_warden', 'chef'].includes(user.role);

  const { data: meals, isLoading: mealsLoading } = useQuery<Meal[]>({
    queryKey: ['meals', selectedDate],
    queryFn: async () => {
      const response = await api.get('/meals/', {
        params: { date: selectedDate },
      });
      return response.data.results || response.data;
    },
  });

  const { data: mealAttendance, isLoading: attendanceLoading } = useQuery<MealAttendance[]>({
    queryKey: ['meal-attendance', selectedDate, selectedMealType],
    enabled: !!isAuthority,
    queryFn: async () => {
      const params: any = { date: selectedDate };
      if (selectedMealType !== 'all') params.meal_type = selectedMealType;

      const response = await api.get('/meals/attendance/', { params });
      return response.data.results || response.data;
    },
  });

  const { data: preferences } = useQuery<MealPreference[]>({
    queryKey: ['meal-preferences'],
    queryFn: async () => {
      const response = await api.get('/meals/preferences/');
      return response.data.results || response.data;
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
    onError: (error: any) => {
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
    onError: (error: any) => {
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
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Failed to update restrictions'));
    },
  });

  const getMealTypeBadge = (mealType: string) => {
    switch (mealType) {
      case 'breakfast':
        return <Badge variant="outline" className="bg-secondary/60 text-foreground border-secondary/70">Breakfast</Badge>;
      case 'lunch':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Lunch</Badge>;
      case 'dinner':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Dinner</Badge>;
      default:
        return <Badge variant="outline">{mealType}</Badge>;
    }
  };

  const filteredMeals = meals?.filter(
    (meal) => selectedMealType === 'all' || meal.meal_type === selectedMealType
  );

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Utensils className="h-8 w-8" />
          Meal Management
        </h1>
        <p className="text-muted-foreground">Manage meal schedules and track meal attendance</p>
      </div>

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList className={cn("grid w-full", isAuthority ? "grid-cols-3" : "grid-cols-2")}>
          <TabsTrigger value="schedule">Meal Schedule</TabsTrigger>
          {isAuthority && <TabsTrigger value="attendance">Meal Attendance</TabsTrigger>}
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
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
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                    <Card key={meal.id} className="overflow-hidden border shadow-sm rounded-3xl hover:shadow-md transition-shadow">
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
                          <Button
                            className="w-full rounded-2xl h-11 font-bold shadow-lg shadow-primary/10 transition-transform active:scale-95"
                            onClick={() =>
                              markMealMutation.mutate({ meal_id: meal.id, status: 'taken' })
                            }
                            disabled={markMealMutation.isPending}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Mark as Consumed
                          </Button>
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
      </Tabs>
    </div>
  );
}
