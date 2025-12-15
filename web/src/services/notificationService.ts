// Notification Service - Manage app notifications

import { Signal } from './signalService';
import { Recommendation, DailySummary } from './advisoryService';

export type NotificationType = 'signal' | 'recommendation' | 'summary' | 'alert';
export type NotificationPriority = 'high' | 'medium' | 'low';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  ticker?: string;
  timestamp: Date;
  read: boolean;
  actionLabel?: string;
  actionType?: 'BUY' | 'SELL' | 'VIEW';
}

// Generate notification from signal
export function createSignalNotification(signal: Signal): Notification {
  const { ticker, type, strength, expectedReturn, technical, sentiment } = signal;
  
  let title = '';
  let message = '';
  let priority: NotificationPriority = 'medium';
  
  if (type === 'BUY') {
    title = `🚀 ${ticker} có tín hiệu tăng${strength === 'strong' ? ' mạnh' : ''}`;
    message = `RSI ${technical.rsi.toFixed(0)}${sentiment && sentiment.score > 0 ? ', sentiment tích cực' : ''}. Dự kiến ${expectedReturn >= 0 ? 'tăng' : 'giảm'} ${Math.abs(expectedReturn * 100).toFixed(2)}% trong 5 ngày. Nên MUA ${signal.suggestedAllocation}% danh mục.`;
    priority = strength === 'strong' ? 'high' : 'medium';
  } else if (type === 'SELL') {
    title = `⚠️ ${ticker} có tín hiệu xấu`;
    message = `ML dự báo ${(expectedReturn * 100).toFixed(2)}%${sentiment && sentiment.score < 0 ? ', sentiment tiêu cực' : ''}. Khuyến nghị BÁN.`;
    priority = strength === 'strong' ? 'high' : 'medium';
  } else {
    title = `📊 ${ticker} - Theo dõi`;
    message = `Không có tín hiệu rõ ràng. RSI: ${technical.rsi.toFixed(0)}, xu hướng: ${technical.trend}.`;
    priority = 'low';
  }
  
  return {
    id: `signal-${ticker}-${Date.now()}`,
    type: 'signal',
    priority,
    title,
    message,
    ticker,
    timestamp: new Date(),
    read: false,
    actionLabel: type === 'BUY' ? 'Xem chi tiết' : type === 'SELL' ? 'Xem danh mục' : undefined,
    actionType: type === 'HOLD' ? 'VIEW' : type,
  };
}

// Generate notification from recommendation
export function createRecommendationNotification(rec: Recommendation): Notification {
  return {
    id: `rec-${rec.ticker}-${Date.now()}`,
    type: 'recommendation',
    priority: rec.priority,
    title: rec.action,
    message: rec.reason + (rec.riskWarning ? ` ⚠️ ${rec.riskWarning}` : ''),
    ticker: rec.ticker,
    timestamp: rec.timestamp,
    read: false,
    actionLabel: rec.type === 'BUY' || rec.type === 'INCREASE' ? 'Mua ngay' : rec.type === 'SELL' || rec.type === 'DECREASE' ? 'Bán ngay' : undefined,
    actionType: rec.type === 'BUY' || rec.type === 'INCREASE' ? 'BUY' : rec.type === 'SELL' || rec.type === 'DECREASE' ? 'SELL' : 'VIEW',
  };
}

// Generate daily summary notification
export function createDailySummaryNotification(summary: DailySummary): Notification {
  const { marketSentiment, rebalancingActions, buyRecommendations, sellRecommendations } = summary;
  
  let title = '📋 Tổng kết giao dịch hôm nay';
  
  const parts: string[] = [];
  
  if (marketSentiment === 'bullish') {
    parts.push('Thị trường đang tích cực.');
  } else if (marketSentiment === 'bearish') {
    parts.push('Thị trường đang tiêu cực.');
  }
  
  if (rebalancingActions.length > 0) {
    parts.push(`Danh mục được đề xuất rebalancing:\n${rebalancingActions.slice(0, 3).join('\n')}`);
  } else {
    parts.push('Không có thay đổi danh mục được đề xuất.');
  }
  
  if (buyRecommendations.length > 0) {
    parts.push(`📈 ${buyRecommendations.length} cổ phiếu khuyến nghị mua`);
  }
  if (sellRecommendations.length > 0) {
    parts.push(`📉 ${sellRecommendations.length} cổ phiếu khuyến nghị bán`);
  }
  
  return {
    id: `summary-${Date.now()}`,
    type: 'summary',
    priority: rebalancingActions.length > 0 ? 'high' : 'medium',
    title,
    message: parts.join('\n'),
    timestamp: summary.date,
    read: false,
    actionLabel: 'Xem chi tiết',
    actionType: 'VIEW',
  };
}

// Create alert notification
export function createAlertNotification(
  title: string,
  message: string,
  priority: NotificationPriority = 'high',
  ticker?: string
): Notification {
  return {
    id: `alert-${Date.now()}`,
    type: 'alert',
    priority,
    title,
    message,
    ticker,
    timestamp: new Date(),
    read: false,
  };
}

// Notification store (in-memory for demo)
let notifications: Notification[] = [];

export function getNotifications(): Notification[] {
  return [...notifications].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function addNotification(notification: Notification): void {
  notifications = [notification, ...notifications].slice(0, 50); // Keep last 50
}

export function markAsRead(id: string): void {
  notifications = notifications.map(n => 
    n.id === id ? { ...n, read: true } : n
  );
}

export function markAllAsRead(): void {
  notifications = notifications.map(n => ({ ...n, read: true }));
}

export function clearNotifications(): void {
  notifications = [];
}

export function getUnreadCount(): number {
  return notifications.filter(n => !n.read).length;
}

// Format notification for email/telegram (text format)
export function formatNotificationText(notification: Notification): string {
  return `[${notification.priority.toUpperCase()}] ${notification.title}\n${notification.message}\n---\n${notification.timestamp.toLocaleString('vi-VN')}`;
}
