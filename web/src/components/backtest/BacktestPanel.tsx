import { useMemo, useState } from 'react';
import { TICKERS, PRICE_DATA, VNINDEX_DATA } from '@/data/mockData';
import { runBacktest, compareToBenchmark, BacktestResult } from '@/services/backtestService';
import { optimizePortfolio } from '@/services/portfolioService';
import { optimizePortfolioApi } from '@/services/portfolioApiService';
import { runBacktestApi } from '@/services/backtestApiService';
import { fetchStockHistory } from '@/services/stockExplorerService';
import { EquityCurve } from '@/components/charts/EquityCurve';
import { StatCard } from '@/components/ui/stat-card';
import { TickerBadge } from '@/components/ui/ticker-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  LineChart, 
  Play, 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  BarChart3,
  Calendar,
  DollarSign,
} from 'lucide-react';

export function BacktestPanel() {
  const [selectedTickers, setSelectedTickers] = useState<string[]>(['VNM', 'FPT', 'VCB']);
  const [rebalancePeriod, setRebalancePeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [initialCapital, setInitialCapital] = useState(100000000);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [comparisonData, setComparisonData] = useState<{ date: string; portfolio: number; benchmark: number }[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [useBackend, setUseBackend] = useState(false);

  const toggleTicker = (ticker: string) => {
    setSelectedTickers(prev => 
      prev.includes(ticker)
        ? prev.filter(t => t !== ticker)
        : [...prev, ticker]
    );
    setBacktestResult(null);
  };

  const handleRunBacktest = async () => {
    if (selectedTickers.length < 1) return;
    
    setIsRunning(true);

    try {
      if (useBackend) {
        // derive a realistic recent window from backend history (avoid hardcoded 2024-11)
        const sym0 = selectedTickers[0];
        const hist = await fetchStockHistory({ symbol: sym0, limit: 120 });
        const rows = hist.rows;
        const start = rows.length ? rows[Math.max(0, rows.length - 60)].date : undefined;
        const end = rows.length ? rows[rows.length - 1].date : undefined;

        const opt = await optimizePortfolioApi({
          symbols: selectedTickers,
          lookbackDays: 252,
          nPortfolios: 800,
          seed: 42,
        });
        if (opt.error || !opt.max_sharpe) {
          setIsRunning(false);
          return;
        }

        const bt = await runBacktestApi({
          symbols: selectedTickers,
          weights: opt.max_sharpe.weights,
          start,
          end,
          initialCapital,
          rebalancePeriod,
        });

        if (bt.error || !bt.metrics) {
          setIsRunning(false);
          return;
        }

        // Adapt backend response to the UI's existing BacktestResult type shape
        const result: BacktestResult = {
          equityCurve: bt.equityCurve.map(r => ({ date: r.date, value: r.value })),
          metrics: {
            totalReturn: bt.metrics.totalReturn,
            annualizedReturn: bt.metrics.annualizedReturn,
            volatility: bt.metrics.volatility,
            sharpeRatio: bt.metrics.sharpeRatio,
            maxDrawdown: bt.metrics.maxDrawdown,
            winRate: bt.metrics.winRate,
            totalTrades: bt.metrics.totalTrades,
          },
          trades: (bt.trades ?? []).map(t => ({
            date: t.date,
            ticker: t.ticker,
            action: t.action,
            shares: t.shares,
            price: t.price,
            value: t.value,
          })),
        } as any;

        setBacktestResult(result);
        setComparisonData((bt.comparison ?? []).map(r => ({ date: r.date, portfolio: r.portfolio, benchmark: r.benchmark })));
        setIsRunning(false);
        return;
      }

      const filteredPriceData: Record<string, typeof PRICE_DATA[string]> = {};
      for (const ticker of selectedTickers) {
        if (PRICE_DATA[ticker]) {
          filteredPriceData[ticker] = PRICE_DATA[ticker];
        }
      }

      const optimized = optimizePortfolio(filteredPriceData);
      
      const result = runBacktest({
        tickers: selectedTickers,
        weights: optimized.weights,
        startDate: '2024-11-01',
        endDate: '2024-11-30',
        initialCapital,
        rebalancePeriod,
      });

      const comparison = compareToBenchmark(result, VNINDEX_DATA, initialCapital);
      setBacktestResult(result);
      setComparisonData(comparison);
      setIsRunning(false);
    } catch {
      setIsRunning(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Mode Switch */}
      <div className="flex items-center justify-between glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={useBackend} onCheckedChange={setUseBackend} />
            <Label className="text-sm">Backend mode</Label>
          </div>
          <Badge variant="outline" className="text-xs">
            {useBackend ? 'API /api/portfolio/optimize + /api/backtest/run' : 'Mock (in-browser)'}
          </Badge>
        </div>
      </div>

      {/* Configuration */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <LineChart className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Cấu hình Backtest</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ticker Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Chọn cổ phiếu</label>
            <div className="grid grid-cols-2 gap-2">
              {TICKERS.map(ticker => (
                <label
                  key={ticker.symbol}
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all text-sm ${
                    selectedTickers.includes(ticker.symbol)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <Checkbox
                    checked={selectedTickers.includes(ticker.symbol)}
                    onCheckedChange={() => toggleTicker(ticker.symbol)}
                  />
                  <TickerBadge ticker={ticker.symbol} size="sm" />
                </label>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Vốn ban đầu
              </label>
              <Input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(initialCapital)}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Chu kỳ tái cân bằng
              </label>
              <Select value={rebalancePeriod} onValueChange={(v: 'daily' | 'weekly' | 'monthly') => setRebalancePeriod(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Hàng ngày</SelectItem>
                  <SelectItem value="weekly">Hàng tuần</SelectItem>
                  <SelectItem value="monthly">Hàng tháng</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button
            onClick={handleRunBacktest}
            disabled={selectedTickers.length < 1 || isRunning}
            className="gap-2"
          >
            <Play className="w-4 h-4" />
            {isRunning ? 'Đang chạy...' : 'Chạy Backtest'}
          </Button>
        </div>
      </div>

      {/* Results */}
      {backtestResult && (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Tổng lợi nhuận"
              value={`${(backtestResult.metrics.totalReturn * 100).toFixed(2)}%`}
              icon={backtestResult.metrics.totalReturn >= 0 ? TrendingUp : TrendingDown}
              valueClassName={backtestResult.metrics.totalReturn >= 0 ? 'text-success' : 'text-destructive'}
            />
            <StatCard
              label="Lợi nhuận hàng năm"
              value={`${(backtestResult.metrics.annualizedReturn * 100).toFixed(2)}%`}
              icon={TrendingUp}
              valueClassName={backtestResult.metrics.annualizedReturn >= 0 ? 'text-success' : 'text-destructive'}
            />
            <StatCard
              label="Sharpe Ratio"
              value={backtestResult.metrics.sharpeRatio.toFixed(2)}
              icon={Percent}
              valueClassName="text-primary"
            />
            <StatCard
              label="Max Drawdown"
              value={`${(backtestResult.metrics.maxDrawdown * 100).toFixed(2)}%`}
              icon={TrendingDown}
              valueClassName="text-destructive"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Biến động"
              value={`${(backtestResult.metrics.volatility * 100).toFixed(2)}%`}
              icon={BarChart3}
            />
            <StatCard
              label="Tỷ lệ thắng"
              value={`${(backtestResult.metrics.winRate * 100).toFixed(1)}%`}
              icon={Percent}
              valueClassName={backtestResult.metrics.winRate >= 0.5 ? 'text-success' : 'text-destructive'}
            />
            <StatCard
              label="Số giao dịch"
              value={backtestResult.metrics.totalTrades}
              icon={LineChart}
            />
            <StatCard
              label="Giá trị cuối kỳ"
              value={formatCurrency(backtestResult.equityCurve[backtestResult.equityCurve.length - 1]?.value || 0)}
              icon={DollarSign}
              valueClassName="text-primary"
            />
          </div>

          {/* Equity Curve */}
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4">Đường cong lợi nhuận so với VNINDEX</h3>
            <div className="h-80">
              <EquityCurve data={comparisonData} />
            </div>
          </div>

          {/* Trade Log */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold">Lịch sử giao dịch</h3>
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="data-table">
                <thead className="sticky top-0 bg-card">
                  <tr>
                    <th>Ngày</th>
                    <th>Mã CK</th>
                    <th>Loại</th>
                    <th className="text-right">Số lượng</th>
                    <th className="text-right">Giá</th>
                    <th className="text-right">Giá trị</th>
                  </tr>
                </thead>
                <tbody>
                  {backtestResult.trades.slice(0, 20).map((trade, index) => (
                    <tr key={index}>
                      <td>{trade.date}</td>
                      <td><TickerBadge ticker={trade.ticker} size="sm" /></td>
                      <td>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          trade.action === 'buy' ? 'bg-success/10 text-success' :
                          trade.action === 'sell' ? 'bg-destructive/10 text-destructive' :
                          'bg-warning/10 text-warning'
                        }`}>
                          {trade.action === 'buy' ? 'Mua' : trade.action === 'sell' ? 'Bán' : 'Cân bằng'}
                        </span>
                      </td>
                      <td className="text-right">{trade.shares.toFixed(2)}</td>
                      <td className="text-right">{trade.price.toFixed(2)}</td>
                      <td className="text-right">{formatCurrency(trade.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!backtestResult && !isRunning && (
        <div className="glass-card p-12 text-center">
          <LineChart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Chưa có kết quả</h3>
          <p className="text-muted-foreground">
            Cấu hình danh mục và nhấn "Chạy Backtest" để xem hiệu suất mô phỏng.
          </p>
        </div>
      )}
    </div>
  );
}
