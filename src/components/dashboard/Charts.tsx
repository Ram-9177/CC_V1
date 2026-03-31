import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend
} from 'recharts';

const COLORS = ['#000000', 'hsl(var(--primary))', 'hsl(var(--secondary))', '#666666', '#999999'];

interface PieProps<T> {
  data: T[];
  dataKey?: string;
  nameKey?: string;
}

export function DashboardPieChart<T>({ data, dataKey = "value", nameKey = "name" }: PieProps<T>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey={dataKey}
          nameKey={nameKey}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <RechartsTooltip 
          contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        />
        <Legend verticalAlign="bottom" height={36}/>
      </PieChart>
    </ResponsiveContainer>
  );
}

interface BarConfig {
  key: string;
  fill: string;
  name: string;
  stackId?: string;
}

interface BarProps<T> {
  data: T[];
  nameKey?: string;
  bars?: BarConfig[];
}

export function DashboardBarChart<T>({ 
  data, 
  nameKey = "name",
  bars = [{ key: 'count', fill: 'hsl(var(--primary))', name: 'Count' }]
}: BarProps<T>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis 
          dataKey={nameKey} 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 12, fill: '#666' }}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 12, fill: '#666' }}
        />
        <RechartsTooltip 
          cursor={{ fill: 'transparent' }}
          contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
        />
        <Legend />
        {bars.map((bar) => (
          <Bar 
            key={bar.key} 
            dataKey={bar.key} 
            fill={bar.fill} 
            name={bar.name} 
            stackId={bar.stackId}
            radius={bar.stackId ? [0, 0, 0, 0] : [4, 4, 0, 0]} 
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

interface LineConfig {
  key: string;
  color: string;
  name: string;
  dashed?: boolean;
}

interface LineProps<T> {
  data: T[];
  nameKey?: string;
  lines?: LineConfig[];
}

export function DashboardLineChart<T>({ 
  data, 
  nameKey = "date",
  lines = [
    { key: 'attendance', color: '#10b981', name: 'Actual Attendance' },
    { key: 'forecast', color: '#3b82f6', name: 'Expected Forecast', dashed: true }
  ]
}: LineProps<T>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis 
              dataKey={nameKey} 
              fontSize={12} 
              tickFormatter={(val) => {
                try {
                  const date = new Date(val);
                  if (isNaN(date.getTime())) return String(val);
                  return date.toLocaleDateString('en-US', { weekday: 'short' });
                } catch {
                  return String(val);
                }
              }}
              stroke="#888888"
          />
          <YAxis fontSize={12} stroke="#888888" />
          <RechartsTooltip 
              contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
          />
          <Legend />
          {lines.map((line) => (
            <Line 
                key={line.key}
                type="monotone" 
                dataKey={line.key} 
                stroke={line.color} 
                strokeWidth={line.dashed ? 2 : 3} 
                strokeDasharray={line.dashed ? "5 5" : "0"}
                dot={line.dashed ? false : { r: 4, fill: line.color }} 
                activeDot={{ r: 6 }}
                name={line.name}
            />
          ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
