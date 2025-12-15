import React, { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  Brush,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PriceData } from '@/data/mockData';

interface PriceChartProps {
  data: PriceData[];
  ticker?: string;
  showVolume?: boolean;
  enableZoom?: boolean;
}

export function PriceChart({ data, ticker, showVolume = false, enableZoom = true }: PriceChartProps) {
  const chartData = useMemo(() => {
    return data.map(d => ({
      date: d.date, // keep full date for zoom/brush; format in tickFormatter
      open: (d as any).open ?? d.close,
      high: (d as any).high ?? d.close,
      low: (d as any).low ?? d.close,
      close: d.close,
      price: d.close,
      volume: d.volume / 1000000,
      change: 0,
    })).map((d, i, arr) => ({
      ...d,
      change: i > 0 ? ((d.price - arr[i-1].price) / arr[i-1].price) * 100 : 0,
    }));
  }, [data]);

  const isPositive = chartData.length >= 2 
    ? chartData[chartData.length - 1].price >= chartData[0].price
    : true;

  const gradientId = `gradient-${ticker || 'default'}`;
  const strokeColor = isPositive ? 'hsl(var(--chart-up))' : 'hsl(var(--chart-down))';
  const fillColor = isPositive ? 'hsl(var(--chart-up))' : 'hsl(var(--chart-down))';

  const tooltipContent = (props: any) => {
    if (!props?.active) return null;
    const label = String(props?.label ?? '');
    const d = chartData.find(x => x.date === label);
    if (!d) return null;

    const boxStyle: React.CSSProperties = {
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 8,
      padding: 10,
      fontSize: 12,
      color: 'hsl(var(--foreground))',
      minWidth: 180,
    };

    const row = (k: string, v: string) => (
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">{k}</span>
        <span className="font-mono">{v}</span>
      </div>
    );

    return (
      <div style={boxStyle}>
        <div className="font-semibold mb-2">{label}</div>
        <div className="space-y-1">
          {row('Open', Number(d.open).toFixed(2))}
          {row('High', Number(d.high).toFixed(2))}
          {row('Low', Number(d.low).toFixed(2))}
          {row('Close', Number(d.close).toFixed(2))}
          {row('Chg', (Number(d.change)).toFixed(2) + '%')}
          {row('Volume', Number(d.volume).toFixed(2) + 'M')}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: enableZoom ? 20 : 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={fillColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={fillColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="hsl(var(--chart-grid))" 
            vertical={false}
          />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: string) => (value?.length >= 10 ? value.slice(5) : value)}
            tick={{ fill: 'hsl(var(--foreground))' }}
          />
          <YAxis 
            stroke="hsl(var(--foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
            tickFormatter={(value) => value.toFixed(0)}
            tick={{ fill: 'hsl(var(--foreground))' }}
          />
          <YAxis yAxisId="vol" hide domain={['auto', 'auto']} />
          <Tooltip content={tooltipContent} />
          {showVolume && (
            <Bar
              dataKey="volume"
              yAxisId="vol"
              barSize={10}
              fill="hsl(var(--muted-foreground))"
              opacity={0.12}
            />
          )}
          <Area
            type="monotone"
            dataKey="price"
            stroke={strokeColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: strokeColor }}
          />
          {enableZoom && (
            <Brush
              dataKey="date"
              height={22}
              stroke="hsl(var(--primary))"
              travellerWidth={10}
              tickFormatter={(value: string) => (value?.length >= 10 ? value.slice(5) : value)}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
