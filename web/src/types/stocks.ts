import { z } from "zod";

export const StockListResponseSchema = z.object({
  asof: z.string(),
  symbols: z.array(
    z.object({
      symbol: z.string(),
      name: z.string().nullable().optional(),
      sector: z.string().nullable().optional(),
    })
  ),
});
export type StockListResponse = z.infer<typeof StockListResponseSchema>;

export const StockHistoryRowSchema = z.object({
  date: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export const StockHistoryResponseSchema = z.object({
  symbol: z.string(),
  rows: z.array(StockHistoryRowSchema),
});
export type StockHistoryResponse = z.infer<typeof StockHistoryResponseSchema>;

export const StockLatestResponseSchema = z.object({
  symbol: z.string(),
  latest: z
    .object({
      date: z.string(),
      open: z.number(),
      high: z.number(),
      low: z.number(),
      close: z.number(),
      volume: z.number(),
      change: z.number().nullable().optional(),
    })
    .nullable(),
});
export type StockLatestResponse = z.infer<typeof StockLatestResponseSchema>;

export const StockFeaturesResponseSchema = z.object({
  symbol: z.string(),
  features: z.object({
    return1d: z.number(),
    return3d: z.number(),
    ma5: z.number(),
    ma10: z.number(),
    volatility: z.number(),
    momentum: z.number(),
    rsi: z.number(),
  }),
});
export type StockFeaturesResponse = z.infer<typeof StockFeaturesResponseSchema>;

export const StockNewsResponseSchema = z.object({
  symbol: z.string(),
  summary: z
    .object({
      avg_score: z.number(),
      avg_relevance: z.number(),
      n: z.number(),
      evidence: z.array(z.string()),
    })
    .nullable(),
  rows: z.array(
    z.object({
      published_at: z.string(),
      title: z.string(),
      sapo: z.string(),
      source: z.string(),
      url: z.string(),
      sentiment: z
        .object({
          sentiment_score: z.number(),
          relevance: z.number(),
          category: z.string().nullable().optional(),
          reasoning: z.string().nullable().optional(),
          model_used: z.string().nullable().optional(),
        })
        .nullable(),
    })
  ),
});
export type StockNewsResponse = z.infer<typeof StockNewsResponseSchema>;

export const StockPredictionResponseSchema = z.object({
  symbol: z.string(),
  prediction: z
    .object({
      predictedReturn: z.number(),
      predictedPrice: z.number(),
      confidence: z.number(),
      direction: z.enum(["up", "down", "neutral"]),
      asof: z.string(),
      horizon_days: z.number().int(),
    })
    .nullable(),
});
export type StockPredictionResponse = z.infer<typeof StockPredictionResponseSchema>;


