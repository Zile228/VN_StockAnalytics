import { z } from "zod";

export const BacktestEquityRowSchema = z.object({
  date: z.string(),
  value: z.number(),
});

export const BacktestComparisonRowSchema = z.object({
  date: z.string(),
  portfolio: z.number(),
  benchmark: z.number(),
});

export const BacktestTradeSchema = z.object({
  date: z.string(),
  ticker: z.string(),
  action: z.enum(["buy", "sell", "rebalance"]),
  shares: z.number(),
  price: z.number(),
  value: z.number(),
});

export const BacktestMetricsSchema = z.object({
  totalReturn: z.number(),
  annualizedReturn: z.number(),
  volatility: z.number(),
  sharpeRatio: z.number(),
  maxDrawdown: z.number(),
  winRate: z.number(),
  totalTrades: z.number().int(),
});

export const BacktestRunResponseSchema = z.object({
  symbols: z.array(z.string()),
  equityCurve: z.array(BacktestEquityRowSchema),
  comparison: z.array(BacktestComparisonRowSchema).optional().default([]),
  metrics: BacktestMetricsSchema.nullable().optional(),
  trades: z.array(BacktestTradeSchema).optional().default([]),
  error: z.string().optional(),
});

export type BacktestRunResponse = z.infer<typeof BacktestRunResponseSchema>;


