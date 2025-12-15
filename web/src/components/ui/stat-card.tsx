import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: LucideIcon;
  className?: string;
  valueClassName?: string;
}

export function StatCard({ 
  label, 
  value, 
  change, 
  icon: Icon,
  className,
  valueClassName,
}: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className={cn('stat-card', className)}>
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="flex items-end gap-2">
        <span className={cn('stat-value', valueClassName)}>{value}</span>
        {change !== undefined && (
          <span className={cn(
            'text-sm font-mono font-medium pb-1',
            isPositive ? 'text-success' : 'text-destructive'
          )}>
            {isPositive ? '+' : ''}{(change * 100).toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  );
}
