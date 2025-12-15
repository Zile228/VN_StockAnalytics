import { cn } from '@/lib/utils';

interface TickerBadgeProps {
  ticker: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TickerBadge({ ticker, className, size = 'md' }: TickerBadgeProps) {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span className={cn(
      'inline-flex items-center rounded bg-primary/10 text-primary font-mono font-semibold',
      sizeClasses[size],
      className
    )}>
      {ticker}
    </span>
  );
}
