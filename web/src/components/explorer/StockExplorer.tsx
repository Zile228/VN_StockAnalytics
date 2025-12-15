import { useState, useMemo } from 'react';
import { TICKERS, PRICE_DATA, NEWS_DATA, getLatestPrice } from '@/data/mockData';
import { predictPrice, PredictionResult } from '@/services/predictionService';
import { analyzeSentiment, SentimentResult } from '@/services/sentimentService';
import { PriceChart } from '@/components/charts/PriceChart';
import { CandlestickChart } from '@/components/charts/CandlestickChart';
import { StatCard } from '@/components/ui/stat-card';
import { TickerBadge } from '@/components/ui/ticker-badge';
import { SentimentBadge } from '@/components/ui/sentiment-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Target, Gauge, Brain, Newspaper } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { fetchStockFeatures, fetchStockHistory, fetchStockLatest, fetchStockList, fetchStockNews, fetchStockPrediction } from '@/services/stockExplorerService';

export function StockExplorer() {
  const [selectedTicker, setSelectedTicker] = useState('FPT');
  const [useBackend, setUseBackend] = useState(false);
  const [forecastSource, setForecastSource] = useState<'stub' | 'artifacts'>('stub');
  const [horizon, setHorizon] = useState(7);
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle');
  const [showLiquidity, setShowLiquidity] = useState(true);
  const [enableZoom, setEnableZoom] = useState(true);

  const stocksQuery = useQuery({
    queryKey: ['stocks'],
    queryFn: fetchStockList,
    enabled: useBackend,
    staleTime: 60_000,
  });

  const historyQuery = useQuery({
    queryKey: ['stock_history', selectedTicker],
    queryFn: () => fetchStockHistory({ symbol: selectedTicker, limit: 200 }),
    enabled: useBackend,
    staleTime: 30_000,
  });

  const latestQuery = useQuery({
    queryKey: ['stock_latest', selectedTicker],
    queryFn: () => fetchStockLatest(selectedTicker),
    enabled: useBackend,
    staleTime: 10_000,
  });

  const featuresQuery = useQuery({
    queryKey: ['stock_features', selectedTicker],
    queryFn: () => fetchStockFeatures(selectedTicker),
    enabled: useBackend,
    staleTime: 30_000,
  });

  const newsQuery = useQuery({
    queryKey: ['stock_news', selectedTicker],
    queryFn: () => fetchStockNews({ symbol: selectedTicker, lookbackDays: 30, limit: 20 }),
    enabled: useBackend,
    staleTime: 60_000,
  });

  const predictionQuery = useQuery({
    queryKey: ['stock_pred', selectedTicker, horizon, forecastSource],
    queryFn: () => fetchStockPrediction({ symbol: selectedTicker, horizonDays: horizon, forecastSource }),
    enabled: useBackend,
    staleTime: 30_000,
  });

  const tickerList = useBackend
    ? (stocksQuery.data?.symbols ?? []).map(s => ({ symbol: s.symbol, name: s.name ?? s.symbol, sector: s.sector ?? '' }))
    : TICKERS;

  const tickerInfo = tickerList.find(t => t.symbol === selectedTicker);

  const priceData = useBackend
    ? (historyQuery.data?.rows ?? [])
    : (PRICE_DATA[selectedTicker] || []);

  const latestPrice = useBackend
    ? latestQuery.data?.latest ?? null
    : getLatestPrice(selectedTicker);

  const previousPrice = priceData.length > 1 ? priceData[priceData.length - 2] : null;

  // Get prediction
  const prediction: PredictionResult | null = useMemo(() => {
    if (!priceData.length) return null;
    if (!useBackend) return predictPrice(priceData);

    const pred = predictionQuery.data?.prediction;
    const feats = featuresQuery.data?.features;
    if (!pred || !feats) return null;

    return {
      predictedReturn: pred.predictedReturn,
      predictedPrice: pred.predictedPrice,
      confidence: pred.confidence,
      direction: pred.direction,
      features: {
        return1d: feats.return1d,
        return3d: feats.return3d,
        ma5: feats.ma5,
        ma10: feats.ma10,
        volatility: feats.volatility,
        momentum: feats.momentum,
        rsi: feats.rsi,
      },
    };
  }, [useBackend, priceData, predictionQuery.data, featuresQuery.data]);

  // Get related news and sentiment
  const relatedNews = useBackend
    ? (newsQuery.data?.rows ?? []).map(n => ({
        date: n.published_at.slice(0, 10),
        ticker: selectedTicker,
        title: n.title,
        content: n.sapo,
        source: n.source,
        _sentiment_score: n.sentiment?.sentiment_score ?? null,
        _sentiment_relevance: n.sentiment?.relevance ?? null,
      }))
    : NEWS_DATA.filter(n => n.ticker === selectedTicker);

  const newsWithSentiment = relatedNews.map((news: any) => {
    if (!useBackend) {
      return {
        ...news,
        sentiment: analyzeSentiment(news.title + ' ' + news.content),
      };
    }
    // Backend sentiment_score is typically [-5..5], normalize to [-1..1] for badge style
    const raw = typeof news._sentiment_score === 'number' ? news._sentiment_score : 0;
    const score = Math.max(-1, Math.min(1, raw / 5));
    const label = score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral';
    return {
      ...news,
      sentiment: {
        score,
        label,
        confidence: typeof news._sentiment_relevance === 'number' ? news._sentiment_relevance : 0.5,
        positiveWords: [],
        negativeWords: [],
      } as SentimentResult,
    };
  });

  // Aggregate sentiment
  const aggregatedSentiment: SentimentResult | null = useMemo(() => {
    if (useBackend) {
      const s = newsQuery.data?.summary;
      if (!s) return null;
      const score = Math.max(-1, Math.min(1, s.avg_score / 5));
      return {
        score,
        label: score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral',
        confidence: Math.max(0, Math.min(1, s.avg_relevance)),
        positiveWords: [],
        negativeWords: [],
      };
    }
    if (newsWithSentiment.length > 0) {
      const sentiments = newsWithSentiment.map(n => n.sentiment);
      const avgScore = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;
      return {
        score: avgScore,
        label: avgScore > 0.2 ? 'positive' : avgScore < -0.2 ? 'negative' : 'neutral',
        confidence: sentiments.reduce((sum, s) => sum + s.confidence, 0) / sentiments.length,
        positiveWords: [...new Set(sentiments.flatMap(s => s.positiveWords))],
        negativeWords: [...new Set(sentiments.flatMap(s => s.negativeWords))],
      };
    }
    return null;
  }, [newsWithSentiment]);

  const priceChange = latestPrice && previousPrice
    ? (latestPrice.close - previousPrice.close) / previousPrice.close
    : 0;

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
          </div>
          <div className="grid grid-cols-2 md:flex md:items-center gap-2">
            <Input
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value || 7))}
              placeholder="horizon"
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

      {/* Ticker Selection */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Chọn mã cổ phiếu:</label>
          <Select value={selectedTicker} onValueChange={setSelectedTicker}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tickerList.map(ticker => (
                <SelectItem key={ticker.symbol} value={ticker.symbol}>
                  <span className="flex items-center gap-2">
                    <TickerBadge ticker={ticker.symbol} size="sm" />
                    {ticker.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tickerInfo && (
            <span className="text-sm text-muted-foreground">
              Ngành: {tickerInfo.sector}
            </span>
          )}
        </div>
      </div>

      {/* Price Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Giá hiện tại"
          value={latestPrice?.close.toFixed(2) || '-'}
          change={priceChange}
          icon={priceChange >= 0 ? TrendingUp : TrendingDown}
          valueClassName={priceChange >= 0 ? 'text-success' : 'text-destructive'}
        />
        <StatCard
          label="Giá dự báo"
          value={prediction?.predictedPrice.toFixed(2) || '-'}
          icon={Target}
          valueClassName="text-primary"
        />
        <StatCard
          label="Return dự báo"
          value={prediction ? `${(prediction.predictedReturn * 100).toFixed(2)}%` : '-'}
          icon={prediction?.direction === 'up' ? TrendingUp : TrendingDown}
          valueClassName={prediction?.direction === 'up' ? 'text-success' : prediction?.direction === 'down' ? 'text-destructive' : ''}
        />
        <StatCard
          label="Độ tin cậy"
          value={prediction ? `${(prediction.confidence * 100).toFixed(0)}%` : '-'}
          icon={Gauge}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price Chart */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-2">
              <TickerBadge ticker={selectedTicker} size="lg" />
              <h2 className="text-lg font-semibold">Biểu đồ giá</h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Chart</Label>
                <Select value={chartType} onValueChange={(v) => setChartType(v as any)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="candle">Nến</SelectItem>
                    <SelectItem value="line">Đường</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Liquidity</Label>
                <Switch checked={showLiquidity} onCheckedChange={setShowLiquidity} />
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Zoom</Label>
                <Switch checked={enableZoom} onCheckedChange={setEnableZoom} />
              </div>
            </div>
          </div>
          <div className="h-72">
            {chartType === 'candle' ? (
              <CandlestickChart data={priceData} showVolume={showLiquidity} enableZoom={enableZoom} />
            ) : (
              <PriceChart data={priceData} ticker={selectedTicker} showVolume={showLiquidity} enableZoom={enableZoom} />
            )}
          </div>
        </div>

        {/* ML Features */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">ML Features</h2>
          </div>
          {prediction && (
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Return 1D</span>
                <span className={`font-mono text-sm ${prediction.features.return1d >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {(prediction.features.return1d * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Return 3D</span>
                <span className={`font-mono text-sm ${prediction.features.return3d >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {(prediction.features.return3d * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">MA5</span>
                <span className="font-mono text-sm">{prediction.features.ma5.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">MA10</span>
                <span className="font-mono text-sm">{prediction.features.ma10.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Volatility</span>
                <span className="font-mono text-sm">{(prediction.features.volatility * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Momentum</span>
                <span className={`font-mono text-sm ${prediction.features.momentum >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {(prediction.features.momentum * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-muted-foreground">RSI</span>
                <span className={`font-mono text-sm ${
                  prediction.features.rsi > 70 ? 'text-destructive' : 
                  prediction.features.rsi < 30 ? 'text-success' : ''
                }`}>
                  {prediction.features.rsi.toFixed(1)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sentiment Analysis */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Phân tích Sentiment</h2>
          </div>
          {aggregatedSentiment && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tổng hợp:</span>
              <SentimentBadge 
                label={aggregatedSentiment.label} 
                score={aggregatedSentiment.score}
              />
            </div>
          )}
        </div>

        {newsWithSentiment.length > 0 ? (
          <div className="space-y-4">
            {newsWithSentiment.map((news, index) => (
              <div key={index} className="p-4 rounded-lg bg-muted/30 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{news.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{news.content}</p>
                  </div>
                  <SentimentBadge label={news.sentiment.label} />
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{news.date}</span>
                  <span>{news.source}</span>
                  {news.sentiment.positiveWords.length > 0 && (
                    <span className="text-success">
                      +: {news.sentiment.positiveWords.slice(0, 3).join(', ')}
                    </span>
                  )}
                  {news.sentiment.negativeWords.length > 0 && (
                    <span className="text-destructive">
                      -: {news.sentiment.negativeWords.slice(0, 3).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            Không có tin tức cho mã {selectedTicker}
          </p>
        )}
      </div>
    </div>
  );
}
