import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PortfolioWeights } from '@/services/portfolioService';

interface PortfolioDonutProps {
  weights: PortfolioWeights;
}

const COLORS = [
  'hsl(172, 66%, 50%)',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(200, 70%, 50%)',
];

export function PortfolioDonut({ weights }: PortfolioDonutProps) {
  const data = useMemo(() => {
    return Object.entries(weights)
      .filter(([_, weight]) => weight > 0.001)
      .map(([ticker, weight]) => ({
        name: ticker,
        value: Math.round(weight * 10000) / 100,
      }))
      .sort((a, b) => b.value - a.value);
  }, [weights]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number) => [`${value.toFixed(2)}%`, 'Tỷ trọng']}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => <span className="text-foreground text-sm">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
