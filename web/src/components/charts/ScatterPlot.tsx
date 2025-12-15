import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from 'recharts';
import { EfficientFrontierPoint } from '@/services/portfolioService';

interface ScatterPlotProps {
  data: EfficientFrontierPoint[];
  optimalPoint?: EfficientFrontierPoint;
}

export function ScatterPlot({ data, optimalPoint }: ScatterPlotProps) {
  const chartData = data.map(d => ({
    x: d.volatility * 100,
    y: d.return * 100,
    z: d.sharpeRatio,
  }));

  const optimalData = optimalPoint ? [{
    x: optimalPoint.volatility * 100,
    y: optimalPoint.return * 100,
    z: optimalPoint.sharpeRatio,
  }] : [];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="hsl(var(--chart-grid))"
        />
        <XAxis 
          type="number"
          dataKey="x"
          name="Volatility"
          unit="%"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          label={{ 
            value: 'Biến động (%)', 
            position: 'bottom',
            style: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 }
          }}
        />
        <YAxis 
          type="number"
          dataKey="y"
          name="Return"
          unit="%"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          label={{ 
            value: 'Lợi nhuận (%)', 
            angle: -90, 
            position: 'insideLeft',
            style: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 }
          }}
        />
        <ZAxis type="number" dataKey="z" range={[20, 100]} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number, name: string) => {
            const labels: Record<string, string> = {
              x: 'Biến động',
              y: 'Lợi nhuận',
              z: 'Sharpe',
            };
            return [`${value.toFixed(2)}%`, labels[name] || name];
          }}
        />
        <Scatter 
          name="Portfolios" 
          data={chartData} 
          fill="hsl(var(--muted-foreground))"
          fillOpacity={0.3}
        />
        {optimalData.length > 0 && (
          <Scatter 
            name="Optimal" 
            data={optimalData} 
            fill="hsl(var(--primary))"
            shape="star"
          />
        )}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
