import React, { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Brush,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Customized,
} from 'recharts';
import { PriceData } from '@/data/mockData';

interface CandlestickChartProps {
  data: PriceData[];
  showVolume?: boolean;
  enableZoom?: boolean;
}

type CandleDatum = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isUp: boolean;
};

function CandlesLayer(props: any) {
  const { xAxisMap, yAxisMap, offset, data } = props;
  const xAxis = Object.values(xAxisMap || {})[0] as any;
  const yAxis = Object.values(yAxisMap || {})[0] as any;
  const xScale = xAxis?.scale;
  const yScale = yAxis?.scale;
  if (!xScale || !yScale) return null;

  const band = typeof xScale.bandwidth === 'function' ? xScale.bandwidth() : 10;
  const candleW = Math.max(2, Math.floor(band * 0.6));
  const left = offset?.left ?? 0;
  const top = offset?.top ?? 0;

  return (
    <g>
      {(data as CandleDatum[]).map((d, i) => {
        const raw = xScale(d.date) ?? xScale(String(d.date)) ?? xScale(i) ?? 0;
        const x0 = raw + left;
        const xc = x0 + band / 2;
        const yHigh = (yScale(d.high) ?? 0) + top;
        const yLow = (yScale(d.low) ?? 0) + top;
        const yOpen = (yScale(d.open) ?? 0) + top;
        const yClose = (yScale(d.close) ?? 0) + top;

        const up = d.isUp;
        const color = up ? 'hsl(var(--chart-up))' : 'hsl(var(--chart-down))';
        const bodyTop = Math.min(yOpen, yClose);
        const bodyBot = Math.max(yOpen, yClose);
        const bodyH = Math.max(1, bodyBot - bodyTop);
        const bodyX = xc - candleW / 2;

        return (
          <g key={i}>
            {/* wick */}
            <line x1={xc} x2={xc} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} opacity={0.9} />
            {/* body */}
            <rect x={bodyX} y={bodyTop} width={candleW} height={bodyH} fill={color} opacity={0.85} rx={1} />
          </g>
        );
      })}
    </g>
  );
}

export function CandlestickChart({ data, showVolume = true, enableZoom = true }: CandlestickChartProps) {
  const chartData = useMemo(() => {
    return data.map(d => ({
      date: d.date, // keep full date for Brush
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume / 1000000,
      isUp: d.close >= d.open,
    })) as CandleDatum[];
  }, [data]);

  const tooltipContent = (props: any) => {
    if (!props?.active) return null;
    const label = String(props?.label ?? '');
    const d = (chartData as CandleDatum[]).find(x => x.date === label);
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
          {row('Open', d.open.toFixed(2))}
          {row('High', d.high.toFixed(2))}
          {row('Low', d.low.toFixed(2))}
          {row('Close', d.close.toFixed(2))}
          {row('Volume', (d.volume).toFixed(2) + 'M')}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: enableZoom ? 20 : 0 }}>
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
            tick={{ fill: 'hsl(var(--foreground))' }}
          />
          <YAxis yAxisId="vol" hide domain={['auto', 'auto']} />
          <Tooltip content={tooltipContent} />
          {/* Hidden series to ensure the price YAxis domain/scale is computed */}
          <Bar dataKey="close" fill="transparent" opacity={0} isAnimationActive={false} />
          {showVolume && (
            <Bar
              dataKey="volume"
              yAxisId="vol"
              barSize={10}
              fill="hsl(var(--muted-foreground))"
              opacity={0.12}
            />
          )}
          <Customized component={CandlesLayer} />
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
