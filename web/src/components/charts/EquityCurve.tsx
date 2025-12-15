import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface EquityCurveProps {
  data: { date: string; portfolio: number; benchmark: number }[];
}

export function EquityCurve({ data }: EquityCurveProps) {
  const chartData = data.map(d => ({
    date: d.date.slice(5),
    'Danh mục': d.portfolio,
    'Benchmark': d.benchmark,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="hsl(var(--chart-grid))" 
          vertical={false}
        />
        <XAxis 
          dataKey="date" 
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          formatter={(value: number) => [
            new Intl.NumberFormat('vi-VN').format(value) + ' đ',
          ]}
        />
        <Legend
          verticalAlign="top"
          height={36}
          formatter={(value) => <span className="text-foreground text-sm">{value}</span>}
        />
        <Line
          type="monotone"
          dataKey="Danh mục"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
        />
        <Line
          type="monotone"
          dataKey="Benchmark"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1.5}
          strokeDasharray="5 5"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
