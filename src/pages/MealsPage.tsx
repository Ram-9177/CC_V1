import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Utensils, Calendar, Clock, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { getApiErrorMessage } from '@/lib/utils';

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

  const getMealTypeIcon = (mealType: string) => {
    return Utensils;
  };

  const getMealTypeBadge = (mealType: string) => {
    switch (mealType) {
      case 'breakfast':
        return <Badge className="bg-yellow-100 text-yellow-800">Breakfast</Badge>;
      case 'lunch':
        return <Badge className="bg-orange-100 text-orange-800">Lunch</Badge>;
      case 'dinner':
        return <Badge className="bg-purple-100 text-purple-800">Dinner</Badge>;
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="schedule">Meal Schedule</TabsTrigger>
          <TabsTrigger value="attendance">Meal Attendance</TabsTrigger>
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

          <Card>
            <CardHeader>
              <CardTitle>Today's Menu</CardTitle>
            </CardHeader>
            <CardContent>
              {mealsLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading meals...</div>
              ) : filteredMeals && filteredMeals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {filteredMeals.map((meal) => {
                    const Icon = getMealTypeIcon(meal.meal_type);
                    return (
                      <Card key={meal.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            {getMealTypeBadge(meal.meal_type)}
                            {meal.available ? (
                              <Badge className="bg-green-100 text-green-800">Available</Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800">Not Available</Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {new Date(meal.date).toLocaleDateString()}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm font-semibold">Menu:</Label>
                            <p className="text-sm">{meal.menu}</p>
                          </div>
                          {meal.available && (
                            <Button
                              className="w-full"
                              size="sm"
                              onClick={() =>
                                markMealMutation.mutate({ meal_id: meal.id, status: 'taken' })
                              }
                              disabled={markMealMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Mark as Taken
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No meals scheduled for this date
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meal Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Meal Attendance Records</CardTitle>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading attendance...
                </div>
              ) : mealAttendance && mealAttendance.length > 0 ? (
                <div className="overflow-x-auto">
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
                              <Badge className="bg-green-100 text-green-800">Taken</Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800">Skipped</Badge>
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
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No meal attendance records found
                </div>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
