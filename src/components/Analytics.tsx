import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type PeriodType = 'DAY' | 'WEEK' | 'FORTNIGHT' | 'MONTH';

interface AnalyticsProps {
  period: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  data: {
    stats: Array<{ label: string; value: number; change?: number; trend?: 'up' | 'down' | 'neutral' }>;
    charts?: {
      timeSeries?: Array<{ date: string; value: number }>;
      distribution?: Array<{ name: string; value: number }>;
      comparison?: Array<{ category: string; current: number; previous: number }>;
    };
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function Analytics({ period, onPeriodChange, data }: AnalyticsProps) {
  return (
    <div className="space-y-6">
  <Tabs value={period} onValueChange={(v: string) => onPeriodChange(v as PeriodType)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="DAY">Day</TabsTrigger>
          <TabsTrigger value="WEEK">Week</TabsTrigger>
          <TabsTrigger value="FORTNIGHT">Fortnight</TabsTrigger>
          <TabsTrigger value="MONTH">Month</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {data.stats.map((stat, idx) => (
          <Card key={idx}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              {stat.trend && (
                <div className={`text-xs ${
                  stat.trend === 'up' ? 'text-green-600' : 
                  stat.trend === 'down' ? 'text-red-600' : 
                  'text-gray-600'
                }`}>
                  {stat.trend === 'up' && <TrendingUp className="h-4 w-4" />}
                  {stat.trend === 'down' && <TrendingDown className="h-4 w-4" />}
                  {stat.trend === 'neutral' && <Minus className="h-4 w-4" />}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              {stat.change !== undefined && (
                <p className={`text-xs ${stat.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.change >= 0 ? '+' : ''}{stat.change}% from previous period
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      {data.charts && (
        <div className="grid gap-6 md:grid-cols-2">
          {data.charts.timeSeries && (
            <Card>
              <CardHeader>
                <CardTitle>Trend Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.charts.timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {data.charts.distribution && (
            <Card>
              <CardHeader>
                <CardTitle>Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.charts.distribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {data.charts.distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {data.charts.comparison && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Period Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.charts.comparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="current" fill="#3b82f6" name="Current Period" />
                    <Bar dataKey="previous" fill="#94a3b8" name="Previous Period" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
