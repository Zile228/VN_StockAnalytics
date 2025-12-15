import { useState, useMemo } from 'react';
import { TICKERS } from '@/data/mockData';
import { runSimulation, formatVND, formatPercent, SimulationResult } from '@/services/simulationService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EquityCurve } from '@/components/charts/EquityCurve';
import { TickerBadge } from '@/components/ui/ticker-badge';
import { 
  Play, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target,
  AlertTriangle,
  BarChart3,
  Calendar,
  Wallet,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export function SimulationPanel() {
  const [initialCapital, setInitialCapital] = useState(100_000_000);
  const [selectedTickers, setSelectedTickers] = useState<string[]>(['FPT', 'VNM', 'VCB']);
  const [rebalanceFrequency, setRebalanceFrequency] = useState<'daily' | 'weekly'>('weekly');
  const [takeProfitPercent, setTakeProfitPercent] = useState(15);
  const [stopLossPercent, setStopLossPercent] = useState(7);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const toggleTicker = (ticker: string) => {
    setSelectedTickers(prev => 
      prev.includes(ticker) 
        ? prev.filter(t => t !== ticker)
        : [...prev, ticker]
    );
  };

  const runSim = () => {
    if (selectedTickers.length === 0) return;
    
    setIsRunning(true);
    
    // Simulate async operation
    setTimeout(() => {
      const simResult = runSimulation(selectedTickers, {
        initialCapital,
        rebalanceFrequency,
        takeProfitPercent: takeProfitPercent / 100,
        stopLossPercent: -stopLossPercent / 100,
      });
      
      setResult(simResult);
      setIsRunning(false);
    }, 500);
  };

  // Convert daily snapshots to equity curve format
  const equityCurveData = useMemo(() => {
    if (!result) return [];
    
    return result.dailySnapshots.map(snapshot => ({
      date: snapshot.date.toISOString().split('T')[0],
      portfolio: snapshot.totalValue,
      benchmark: snapshot.benchmarkValue * (initialCapital / (result.dailySnapshots[0]?.benchmarkValue || 1200)),
    }));
  }, [result, initialCapital]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Configuration */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Cấu hình mô phỏng
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Capital Input */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="capital">Vốn ban đầu (VND)</Label>
              <Input
                id="capital"
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">{formatVND(initialCapital)}</p>
            </div>
            <div>
              <Label>Tần suất rebalance</Label>
              <Select value={rebalanceFrequency} onValueChange={(v: 'daily' | 'weekly') => setRebalanceFrequency(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Hàng ngày</SelectItem>
                  <SelectItem value="weekly">Hàng tuần</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Take Profit (%)</Label>
                <Input
                  type="number"
                  value={takeProfitPercent}
                  onChange={(e) => setTakeProfitPercent(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Stop Loss (%)</Label>
                <Input
                  type="number"
                  value={stopLossPercent}
                  onChange={(e) => setStopLossPercent(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Ticker Selection */}
          <div>
            <Label>Chọn cổ phiếu</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {TICKERS.map(ticker => (
                <div 
                  key={ticker.symbol}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    selectedTickers.includes(ticker.symbol) 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => toggleTicker(ticker.symbol)}
                >
                  <Checkbox 
                    checked={selectedTickers.includes(ticker.symbol)}
                    onChange={() => {}}
                  />
                  <TickerBadge ticker={ticker.symbol} size="sm" />
                  <span className="text-sm">{ticker.name}</span>
                </div>
              ))}
            </div>
          </div>

          <Button 
            onClick={runSim} 
            disabled={isRunning || selectedTickers.length === 0}
            className="w-full"
          >
            <Play className="w-4 h-4 mr-2" />
            {isRunning ? 'Đang chạy mô phỏng...' : 'Chạy mô phỏng'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary Banner */}
          <Card className={`glass-card ${result.totalReturn >= 0 ? 'border-success/50' : 'border-destructive/50'}`}>
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <p className="text-lg text-muted-foreground">Kết quả mô phỏng</p>
                <p className="text-4xl font-bold mt-2">
                  {formatVND(result.finalCapital)}
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  {result.totalReturn >= 0 ? (
                    <ArrowUpRight className="w-6 h-6 text-success" />
                  ) : (
                    <ArrowDownRight className="w-6 h-6 text-destructive" />
                  )}
                  <span className={`text-2xl font-bold ${result.totalReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatPercent(result.totalReturn)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">VN-Index</p>
                  <p className={`text-lg font-mono font-bold ${result.benchmarkReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatPercent(result.benchmarkReturn)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <p className="text-sm text-muted-foreground">Alpha</p>
                  <p className={`text-lg font-mono font-bold ${result.excessReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatPercent(result.excessReturn)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">Max Drawdown</p>
                  <p className="text-lg font-mono font-bold text-destructive">
                    -{(result.maxDrawdown * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                  <p className="text-lg font-mono font-bold">{result.sharpeRatio.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="glass-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{result.totalTrades}</p>
                  <p className="text-xs text-muted-foreground">Tổng giao dịch</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/20">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">{result.winRate}%</p>
                  <p className="text-xs text-muted-foreground">Tỷ lệ thắng</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/20">
                  <Calendar className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatPercent(result.annualizedReturn)}</p>
                  <p className="text-xs text-muted-foreground">Return hàng năm</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{result.profitableTrades}</p>
                  <p className="text-xs text-muted-foreground">Giao dịch có lời</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Equity Curve */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Đường cong vốn
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <EquityCurve data={equityCurveData} />
              </div>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Lịch sử giao dịch ({result.transactions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-border">
                      <th className="text-left py-2">Ngày</th>
                      <th className="text-left py-2">Mã</th>
                      <th className="text-left py-2">Loại</th>
                      <th className="text-right py-2">Số lượng</th>
                      <th className="text-right py-2">Giá</th>
                      <th className="text-right py-2">Giá trị</th>
                      <th className="text-left py-2">Lý do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.transactions.slice(0, 50).map((tx, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 font-mono text-xs">
                          {tx.date.toLocaleDateString('vi-VN')}
                        </td>
                        <td className="py-2">
                          <TickerBadge ticker={tx.ticker} size="sm" />
                        </td>
                        <td className="py-2">
                          <Badge variant={tx.type === 'BUY' ? 'default' : 'destructive'}>
                            {tx.type === 'BUY' ? 'MUA' : 'BÁN'}
                          </Badge>
                        </td>
                        <td className="py-2 text-right font-mono">{tx.shares}</td>
                        <td className="py-2 text-right font-mono">{tx.price.toFixed(2)}</td>
                        <td className="py-2 text-right font-mono">{formatVND(tx.value)}</td>
                        <td className="py-2 text-xs text-muted-foreground max-w-[200px] truncate">
                          {tx.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.transactions.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    Hiển thị 50/{result.transactions.length} giao dịch
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
