import { useMemo, useState } from 'react';
import { TICKERS, PRICE_DATA, NEWS_DATA, getLatestPrice } from '@/data/mockData';
import { generateSignal, Signal } from '@/services/signalService';
import { predictPrice } from '@/services/predictionService';
import { analyzeSentiment, aggregateSentiment } from '@/services/sentimentService';
import { 
  Recommendation, 
  PortfolioHolding, 
  generateAllRecommendations, 
  generateDailySummary,
  DailySummary 
} from '@/services/advisoryService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TickerBadge } from '@/components/ui/ticker-badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Lightbulb,
  RefreshCw,
  Settings,
  ArrowRight
} from 'lucide-react';

// Mock portfolio holdings for demo
const MOCK_HOLDINGS: PortfolioHolding[] = [
  { ticker: 'FPT', shares: 500, avgCost: 95, currentPrice: 98.5, currentValue: 49250, profitLoss: 1750, profitLossPercent: 0.0368 },
  { ticker: 'VNM', shares: 300, avgCost: 78, currentPrice: 75.2, currentValue: 22560, profitLoss: -840, profitLossPercent: -0.0359 },
  { ticker: 'VCB', shares: 200, avgCost: 88, currentPrice: 92.3, currentValue: 18460, profitLoss: 860, profitLossPercent: 0.0489 },
];

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const getIcon = () => {
    if (rec.type === 'BUY' || rec.type === 'INCREASE') {
      return <TrendingUp className="w-5 h-5 text-success" />;
    }
    if (rec.type === 'SELL' || rec.type === 'DECREASE') {
      return <TrendingDown className="w-5 h-5 text-destructive" />;
    }
    return <AlertCircle className="w-5 h-5 text-warning" />;
  };

  const getPriorityColor = () => {
    if (rec.priority === 'high') return 'border-l-destructive';
    if (rec.priority === 'medium') return 'border-l-warning';
    return 'border-l-muted';
  };

  return (
    <Card className={`glass-card border-l-4 ${getPriorityColor()} hover:bg-muted/30 transition-colors`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getIcon()}
            <div>
              <div className="flex items-center gap-2">
                <TickerBadge ticker={rec.ticker} />
                <span className="font-semibold">{rec.action}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{rec.reason}</p>
              {rec.riskWarning && (
                <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {rec.riskWarning}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
              {rec.priority === 'high' ? 'Ưu tiên cao' : rec.priority === 'medium' ? 'Trung bình' : 'Thấp'}
            </Badge>
            <p className="text-sm mt-2">
              <span className="text-muted-foreground">Đề xuất: </span>
              <span className={`font-mono font-medium ${rec.suggestedPercent > 0 ? 'text-success' : 'text-destructive'}`}>
                {rec.suggestedPercent > 0 ? '+' : ''}{rec.suggestedPercent}%
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DailySummaryCard({ summary }: { summary: DailySummary }) {
  const getSentimentIcon = () => {
    if (summary.marketSentiment === 'bullish') return <TrendingUp className="w-5 h-5 text-success" />;
    if (summary.marketSentiment === 'bearish') return <TrendingDown className="w-5 h-5 text-destructive" />;
    return <AlertCircle className="w-5 h-5 text-warning" />;
  };

  return (
    <Card className="glass-card border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="w-5 h-5 text-primary" />
          Tổng kết hôm nay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {getSentimentIcon()}
          <span>Thị trường: </span>
          <Badge variant={summary.marketSentiment === 'bullish' ? 'default' : summary.marketSentiment === 'bearish' ? 'destructive' : 'secondary'}>
            {summary.marketSentiment === 'bullish' ? 'Tích cực' : summary.marketSentiment === 'bearish' ? 'Tiêu cực' : 'Trung lập'}
          </Badge>
        </div>

        {summary.rebalancingActions.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Đề xuất rebalancing:</p>
            <div className="space-y-1">
              {summary.rebalancingActions.map((action, i) => (
                <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/30">
                  <ArrowRight className="w-4 h-4 text-primary" />
                  {action}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 rounded-lg bg-success/10">
            <p className="text-lg font-bold text-success">{summary.buyRecommendations.length}</p>
            <p className="text-xs text-muted-foreground">Khuyến nghị mua</p>
          </div>
          <div className="p-2 rounded-lg bg-destructive/10">
            <p className="text-lg font-bold text-destructive">{summary.sellRecommendations.length}</p>
            <p className="text-xs text-muted-foreground">Khuyến nghị bán</p>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <p className="text-lg font-bold">{summary.holdRecommendations.length}</p>
            <p className="text-xs text-muted-foreground">Theo dõi</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdvisoryPanel() {
  const [takeProfitPercent, setTakeProfitPercent] = useState(15);
  const [stopLossPercent, setStopLossPercent] = useState(7);
  const [showSettings, setShowSettings] = useState(false);

  // Generate signals and recommendations
  const { signals, recommendations, summary } = useMemo(() => {
    const signals: Signal[] = [];
    
    for (const ticker of TICKERS) {
      const prices = PRICE_DATA[ticker.symbol];
      if (!prices || prices.length < 10) continue;
      
      const prediction = predictPrice(prices);
      const relatedNews = NEWS_DATA.filter(n => n.ticker === ticker.symbol);
      const sentiments = relatedNews.map(n => analyzeSentiment(n.title + ' ' + n.content));
      const sentiment = sentiments.length > 0 ? aggregateSentiment(sentiments) : null;
      
      const signal = generateSignal(ticker.symbol, prices, prediction, sentiment);
      signals.push(signal);
    }
    
    // Update mock holdings with current prices
    const holdings = MOCK_HOLDINGS.map(h => {
      const latestPrice = getLatestPrice(h.ticker);
      const currentPrice = latestPrice?.close || h.currentPrice;
      const currentValue = h.shares * currentPrice;
      const profitLoss = currentValue - (h.shares * h.avgCost);
      const profitLossPercent = profitLoss / (h.shares * h.avgCost);
      return { ...h, currentPrice, currentValue, profitLoss, profitLossPercent };
    });
    
    const recommendations = generateAllRecommendations(signals, holdings, {
      minExpectedReturn: 0.01,
      maxVolatility: 0.03,
      takeProfitPercent: takeProfitPercent / 100,
      stopLossPercent: -stopLossPercent / 100,
      maxPositionSize: 0.25,
    });
    
    const summary = generateDailySummary(signals, recommendations);
    
    return { signals, recommendations, summary };
  }, [takeProfitPercent, stopLossPercent]);

  const highPriorityRecs = recommendations.filter(r => r.priority === 'high');
  const otherRecs = recommendations.filter(r => r.priority !== 'high');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-primary" />
            Advisory Bot
          </h2>
          <p className="text-sm text-muted-foreground">
            Khuyến nghị giao dịch dựa trên ML + Sentiment + Technical
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
          <Settings className="w-4 h-4 mr-2" />
          Cài đặt
        </Button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <Card className="glass-card">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium">Take Profit: {takeProfitPercent}%</label>
                <Slider
                  value={[takeProfitPercent]}
                  onValueChange={([v]) => setTakeProfitPercent(v)}
                  min={5}
                  max={30}
                  step={1}
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Stop Loss: -{stopLossPercent}%</label>
                <Slider
                  value={[stopLossPercent]}
                  onValueChange={([v]) => setStopLossPercent(v)}
                  min={3}
                  max={15}
                  step={1}
                  className="mt-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Summary */}
        <div className="lg:col-span-1">
          <DailySummaryCard summary={summary} />

          {/* Current Holdings */}
          <Card className="glass-card mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Danh mục hiện tại</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {MOCK_HOLDINGS.map(h => (
                  <div key={h.ticker} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2">
                      <TickerBadge ticker={h.ticker} size="sm" />
                      <span className="text-sm">{h.shares} cp</span>
                    </div>
                    <span className={`text-sm font-mono ${h.profitLossPercent >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {h.profitLossPercent >= 0 ? '+' : ''}{(h.profitLossPercent * 100).toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recommendations */}
        <div className="lg:col-span-2 space-y-4">
          {highPriorityRecs.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                Ưu tiên cao ({highPriorityRecs.length})
              </h3>
              <div className="space-y-3">
                {highPriorityRecs.map((rec, i) => (
                  <RecommendationCard key={i} rec={rec} />
                ))}
              </div>
            </div>
          )}

          {otherRecs.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Khuyến nghị khác ({otherRecs.length})</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {otherRecs.map((rec, i) => (
                  <RecommendationCard key={i} rec={rec} />
                ))}
              </div>
            </div>
          )}

          {recommendations.length === 0 && (
            <Card className="glass-card">
              <CardContent className="p-8 text-center text-muted-foreground">
                <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Không có khuyến nghị nào vào lúc này.</p>
                <p className="text-sm">Thị trường đang ổn định.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
