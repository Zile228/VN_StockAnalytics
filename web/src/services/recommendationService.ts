import { apiGetJson } from "@/services/apiClient";
import { RecommendationOutputSchema, type RecommendationOutput } from "@/types/recommendation";

export type ForecastSource = "stub" | "artifacts";

export interface RecommendParams {
  userId: string;
  horizonDays: number;
  topN: number;
  fundLagQuarters?: number;
  forecastSource?: ForecastSource;
}

export async function fetchRecommendation(params: RecommendParams): Promise<RecommendationOutput> {
  const qs = new URLSearchParams({
    user_id: params.userId,
    horizon: String(params.horizonDays),
    top_n: String(params.topN),
    fund_lag_quarters: String(params.fundLagQuarters ?? 0),
    forecast_source: String(params.forecastSource ?? "stub"),
  });
  const raw = await apiGetJson<unknown>(`/api/recommend?${qs.toString()}`);
  return RecommendationOutputSchema.parse(raw);
}


