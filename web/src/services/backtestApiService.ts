import { apiPostJson } from "@/services/apiClient";
import { BacktestRunResponseSchema, type BacktestRunResponse } from "@/types/backtest_api";

export async function runBacktestApi(params: {
  symbols: string[];
  weights: Record<string, number>;
  start?: string;
  end?: string;
  initialCapital?: number;
  rebalancePeriod?: "daily" | "weekly" | "monthly";
}): Promise<BacktestRunResponse> {
  const body = {
    symbols: params.symbols,
    weights: params.weights,
    start: params.start ?? null,
    end: params.end ?? null,
    initial_capital: params.initialCapital ?? 100_000_000,
    rebalance_period: params.rebalancePeriod ?? "weekly",
  };
  const raw = await apiPostJson<unknown>("/api/backtest/run", body);
  return BacktestRunResponseSchema.parse(raw);
}


