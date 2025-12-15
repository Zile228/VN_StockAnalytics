import { TrendingUp, Activity } from 'lucide-react';
import { VNINDEX_DATA } from '@/data/mockData';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

export function Header() {
  const latestVNIndex = VNINDEX_DATA[VNINDEX_DATA.length - 1];
  const previousVNIndex = VNINDEX_DATA[VNINDEX_DATA.length - 2];
  const change = latestVNIndex.close - previousVNIndex.close;
  const changePercent = (change / previousVNIndex.close) * 100;
  const isPositive = change >= 0;

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text">VN Stock Analytics</h1>
            <p className="text-xs text-muted-foreground">Demo MVP</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">VNINDEX</span>
            <span className="font-mono font-semibold">{latestVNIndex.close.toFixed(2)}</span>
            <span className={`font-mono text-sm ${isPositive ? 'text-success' : 'text-destructive'}`}>
              {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
            </span>
          </div>
          
          <div className="text-sm text-muted-foreground font-mono">
            {new Date().toLocaleDateString('vi-VN')}
          </div>

          <NotificationCenter />
        </div>
      </div>
    </header>
  );
}
