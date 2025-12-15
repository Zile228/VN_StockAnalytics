import { useMemo, useState } from 'react';
import { VNINDEX_DATA, PRICE_DATA, TICKERS } from '@/data/mockData';
import { PriceChart } from '@/components/charts/PriceChart';
import { StatCard } from '@/components/ui/stat-card';
import { TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardOverview } from '@/services/dashboardService';

export function MarketOverview() {
  const [useBackend, setUseBackend] = useState(false);

  const dashQuery = useQuery({
    queryKey: ['dashboard_overview'],
    queryFn: () => fetchDashboardOverview({ limit: 90 }),
    enabled: useBackend,
    staleTime: 30_000,
  });

  const view = useMemo(() => {
    if (!useBackend) {
      const latestVNIndex = VNINDEX_DATA[VNINDEX_DATA.length - 1];
      const previousVNIndex = VNINDEX_DATA[VNINDEX_DATA.length - 2];
      const vnindexChange = (latestVNIndex.close - previousVNIndex.close) / previousVNIndex.close;

      const tickerStats = TICKERS.map(ticker => {
        const prices = PRICE_DATA[ticker.symbol];
        const latest = prices[prices.length - 1];
        const previous = prices[prices.length - 2];
        const change = (latest.close - previous.close) / previous.close;
        return { ...ticker, price: latest.close, change, volume: latest.volume };
      });

      return {
        label: 'VNINDEX',
        indexData: VNINDEX_DATA,
        indexLatest: latestVNIndex.close,
        indexChange: vnindexChange,
        gainers: tickerStats.filter(t => t.change > 0).length,
        losers: tickerStats.filter(t => t.change < 0).length,
        totalVolume: tickerStats.reduce((sum, t) => sum + t.volume, 0),
        rows: tickerStats.map(t => ({
          symbol: t.symbol,
          name: t.name,
          sector: t.sector,
          close: t.price,
          change: t.change,
          volume: t.volume,
        })),
      };
    }

    const d = dashQuery.data;
    const idx = (d?.index_series ?? []).map(r => ({ date: r.date, close: r.close, volume: r.volume }));
    const latest = idx.length ? idx[idx.length - 1] : null;
    const prev = idx.length >= 2 ? idx[idx.length - 2] : null;
    const change = latest && prev && prev.close ? (latest.close - prev.close) / prev.close : 0;
    return {
      label: 'VN30 (proxy)',
      indexData: idx,
      indexLatest: latest?.close ?? 0,
      indexChange: change,
      gainers: d?.breadth.gainers ?? 0,
      losers: d?.breadth.losers ?? 0,
      totalVolume: d?.total_volume ?? 0,
      rows: (d?.rows ?? []).map(r => ({
        symbol: r.symbol,
        name: r.name ?? r.symbol,
        sector: r.sector ?? '',
        close: r.close,
        change: r.change,
        volume: r.volume,
      })),
    };
  }, [useBackend, dashQuery.data]);

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
            {useBackend ? 'API /api/dashboard/overview' : 'Mock (in-browser)'}
          </Badge>
        </div>
        {useBackend && dashQuery.isFetching && (
          <span className="text-xs text-muted-foreground">Đang tải...</span>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label={view.label}
          value={view.indexLatest ? view.indexLatest.toFixed(2) : '-'}
          change={view.indexChange}
          icon={Activity}
          valueClassName="text-primary"
        />
        <StatCard
          label="Tăng giá"
          value={view.gainers}
          icon={TrendingUp}
          valueClassName="text-success"
        />
        <StatCard
          label="Giảm giá"
          value={view.losers}
          icon={TrendingDown}
          valueClassName="text-destructive"
        />
        <StatCard
          label="Tổng KLGD"
          value={`${(view.totalVolume / 1000000).toFixed(1)}M`}
          icon={BarChart3}
        />
      </div>

      {/* Main Chart */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">Biểu đồ {view.label}</h2>
        <div className="h-80">
          <PriceChart data={view.indexData as any} ticker={view.label} showVolume enableZoom />
        </div>
      </div>

      {/* Stock Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Danh sách cổ phiếu</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã CK</th>
                <th>Tên</th>
                <th>Ngành</th>
                <th className="text-right">Giá</th>
                <th className="text-right">Thay đổi</th>
                <th className="text-right">KLGD</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map(ticker => (
                <tr key={ticker.symbol} className="hover:bg-muted/30 transition-colors">
                  <td>
                    <span className="ticker-badge">{ticker.symbol}</span>
                  </td>
                  <td className="font-sans">{ticker.name}</td>
                  <td className="text-muted-foreground font-sans">{ticker.sector}</td>
                  <td className="text-right">{ticker.close.toFixed(2)}</td>
                  <td className={`text-right ${ticker.change >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {ticker.change >= 0 ? '+' : ''}{(ticker.change * 100).toFixed(2)}%
                  </td>
                  <td className="text-right text-muted-foreground">
                    {(ticker.volume / 1000000).toFixed(2)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
