import { cn } from '@/lib/utils';
import { LayoutDashboard, Search, Briefcase, LineChart, Bell, TrendingUp, Zap, BookOpen } from 'lucide-react';

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'explorer', label: 'Stock Explorer', icon: Search },
  { id: 'portfolio', label: 'Portfolio Builder', icon: Briefcase },
  { id: 'backtest', label: 'Backtest', icon: LineChart },
  { id: 'signals', label: 'Signals', icon: Zap },
  { id: 'advisory', label: 'Advisory', icon: TrendingUp },
  { id: 'simulation', label: 'Simulation', icon: Bell },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative',
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
