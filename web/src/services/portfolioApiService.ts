import { apiPostJson } from "@/services/apiClient";
import { PortfolioOptimizeResponseSchema, type PortfolioOptimizeResponse } from "@/types/portfolio_api";

export async function optimizePortfolioApi(params: {
  symbols: string[];
  lookbackDays?: number;
  nPortfolios?: number;
  seed?: number;
}): Promise<PortfolioOptimizeResponse> {
  const body = {
    symbols: params.symbols,
    lookback_days: params.lookbackDays ?? 252,
    n_portfolios: params.nPortfolios ?? 500,
    seed: params.seed ?? 42,
  };
  const raw = await apiPostJson<unknown>("/api/portfolio/optimize", body);
  return PortfolioOptimizeResponseSchema.parse(raw);
}


