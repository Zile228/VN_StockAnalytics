import { apiGetJson } from "@/services/apiClient";
import { DashboardOverviewResponseSchema, type DashboardOverviewResponse } from "@/types/dashboard";

export async function fetchDashboardOverview(params?: { limit?: number }): Promise<DashboardOverviewResponse> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  const raw = await apiGetJson<unknown>(`/api/dashboard/overview?${qs.toString()}`);
  return DashboardOverviewResponseSchema.parse(raw);
}


