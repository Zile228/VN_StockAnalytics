import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SentimentBadgeProps {
  label: 'positive' | 'negative' | 'neutral';
  score?: number;
  showIcon?: boolean;
  className?: string;
}

export function SentimentBadge({ label, score, showIcon = true, className }: SentimentBadgeProps) {
  const config = {
    positive: {
      icon: TrendingUp,
      text: 'Tích cực',
      bgClass: 'bg-success/10',
      textClass: 'text-success',
    },
    negative: {
      icon: TrendingDown,
      text: 'Tiêu cực',
      bgClass: 'bg-destructive/10',
      textClass: 'text-destructive',
    },
    neutral: {
      icon: Minus,
      text: 'Trung lập',
      bgClass: 'bg-muted',
      textClass: 'text-muted-foreground',
    },
  };

  const { icon: Icon, text, bgClass, textClass } = config[label];

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium',
      bgClass,
      textClass,
      className
    )}>
      {showIcon && <Icon className="w-3 h-3" />}
      {text}
      {score !== undefined && (
        <span className="font-mono">({score.toFixed(2)})</span>
      )}
    </span>
  );
}
