import { z } from "zod";

export const RecommendationOutputSchema = z.object({
  horizon_days: z.number().int().min(1),
  recommended_actions: z.array(
    z.object({
      symbol: z.string().min(1),
      action: z.enum(["buy", "sell", "hold"]),
      target_weight: z.number().min(0).max(1),
      confidence: z.number().min(0).max(1),
      expected_return: z.number(),
      uncertainty_band: z.object({
        p10: z.number(),
        p50: z.number(),
        p90: z.number(),
      }),
      order_plan: z.object({
        order_type: z.enum(["limit", "market", "stop_limit"]),
        entry_rule: z.string(),
        ladder: z
          .array(
            z.object({
              step_pct: z.number(),
              size_pct_of_symbol: z.number().min(0).max(1),
            })
          )
          .nullable()
          .optional(),
        time_in_force: z.enum(["day", "gtc"]),
      }),
      risk_controls: z.object({
        stop_loss_rule: z.string(),
        take_profit_rule: z.string(),
        max_loss_pct_portfolio: z.number().min(0).max(0.05),
      }),
      evidence: z.array(z.string()),
      invalidation: z.array(z.string()),
    })
  ),
  cash_weight: z.number().min(0).max(1),
  notes: z.string(),
});

export type RecommendationOutput = z.infer<typeof RecommendationOutputSchema>;


