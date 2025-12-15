import { z } from "zod";

export const DashboardIndexRowSchema = z.object({
  date: z.string(),
  close: z.number(),
  volume: z.number(),
});

export const DashboardOverviewResponseSchema = z.object({
  asof: z.string(),
  index_series: z.array(DashboardIndexRowSchema),
  breadth: z.object({
    gainers: z.number().int(),
    losers: z.number().int(),
    unchanged: z.number().int(),
  }),
  total_volume: z.number(),
  rows: z.array(
    z.object({
      symbol: z.string(),
      close: z.number(),
      change: z.number(),
      volume: z.number(),
      sector: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
    })
  ),
});

export type DashboardOverviewResponse = z.infer<typeof DashboardOverviewResponseSchema>;


