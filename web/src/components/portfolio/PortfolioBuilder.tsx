import { useMemo, useState } from 'react';
import { TICKERS, PRICE_DATA } from '@/data/mockData';
import { 
  optimizePortfolio, 
  findMinVolatilityPortfolio,
  generateRandomPortfolios,
  OptimizedPortfolio,
  EfficientFrontierPoint,
} from '@/services/portfolioService';
import { optimizePortfolioApi } from '@/services/portfolioApiService';
import { PortfolioDonut } from '@/components/charts/PortfolioDonut';
import { ScatterPlot } from '@/components/charts/ScatterPlot';
import { StatCard } from '@/components/ui/stat-card';
import { TickerBadge } from '@/components/ui/ticker-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Briefcase, Zap, Shield, TrendingUp, Percent, BarChart3 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export function PortfolioBuilder() {
  const [selectedTickers, setSelectedTickers] = useState<string[]>(['VNM', 'FPT', 'VCB']);
  const [optimizedPortfolio, setOptimizedPortfolio] = useState<OptimizedPortfolio | null>(null);
  const [minVolPortfolio, setMinVolPortfolio] = useState<OptimizedPortfolio | null>(null);
  const [frontierPoints, setFrontierPoints] = useState<EfficientFrontierPoint[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [useBackend, setUseBackend] = useState(false);

  const toggleTicker = (ticker: string) => {
    setSelectedTickers(prev => 
      prev.includes(ticker)
        ? prev.filter(t => t !== ticker)
        : [...prev, ticker]
    );
    setOptimizedPortfolio(null);
    setMinVolPortfolio(null);
    setFrontierPoints([]);
  };

  const handleOptimize = async () => {
    if (selectedTickers.length < 2) return;
    
    setIsOptimizing(true);

    try {
      if (useBackend) {
        const resp = await optimizePortfolioApi({
          symbols: selectedTickers,
          lookbackDays: 252,
          nPortfolios: 500,
          seed: 42,
        });
        if (resp.error || !resp.max_sharpe || !resp.min_vol) {
          setIsOptimizing(false);
          return;
        }
        setOptimizedPortfolio({
          weights: resp.max_sharpe.weights,
          metrics: {
            expectedReturn: resp.max_sharpe.return,
            volatility: resp.max_sharpe.volatility,
            sharpeRatio: resp.max_sharpe.sharpeRatio,
          },
        });
        setMinVolPortfolio({
          weights: resp.min_vol.weights,
          metrics: {
            expectedReturn: resp.min_vol.return,
            volatility: resp.min_vol.volatility,
            sharpeRatio: resp.min_vol.sharpeRatio,
          },
        });
        setFrontierPoints(resp.frontier);
        setIsOptimizing(false);
        return;
      }

      const filteredPriceData: Record<string, typeof PRICE_DATA[string]> = {};
      for (const ticker of selectedTickers) {
        if (PRICE_DATA[ticker]) {
          filteredPriceData[ticker] = PRICE_DATA[ticker];
        }
      }

      const maxSharpe = optimizePortfolio(filteredPriceData);
      const minVol = findMinVolatilityPortfolio(filteredPriceData);
      const frontier = generateRandomPortfolios(filteredPriceData, 500);

      setOptimizedPortfolio(maxSharpe);
      setMinVolPortfolio(minVol);
      setFrontierPoints(frontier);
      setIsOptimizing(false);
    } catch {
      setIsOptimizing(false);
    }
  };

  const optimalFrontierPoint = useMemo(() => {
    if (!optimizedPortfolio) return undefined;
    return {
      volatility: optimizedPortfolio.metrics.volatility,
      return: optimizedPortfolio.metrics.expectedReturn,
      sharpeRatio: optimizedPortfolio.metrics.sharpeRatio,
      weights: optimizedPortfolio.weights,
    };
  }, [optimizedPortfolio]);

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
            {useBackend ? 'API /api/portfolio/optimize' : 'Mock (in-browser)'}
          </Badge>
        </div>
      </div>

      {/* Ticker Selection */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Chọn cổ phiếu cho danh mục</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {TICKERS.map(ticker => (
            <label
              key={ticker.symbol}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedTickers.includes(ticker.symbol)
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <Checkbox
                checked={selectedTickers.includes(ticker.symbol)}
                onCheckedChange={() => toggleTicker(ticker.symbol)}
              />
              <div>
                <TickerBadge ticker={ticker.symbol} size="sm" />
                <p className="text-xs text-muted-foreground mt-1">{ticker.name}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <Button 
            onClick={handleOptimize}
            disabled={selectedTickers.length < 2 || isOptimizing}
            className="gap-2"
          >
            <Zap className="w-4 h-4" />
            {isOptimizing ? 'Đang tối ưu...' : 'Tối ưu danh mục'}
          </Button>
          <span className="text-sm text-muted-foreground">
            Đã chọn {selectedTickers.length} mã (tối thiểu 2)
          </span>
        </div>
      </div>

      {/* Results */}
      {optimizedPortfolio && (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Max Sharpe Portfolio */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Danh mục Sharpe tối ưu</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <StatCard
                  label="Lợi nhuận kỳ vọng"
                  value={`${(optimizedPortfolio.metrics.expectedReturn * 100).toFixed(1)}%`}
                  icon={TrendingUp}
                  valueClassName="text-success"
                />
                <StatCard
                  label="Biến động"
                  value={`${(optimizedPortfolio.metrics.volatility * 100).toFixed(1)}%`}
                  icon={BarChart3}
                />
                <StatCard
                  label="Sharpe Ratio"
                  value={optimizedPortfolio.metrics.sharpeRatio.toFixed(2)}
                  icon={Percent}
                  valueClassName="text-primary"
                />
              </div>
              <div className="h-64">
                <PortfolioDonut weights={optimizedPortfolio.weights} />
              </div>
            </div>

            {/* Min Volatility Portfolio */}
            {minVolPortfolio && (
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-success" />
                  <h3 className="font-semibold">Danh mục rủi ro thấp nhất</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <StatCard
                    label="Lợi nhuận kỳ vọng"
                    value={`${(minVolPortfolio.metrics.expectedReturn * 100).toFixed(1)}%`}
                    icon={TrendingUp}
                    valueClassName="text-success"
                  />
                  <StatCard
                    label="Biến động"
                    value={`${(minVolPortfolio.metrics.volatility * 100).toFixed(1)}%`}
                    icon={BarChart3}
                  />
                  <StatCard
                    label="Sharpe Ratio"
                    value={minVolPortfolio.metrics.sharpeRatio.toFixed(2)}
                    icon={Percent}
                    valueClassName="text-primary"
                  />
                </div>
                <div className="h-64">
                  <PortfolioDonut weights={minVolPortfolio.weights} />
                </div>
              </div>
            )}
          </div>

          {/* Efficient Frontier */}
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4">Efficient Frontier (Monte Carlo Simulation)</h3>
            <div className="h-80">
              <ScatterPlot data={frontierPoints} optimalPoint={optimalFrontierPoint} />
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Mỗi điểm đại diện cho một danh mục ngẫu nhiên. Điểm ⭐ là danh mục có Sharpe Ratio cao nhất.
            </p>
          </div>

          {/* Weights Table */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold">Chi tiết tỷ trọng</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã CK</th>
                    <th>Tên</th>
                    <th className="text-right">Tỷ trọng (Max Sharpe)</th>
                    <th className="text-right">Tỷ trọng (Min Vol)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTickers.map(ticker => {
                    const info = TICKERS.find(t => t.symbol === ticker);
                    const maxSharpeWeight = optimizedPortfolio.weights[ticker] || 0;
                    const minVolWeight = minVolPortfolio?.weights[ticker] || 0;
                    
                    return (
                      <tr key={ticker}>
                        <td><TickerBadge ticker={ticker} /></td>
                        <td className="font-sans">{info?.name}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${maxSharpeWeight * 100}%` }}
                              />
                            </div>
                            <span>{(maxSharpeWeight * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-success rounded-full"
                                style={{ width: `${minVolWeight * 100}%` }}
                              />
                            </div>
                            <span>{(minVolWeight * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!optimizedPortfolio && !isOptimizing && (
        <div className="glass-card p-12 text-center">
          <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Bắt đầu xây dựng danh mục</h3>
          <p className="text-muted-foreground">
            Chọn ít nhất 2 mã cổ phiếu và nhấn "Tối ưu danh mục" để xem kết quả phân bổ tối ưu theo Markowitz.
          </p>
        </div>
      )}
    </div>
  );
}
