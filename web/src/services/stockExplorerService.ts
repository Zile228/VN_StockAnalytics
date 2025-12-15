import { apiGetJson } from "@/services/apiClient";
import {
  StockFeaturesResponseSchema,
  StockHistoryResponseSchema,
  StockLatestResponseSchema,
  StockListResponseSchema,
  StockNewsResponseSchema,
  StockPredictionResponseSchema,
  type StockFeaturesResponse,
  type StockHistoryResponse,
  type StockLatestResponse,
  type StockListResponse,
  type StockNewsResponse,
  type StockPredictionResponse,
} from "@/types/stocks";

export type ForecastSource = "stub" | "artifacts";

export async function fetchStockList(): Promise<StockListResponse> {
  const raw = await apiGetJson<unknown>("/api/stocks");
  return StockListResponseSchema.parse(raw);
}

export async function fetchStockHistory(params: {
  symbol: string;
  limit?: number;
  start?: string;
  end?: string;
}): Promise<StockHistoryResponse> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  const raw = await apiGetJson<unknown>(`/api/stocks/${params.symbol}/history?${qs.toString()}`);
  return StockHistoryResponseSchema.parse(raw);
}

export async function fetchStockLatest(symbol: string): Promise<StockLatestResponse> {
  const raw = await apiGetJson<unknown>(`/api/stocks/${symbol}/latest`);
  return StockLatestResponseSchema.parse(raw);
}

export async function fetchStockFeatures(symbol: string): Promise<StockFeaturesResponse> {
  const raw = await apiGetJson<unknown>(`/api/stocks/${symbol}/features`);
  return StockFeaturesResponseSchema.parse(raw);
}

export async function fetchStockNews(params: {
  symbol: string;
  lookbackDays?: number;
  limit?: number;
}): Promise<StockNewsResponse> {
  const qs = new URLSearchParams();
  qs.set("lookback_days", String(params.lookbackDays ?? 30));
  qs.set("limit", String(params.limit ?? 20));
  const raw = await apiGetJson<unknown>(`/api/stocks/${params.symbol}/news?${qs.toString()}`);
  return StockNewsResponseSchema.parse(raw);
}

export async function fetchStockPrediction(params: {
  symbol: string;
  horizonDays?: number;
  forecastSource?: ForecastSource;
}): Promise<StockPredictionResponse> {
  const qs = new URLSearchParams();
  qs.set("horizon", String(params.horizonDays ?? 7));
  qs.set("forecast_source", String(params.forecastSource ?? "stub"));
  const raw = await apiGetJson<unknown>(`/api/stocks/${params.symbol}/prediction?${qs.toString()}`);
  return StockPredictionResponseSchema.parse(raw);
}


