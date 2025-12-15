import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchKnowledgeSummary } from "@/services/knowledgeService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

function fmtPct(x?: number | null) {
  if (typeof x !== "number" || !Number.isFinite(x)) return "-";
  return `${(x * 100).toFixed(2)}%`;
}

export function KnowledgePanel() {
  const [useBackend, setUseBackend] = useState(true);

  const q = useQuery({
    queryKey: ["knowledge_summary"],
    queryFn: fetchKnowledgeSummary,
    enabled: useBackend,
    staleTime: 60_000,
  });

  const data = q.data;
  const regime = data?.market_regime;
  const fi = data?.feature_impact;
  const err = data?.model_error_vs_vol ?? undefined;
  const lift = data?.selection_lift_validation ?? undefined;
  const bins = data?.sentiment_effect?.bins ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="glass-card">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={useBackend} onCheckedChange={setUseBackend} />
              <Label className="text-sm">Backend mode</Label>
            </div>
            <Badge variant="outline" className="text-xs">
              {useBackend ? "API /api/knowledge/summary" : "No mock mode (knowledge is server-side)"}
            </Badge>
          </div>
          {useBackend && (
            <span className="text-xs text-muted-foreground">
              {q.isFetching ? "Đang tải..." : data?.asof ? `asof ${data.asof}` : ""}
            </span>
          )}
        </CardContent>
      </Card>

      {data?.error && (
        <Card className="glass-card border-destructive/30">
          <CardContent className="p-4 text-sm">
            <div className="font-semibold text-destructive">Knowledge error</div>
            <div className="text-muted-foreground">{data.error}</div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-card lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Market regime</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Label</span>
              <Badge variant="outline">{regime?.label ?? "-"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">20D return</span>
              <span className="font-mono">{fmtPct(regime?.ret_20d)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Daily vol</span>
              <span className="font-mono">{fmtPct(regime?.vol_daily)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Max drawdown</span>
              <span className="font-mono">{fmtPct(regime?.max_drawdown)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Feature impact (evidence)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-muted-foreground">
              Correlation is descriptive evidence (not causality). Used to explain why certain signals are trusted.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(fi?.top_abs_corr ?? []).slice(0, 10).map((x) => (
                <div key={x.feature} className="flex items-center justify-between rounded bg-muted/30 px-3 py-2">
                  <span className="font-mono">{x.feature}</span>
                  <span className="font-mono">{x.corr.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Robustness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Directional accuracy</span>
              <span className="font-mono">{fmtPct(err?.directional_accuracy)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">corr(vol, |error|)</span>
              <span className="font-mono">{typeof err?.corr_vol_abs_error === "number" ? err.corr_vol_abs_error.toFixed(4) : "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">corr(vol, quality)</span>
              <span className="font-mono">{typeof err?.corr_vol_model_quality === "number" ? err.corr_vol_model_quality.toFixed(4) : "-"}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Insight: volatility thường làm tăng error và giảm model_quality → dùng để justify gating + confidence.
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Backtest-style validation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Top-k</span>
              <span className="font-mono">{lift?.top_k ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg baseline</span>
              <span className="font-mono">{fmtPct(lift?.avg_baseline)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg lift</span>
              <span className="font-mono">{fmtPct(lift?.avg_lift)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Win rate</span>
              <span className="font-mono">{fmtPct(lift?.win_rate)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Sentiment coverage</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {bins.slice(0, 6).map((b) => (
              <div key={b.bin} className="rounded bg-muted/30 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{b.bin}</span>
                  <span className="font-mono">n={b.n}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  avg={fmtPct(b.avg_future_return)} · win={fmtPct(b.win_rate)}
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-3">
            Nếu coverage ~0, đây là limitation dữ liệu (cần mở rộng corpus news/sentiment) — đúng tinh thần đồ án Data Mining: nêu rõ giới hạn + kế hoạch cải thiện.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


