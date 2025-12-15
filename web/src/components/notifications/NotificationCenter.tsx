import { useState, useEffect, useMemo } from 'react';
import { TICKERS, PRICE_DATA, NEWS_DATA } from '@/data/mockData';
import { generateSignal, Signal } from '@/services/signalService';
import { predictPrice } from '@/services/predictionService';
import { analyzeSentiment, aggregateSentiment } from '@/services/sentimentService';
import {
  Notification,
  createSignalNotification,
  addNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from '@/services/notificationService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TickerBadge } from '@/components/ui/ticker-badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  BellRing, 
  Check, 
  CheckCheck, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare,
  AlertCircle,
  X
} from 'lucide-react';

function NotificationItem({ notification, onMarkRead }: { notification: Notification; onMarkRead: () => void }) {
  const getIcon = () => {
    if (notification.type === 'signal') {
      if (notification.actionType === 'BUY') return <TrendingUp className="w-5 h-5 text-success" />;
      if (notification.actionType === 'SELL') return <TrendingDown className="w-5 h-5 text-destructive" />;
      return <AlertCircle className="w-5 h-5 text-warning" />;
    }
    if (notification.type === 'recommendation') return <MessageSquare className="w-5 h-5 text-primary" />;
    if (notification.type === 'summary') return <MessageSquare className="w-5 h-5 text-primary" />;
    return <AlertCircle className="w-5 h-5 text-warning" />;
  };

  const getPriorityColor = () => {
    if (notification.priority === 'high') return 'border-l-destructive';
    if (notification.priority === 'medium') return 'border-l-warning';
    return 'border-l-muted';
  };

  return (
    <div 
      className={`p-4 border-l-4 ${getPriorityColor()} ${
        notification.read ? 'bg-muted/20 opacity-70' : 'bg-muted/40'
      } rounded-r-lg transition-colors hover:bg-muted/50 cursor-pointer`}
      onClick={onMarkRead}
    >
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {notification.ticker && <TickerBadge ticker={notification.ticker} size="sm" />}
            <span className="font-medium text-sm">{notification.title}</span>
            {!notification.read && (
              <span className="w-2 h-2 bg-primary rounded-full" />
            )}
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{notification.message}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {notification.timestamp.toLocaleTimeString('vi-VN')}
            </span>
            {notification.actionLabel && (
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                {notification.actionLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Generate initial notifications from signals
  useEffect(() => {
    const signals: Signal[] = [];
    
    for (const ticker of TICKERS) {
      const prices = PRICE_DATA[ticker.symbol];
      if (!prices || prices.length < 10) continue;
      
      const prediction = predictPrice(prices);
      const relatedNews = NEWS_DATA.filter(n => n.ticker === ticker.symbol);
      const sentiments = relatedNews.map(n => analyzeSentiment(n.title + ' ' + n.content));
      const sentiment = sentiments.length > 0 ? aggregateSentiment(sentiments) : null;
      
      const signal = generateSignal(ticker.symbol, prices, prediction, sentiment);
      signals.push(signal);
    }

    // Create notifications for strong signals
    const strongSignals = signals.filter(s => s.strength === 'strong' || s.strength === 'moderate');
    
    for (const signal of strongSignals.slice(0, 5)) {
      const notification = createSignalNotification(signal);
      addNotification(notification);
    }

    setNotifications(getNotifications());
    setUnreadCount(getUnreadCount());
  }, []);

  const handleMarkRead = (id: string) => {
    markAsRead(id);
    setNotifications(getNotifications());
    setUnreadCount(getUnreadCount());
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
    setNotifications(getNotifications());
    setUnreadCount(getUnreadCount());
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? (
            <BellRing className="w-5 h-5 text-primary animate-pulse" />
          ) : (
            <Bell className="w-5 h-5" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Thông báo
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount} mới</Badge>
              )}
            </SheetTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                <CheckCheck className="w-4 h-4 mr-1" />
                Đọc tất cả
              </Button>
            )}
          </div>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          <div className="space-y-3 pr-4">
            {notifications.length > 0 ? (
              notifications.map(notification => (
                <NotificationItem 
                  key={notification.id} 
                  notification={notification}
                  onMarkRead={() => handleMarkRead(notification.id)}
                />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Không có thông báo nào</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
