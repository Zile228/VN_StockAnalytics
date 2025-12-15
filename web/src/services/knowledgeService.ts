import { apiGetJson } from "@/services/apiClient";
import { KnowledgeSummarySchema, type KnowledgeSummary } from "@/types/knowledge";

export async function fetchKnowledgeSummary(): Promise<KnowledgeSummary> {
  const raw = await apiGetJson<unknown>("/api/knowledge/summary");
  return KnowledgeSummarySchema.parse(raw);
}


