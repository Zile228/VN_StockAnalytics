import { z } from "zod";

export const PortfolioWeightsSchema = z.record(z.string(), z.number());

export const FrontierPointSchema = z.object({
  volatility: z.number(),
  return: z.number(),
  sharpeRatio: z.number(),
  weights: PortfolioWeightsSchema,
});

export const PortfolioOptimizeResponseSchema = z.object({
  asof: z.string(),
  symbols: z.array(z.string()),
  max_sharpe: FrontierPointSchema.nullable().optional(),
  min_vol: FrontierPointSchema.nullable().optional(),
  frontier: z.array(FrontierPointSchema),
  error: z.string().optional(),
});

export type PortfolioOptimizeResponse = z.infer<typeof PortfolioOptimizeResponseSchema>;


