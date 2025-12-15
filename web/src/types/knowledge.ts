import { z } from "zod";

export const KnowledgeMarketRegimeSchema = z.object({
  label: z.string(),
  lookback_days: z.number().int().optional(),
  ret_20d: z.number().optional(),
  vol_daily: z.number().optional(),
  max_drawdown: z.number().optional(),
  asof: z.string().optional(),
});

export const KnowledgeFeatureCorrSchema = z.object({
  feature: z.string(),
  corr: z.number(),
});

export const KnowledgeSummarySchema = z.object({
  asof: z.string().nullable().optional(),
  market_regime: KnowledgeMarketRegimeSchema.optional(),
  feature_impact: z
    .object({
      top_abs_corr: z.array(KnowledgeFeatureCorrSchema).optional(),
      by_group: z.record(z.string(), z.array(KnowledgeFeatureCorrSchema)).optional(),
      notes: z.string().optional(),
    })
    .optional(),
  sentiment_effect: z
    .object({
      bins: z.array(
        z.object({
          bin: z.string(),
          n: z.number().int(),
          avg_future_return: z.number(),
          win_rate: z.number(),
        })
      ),
      sent_col: z.string().optional(),
      target: z.string().optional(),
    })
    .optional(),
  model_error_vs_vol: z
    .object({
      n_joined: z.number().int(),
      corr_vol_abs_error: z.number(),
      corr_vol_rmse: z.number(),
      corr_vol_model_quality: z.number(),
      directional_accuracy: z.number(),
      rmse_window: z.number().int().optional(),
      notes: z.string().optional(),
    })
    .nullable()
    .optional(),
  selection_lift_validation: z
    .object({
      top_k: z.number().int(),
      n_days: z.number().int(),
      avg_baseline: z.number(),
      avg_lift: z.number(),
      win_rate: z.number(),
      notes: z.string().optional(),
    })
    .nullable()
    .optional(),
  dataset_meta: z.any().optional(),
  error: z.string().optional(),
});

export type KnowledgeSummary = z.infer<typeof KnowledgeSummarySchema>;


