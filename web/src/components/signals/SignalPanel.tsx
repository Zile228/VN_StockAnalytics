import { useMemo, useState } from 'react';
import { TICKERS, PRICE_DATA, NEWS_DATA } from '@/data/mockData';
import { Signal, generateSignal, getTopBuySignals, getTopSellSignals } from '@/services/signalService';
import { predictPrice } from '@/services/predictionService';
import { analyzeSentiment, aggregateSentiment } from '@/services/sentimentService';
import { TickerBadge } from '@/components/ui/ticker-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle, Minus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { fetchRecommendation } from '@/services/recommendationService';
import type { RecommendationOutput } from '@/types/recommendation';

function SignalCard({ signal }: { signal: Signal }) {
  const getSignalIcon = () => {
    if (signal.type === 'BUY') return <TrendingUp className="w-5 h-5 text-success" />;
    if (signal.type === 'SELL') return <TrendingDown className="w-5 h-5 text-destructive" />;
    return <Minus className="w-5 h-5 text-muted-foreground" />;
  };

  const getStrengthBadge = () => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      strong: 'default',
      moderate: 'secondary',
      weak: 'outline',
    };
    return (
      <Badge variant={variants[signal.strength]} className={signal.type === 'BUY' ? 'bg-success/20 text-success border-success/30' : signal.type === 'SELL' ? 'bg-destructive/20 text-destructive border-destructive/30' : ''}>
        {signal.strength === 'strong' ? 'Mạnh' : signal.strength === 'moderate' ? 'Trung bình' : 'Yếu'}
      </Badge>
    );
  };

  const getRiskBadge = () => {
    const colors: Record<string, string> = {
      low: 'bg-success/20 text-success',
      medium: 'bg-warning/20 text-warning',
      high: 'bg-destructive/20 text-destructive',
    };
    return (
      <Badge variant="outline" className={colors[signal.riskLevel]}>
        Rủi ro: {signal.riskLevel === 'low' ? 'Thấp' : signal.riskLevel === 'medium' ? 'TB' : 'Cao'}
      </Badge>
    );
  };

  return (
    <Card className="glass-card hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getSignalIcon()}
            <TickerBadge ticker={signal.ticker} size="lg" />
            <Badge variant={signal.type === 'BUY' ? 'default' : signal.type === 'SELL' ? 'destructive' : 'secondary'}>
              {signal.type === 'BUY' ? 'MUA' : signal.type === 'SELL' ? 'BÁN' : 'GIỮ'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {getStrengthBadge()}
            {getRiskBadge()}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
          <div>
            <span className="text-muted-foreground">Return dự báo</span>
            <p className={`font-mono font-medium ${signal.expectedReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
              {(signal.expectedReturn * 100).toFixed(2)}%
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Độ tin cậy</span>
            <p className="font-mono font-medium">{(signal.confidence * 100).toFixed(0)}%</p>
          </div>
          <div>
            <span className="text-muted-foreground">RSI</span>
            <p className={`font-mono font-medium ${signal.technical.rsi > 70 ? 'text-destructive' : signal.technical.rsi < 30 ? 'text-success' : ''}`}>
              {signal.technical.rsi.toFixed(1)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Phân bổ đề xuất</span>
            <p className="font-mono font-medium text-primary">
              {signal.suggestedAllocation > 0 ? '+' : ''}{signal.suggestedAllocation}%
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Lý do:</span>
          <div className="flex flex-wrap gap-1">
            {signal.reasons.slice(0, 4).map((reason, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {reason}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({ item }: { item: RecommendationOutput['recommended_actions'][number] }) {
  const actionLabel = item.action === 'buy' ? 'MUA' : item.action === 'sell' ? 'BÁN' : 'GIỮ';
  const actionColor =
    item.action === 'buy'
      ? 'bg-success/20 text-success border-success/30'
      : item.action === 'sell'
        ? 'bg-destructive/20 text-destructive border-destructive/30'
        : 'bg-muted text-muted-foreground';

  return (
    <Card className="glass-card hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <TickerBadge ticker={item.symbol} size="lg" />
            <Badge variant="outline" className={actionColor}>
              {actionLabel}
            </Badge>
          </div>
          <div className="text-right text-sm">
            <div className="text-muted-foreground">Độ tin cậy</div>
            <div className="font-mono font-semibold">{Math.round(item.confidence * 100)}%</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Return kỳ vọng</div>
            <div className={`font-mono font-semibold ${item.expected_return >= 0 ? 'text-success' : 'text-destructive'}`}>
              {(item.expected_return * 100).toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Target weight</div>
            <div className="font-mono font-semibold text-primary">{(item.target_weight * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Uncertainty (P10/P50/P90)</div>
            <div className="font-mono text-xs">
              {(item.uncertainty_band.p10 * 100).toFixed(1)} / {(item.uncertainty_band.p50 * 100).toFixed(1)} / {(item.uncertainty_band.p90 * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Order</div>
            <div className="font-mono text-xs">{item.order_plan.order_type.toUpperCase()} · {item.order_plan.time_in_force.toUpperCase()}</div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Entry rule</div>
          <div className="text-sm">{item.order_plan.entry_rule}</div>
        </div>

        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Risk controls</div>
            <div className="text-xs">{item.risk_controls.stop_loss_rule}</div>
            <div className="text-xs">{item.risk_controls.take_profit_rule}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Evidence</div>
            <div className="flex flex-wrap gap-1">
              {item.evidence.slice(0, 4).map((e, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {e}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SignalPanel() {
  const [activeTab, setActiveTab] = useState('all');
  const [useBackend, setUseBackend] = useState(false);
  const [userId, setUserId] = useState('demo');
  const [horizon, setHorizon] = useState(7);
  const [topN, setTopN] = useState(5);
  const [forecastSource, setForecastSource] = useState<'stub' | 'artifacts'>('stub');

  const recommendationQuery = useQuery({
    queryKey: ['recommendation', userId, horizon, topN, forecastSource],
    queryFn: () =>
      fetchRecommendation({
        userId,
        horizonDays: horizon,
        topN,
        fundLagQuarters: 0,
        forecastSource,
      }),
    enabled: useBackend,
    staleTime: 30_000,
  });

  // Generate signals for all tickers (mock/local mode)
  const allSignals = useMemo(() => {
    if (useBackend) return [];
    const signals: Signal[] = [];

    for (const ticker of TICKERS) {
      const prices = PRICE_DATA[ticker.symbol];
      if (!prices || prices.length < 10) continue;

      const prediction = predictPrice(prices);

      // Get sentiment
      const relatedNews = NEWS_DATA.filter(n => n.ticker === ticker.symbol);
      const sentiments = relatedNews.map(n => analyzeSentiment(n.title + ' ' + n.content));
      const sentiment = sentiments.length > 0 ? aggregateSentiment(sentiments) : null;

      const signal = generateSignal(ticker.symbol, prices, prediction, sentiment);
      signals.push(signal);
    }

    return signals;
  }, [useBackend]);

  const buySignals = getTopBuySignals(allSignals, 10);
  const sellSignals = getTopSellSignals(allSignals, 10);
  const holdSignals = allSignals.filter(s => s.type === 'HOLD');

  const backendActions = (recommendationQuery.data?.recommended_actions ?? []);
  const backendBuy = backendActions.filter(a => a.action === 'buy');
  const backendSell = backendActions.filter(a => a.action === 'sell');
  const backendHold = backendActions.filter(a => a.action === 'hold');

  const displaySignals = activeTab === 'buy' ? buySignals :
                         activeTab === 'sell' ? sellSignals :
                         activeTab === 'hold' ? holdSignals : allSignals;

  const displayActions = activeTab === 'buy' ? backendBuy :
                         activeTab === 'sell' ? backendSell :
                         activeTab === 'hold' ? backendHold : backendActions;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Mode Switch */}
      <Card className="glass-card">
        <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={useBackend} onCheckedChange={setUseBackend} />
              <Label className="text-sm">Backend mode</Label>
            </div>
            <Badge variant="outline" className="text-xs">
              {useBackend ? 'API /api/recommend' : 'Mock (in-browser)'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:flex md:items-center gap-2">
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="user_id" className="h-9" />
            <Input
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value || 7))}
              placeholder="horizon"
              type="number"
              className="h-9"
            />
            <Input
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value || 5))}
              placeholder="top_n"
              type="number"
              className="h-9"
            />
            <Select value={forecastSource} onValueChange={(v) => setForecastSource(v as any)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="forecast_source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stub">stub</SelectItem>
                <SelectItem value="artifacts">artifacts</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card border-success/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/20">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success">{useBackend ? backendBuy.length : buySignals.length}</p>
              <p className="text-sm text-muted-foreground">Tín hiệu MUA</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-destructive/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/20">
              <TrendingDown className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{useBackend ? backendSell.length : sellSignals.length}</p>
              <p className="text-sm text-muted-foreground">Tín hiệu BÁN</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Minus className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{useBackend ? backendHold.length : holdSignals.length}</p>
              <p className="text-sm text-muted-foreground">Theo dõi</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-primary/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <AlertTriangle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                {useBackend ? backendActions.filter(a => a.confidence >= 0.75).length : allSignals.filter(s => s.strength === 'strong').length}
              </p>
              <p className="text-sm text-muted-foreground">Tín hiệu mạnh</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signal List */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            Signal Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">Tất cả ({useBackend ? backendActions.length : allSignals.length})</TabsTrigger>
              <TabsTrigger value="buy" className="data-[state=active]:bg-success/20 data-[state=active]:text-success">
                <TrendingUp className="w-4 h-4 mr-1" /> Mua ({useBackend ? backendBuy.length : buySignals.length})
              </TabsTrigger>
              <TabsTrigger value="sell" className="data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive">
                <TrendingDown className="w-4 h-4 mr-1" /> Bán ({useBackend ? backendSell.length : sellSignals.length})
              </TabsTrigger>
              <TabsTrigger value="hold">Theo dõi ({useBackend ? backendHold.length : holdSignals.length})</TabsTrigger>
            </TabsList>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {useBackend ? (
                <>
                  {recommendationQuery.isLoading && (
                    <p className="text-center text-muted-foreground py-8">Đang tải khuyến nghị từ backend...</p>
                  )}
                  {recommendationQuery.isError && (
                    <p className="text-center text-destructive py-8">
                      Lỗi gọi backend. Hãy chạy API tại `http://localhost:8000` và thử lại.
                    </p>
                  )}
                  {!recommendationQuery.isLoading && !recommendationQuery.isError && displayActions.map((a) => (
                    <RecommendationCard key={`${a.symbol}-${a.action}`} item={a} />
                  ))}
                  {!recommendationQuery.isLoading && !recommendationQuery.isError && displayActions.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Không có khuyến nghị nào</p>
                  )}
                </>
              ) : (
                <>
                  {displaySignals.map((signal) => (
                    <SignalCard key={signal.ticker} signal={signal} />
                  ))}
                  {displaySignals.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Không có tín hiệu nào</p>
                  )}
                </>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
