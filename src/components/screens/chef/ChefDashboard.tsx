import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Coffee, Sun, Moon, Users, TrendingUp, UtensilsCrossed, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

export function ChefDashboard() {
  const navigate = useNavigate();

  const stats = {
    totalToday: 425,
    breakfast: 145,
    lunch: 138,
    dinner: 142,
    studentsOutside: 19,
    optedOut: 9,
  };

  const todayMenu = [
    { meal: 'BREAKFAST', items: ['Idli', 'Sambar', 'Chutney', 'Tea/Coffee'], count: stats.breakfast },
    { meal: 'LUNCH', items: ['Rice', 'Dal', 'Veg Curry', 'Curd'], count: stats.lunch },
    { meal: 'DINNER', items: ['Chapati', 'Paneer Curry', 'Dal', 'Rice'], count: stats.dinner },
  ];

  const getMealIcon = (meal: string) => {
    switch (meal) {
      case 'BREAKFAST':
        return <Coffee className="h-5 w-5" />;
      case 'LUNCH':
        return <Sun className="h-5 w-5" />;
      case 'DINNER':
        return <Moon className="h-5 w-5" />;
    }
  };

  // Weekly meal participation
  const weeklyMealData = [
    { day: 'Mon', breakfast: 145, lunch: 142, dinner: 148 },
    { day: 'Tue', breakfast: 148, lunch: 140, dinner: 145 },
    { day: 'Wed', breakfast: 142, lunch: 138, dinner: 143 },
    { day: 'Thu', breakfast: 147, lunch: 141, dinner: 146 },
    { day: 'Fri', breakfast: 145, lunch: 138, dinner: 142 },
    { day: 'Sat', breakfast: 135, lunch: 130, dinner: 138 },
  ];

  // Meal preference distribution
  const mealDistribution = [
    { meal: 'Breakfast', value: 145, color: '#f59e0b' },
    { meal: 'Lunch', value: 138, color: '#3b82f6' },
    { meal: 'Dinner', value: 142, color: '#8b5cf6' },
  ];

  // Response rate comparison
  const responseData = [
    { meal: 'Breakfast', responded: 165, total: 169 },
    { meal: 'Lunch', responded: 162, total: 169 },
    { meal: 'Dinner', responded: 163, total: 169 },
  ];

  // Food waste reduction trend
  const wasteReduction = [
    { month: 'Jul', waste: 25 },
    { month: 'Aug', waste: 20 },
    { month: 'Sep', waste: 15 },
    { month: 'Oct', waste: 12 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Chef Dashboard</h1>
        <p className="text-muted-foreground">Meal management overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.totalToday}</div>
            <p className="text-xs text-muted-foreground">Across all meals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Students Outside</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-orange-600 dark:text-orange-400">{stats.studentsOutside}</div>
            <p className="text-xs text-muted-foreground">Auto-excluded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Opted Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600 dark:text-red-400">{stats.optedOut}</div>
            <p className="text-xs text-muted-foreground">Manually declined</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Participation Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600 dark:text-green-400">94%</div>
            <p className="text-xs text-muted-foreground">Average today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/chef/meals')}
            >
              <UtensilsCrossed className="h-4 w-4" />
              Manage Today's Menu
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/chef/intents')}
            >
              <Users className="h-4 w-4" />
              View Meal Intents Summary
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/chef/users')}
            >
              <TrendingUp className="h-4 w-4" />
              Export Reports (CSV)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meal Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayMenu.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getMealIcon(item.meal)}
                    <div>
                      <p className="font-medium">{item.meal}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.items.slice(0, 2).join(', ')}...
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-lg px-4 py-1">
                    {item.count}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Complete Menu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {todayMenu.map((item, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  {getMealIcon(item.meal)}
                  <h3 className="font-medium">{item.meal}</h3>
                </div>
                <ul className="space-y-1 mb-3">
                  {item.items.map((food, foodIdx) => (
                    <li key={foodIdx} className="text-sm flex items-center gap-2">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      {food}
                    </li>
                  ))}
                </ul>
                <div className="pt-3 border-t">
                  <p className="text-sm text-muted-foreground">Expected Count</p>
                  <p className="text-xl">{item.count}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Meal Participation</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weeklyMealData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }} 
                />
                <Legend />
                <Line type="monotone" dataKey="breakfast" stroke="#f59e0b" strokeWidth={2} name="Breakfast" />
                <Line type="monotone" dataKey="lunch" stroke="#3b82f6" strokeWidth={2} name="Lunch" />
                <Line type="monotone" dataKey="dinner" stroke="#8b5cf6" strokeWidth={2} name="Dinner" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Meal Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={mealDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {mealDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Response Rate Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={responseData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="meal" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }} 
                />
                <Legend />
                <Bar dataKey="responded" fill="#22c55e" name="Responded" />
                <Bar dataKey="total" fill="#94a3b8" name="Total Students" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Food Waste Reduction Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={wasteReduction}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                  formatter={(value) => [`${value}%`, 'Waste']}
                />
                <Bar dataKey="waste" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                53% waste reduction in last 4 months! 🎉
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Average Participation</span>
                <span className="font-medium">92.5%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Meals Served</span>
                <span className="font-medium">2,976</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Students Outside Daily</span>
                <span className="font-medium">~18</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Waste Reduction</span>
                <span className="font-medium text-green-600 dark:text-green-400">+12%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Real-time Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Student returned (IN)</p>
                  <p className="text-xs text-muted-foreground">HT003 added to dinner count</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <Users className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Student went out (OUT)</p>
                  <p className="text-xs text-muted-foreground">HT012 removed from lunch count</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
