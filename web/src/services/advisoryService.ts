// Advisory Layer - Generate trading recommendations

import { Signal, SignalType } from './signalService';

export type RecommendationType = 'BUY' | 'SELL' | 'HOLD' | 'INCREASE' | 'DECREASE';

export interface Recommendation {
  ticker: string;
  type: RecommendationType;
  action: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  suggestedPercent: number;
  expectedReturn: number;
  riskWarning?: string;
  timestamp: Date;
}

export interface PortfolioHolding {
  ticker: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface AdvisoryConfig {
  minExpectedReturn: number; // e.g., 0.01 for 1%
  maxVolatility: number;
  takeProfitPercent: number; // e.g., 0.15 for 15%
  stopLossPercent: number; // e.g., -0.07 for -7%
  maxPositionSize: number; // e.g., 0.25 for 25%
}

const DEFAULT_CONFIG: AdvisoryConfig = {
  minExpectedReturn: 0.01,
  maxVolatility: 0.03,
  takeProfitPercent: 0.15,
  stopLossPercent: -0.07,
  maxPositionSize: 0.25,
};

// Generate recommendation for a single signal
export function generateRecommendation(
  signal: Signal,
  holding?: PortfolioHolding,
  config: AdvisoryConfig = DEFAULT_CONFIG
): Recommendation | null {
  const { ticker, type, strength, expectedReturn, technical, sentiment, riskLevel } = signal;
  
  // Check for take-profit / stop-loss if holding exists
  if (holding) {
    if (holding.profitLossPercent >= config.takeProfitPercent) {
      return {
        ticker,
        type: 'SELL',
        action: `Chốt lời ${ticker}`,
        reason: `Đạt mục tiêu lợi nhuận ${(holding.profitLossPercent * 100).toFixed(1)}% (target: ${(config.takeProfitPercent * 100).toFixed(0)}%)`,
        priority: 'high',
        suggestedPercent: -100, // Sell all
        expectedReturn: holding.profitLossPercent,
        timestamp: new Date(),
      };
    }
    
    if (holding.profitLossPercent <= config.stopLossPercent) {
      return {
        ticker,
        type: 'SELL',
        action: `Cắt lỗ ${ticker}`,
        reason: `Chạm ngưỡng cắt lỗ ${(holding.profitLossPercent * 100).toFixed(1)}% (limit: ${(config.stopLossPercent * 100).toFixed(0)}%)`,
        priority: 'high',
        suggestedPercent: -100,
        expectedReturn: holding.profitLossPercent,
        riskWarning: 'Cần cắt lỗ ngay để bảo toàn vốn',
        timestamp: new Date(),
      };
    }
  }
  
  // Buy recommendation
  if (type === 'BUY' && expectedReturn > config.minExpectedReturn) {
    if (technical.volatility > config.maxVolatility) {
      return {
        ticker,
        type: 'HOLD',
        action: `Theo dõi ${ticker}`,
        reason: `Tín hiệu tốt nhưng biến động cao (${(technical.volatility * 100).toFixed(2)}%)`,
        priority: 'low',
        suggestedPercent: 0,
        expectedReturn,
        riskWarning: 'Chờ biến động giảm trước khi mua',
        timestamp: new Date(),
      };
    }
    
    const sentimentOk = !sentiment || sentiment.score > 0;
    const trendOk = technical.trend === 'uptrend' || technical.trend === 'sideways';
    
    if (sentimentOk && trendOk) {
      const suggestedPercent = strength === 'strong' ? 15 : strength === 'moderate' ? 10 : 5;
      
      return {
        ticker,
        type: holding ? 'INCREASE' : 'BUY',
        action: holding ? `Tăng tỷ trọng ${ticker}` : `Mua ${ticker}`,
        reason: buildBuyReason(signal),
        priority: strength === 'strong' ? 'high' : strength === 'moderate' ? 'medium' : 'low',
        suggestedPercent,
        expectedReturn,
        timestamp: new Date(),
      };
    }
  }
  
  // Sell recommendation
  if (type === 'SELL' && holding) {
    const reasons: string[] = [];
    
    if (expectedReturn < -config.minExpectedReturn) {
      reasons.push(`ML dự báo giảm ${(expectedReturn * 100).toFixed(2)}%`);
    }
    if (sentiment && sentiment.score < 0) {
      reasons.push('Sentiment tiêu cực');
    }
    if (technical.rsi > 70) {
      reasons.push('RSI quá mua');
    }
    
    if (reasons.length > 0) {
      const suggestedPercent = strength === 'strong' ? -100 : strength === 'moderate' ? -50 : -25;
      
      return {
        ticker,
        type: suggestedPercent === -100 ? 'SELL' : 'DECREASE',
        action: suggestedPercent === -100 ? `Bán hết ${ticker}` : `Giảm tỷ trọng ${ticker}`,
        reason: reasons.join('. '),
        priority: strength === 'strong' ? 'high' : 'medium',
        suggestedPercent,
        expectedReturn,
        riskWarning: riskLevel === 'high' ? 'Rủi ro cao, cân nhắc giảm nhanh' : undefined,
        timestamp: new Date(),
      };
    }
  }
  
  return null;
}

function buildBuyReason(signal: Signal): string {
  const parts: string[] = [];
  
  if (signal.prediction) {
    parts.push(`Dự báo tăng ${(signal.expectedReturn * 100).toFixed(2)}% trong 5 ngày`);
  }
  if (signal.sentiment && signal.sentiment.score > 0) {
    parts.push('sentiment tích cực');
  }
  if (signal.technical.trend === 'uptrend') {
    parts.push('xu hướng tăng');
  }
  if (signal.technical.rsi > 50 && signal.technical.rsi < 70) {
    parts.push(`RSI ${signal.technical.rsi.toFixed(0)}`);
  }
  
  return parts.join(', ');
}

// Generate all recommendations
export function generateAllRecommendations(
  signals: Signal[],
  holdings: PortfolioHolding[],
  config?: AdvisoryConfig
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const holdingMap = new Map(holdings.map(h => [h.ticker, h]));
  
  for (const signal of signals) {
    const holding = holdingMap.get(signal.ticker);
    const rec = generateRecommendation(signal, holding, config);
    if (rec) {
      recommendations.push(rec);
    }
  }
  
  // Sort by priority
  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// Generate daily summary
export interface DailySummary {
  date: Date;
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  buyRecommendations: Recommendation[];
  sellRecommendations: Recommendation[];
  holdRecommendations: Recommendation[];
  rebalancingActions: string[];
  totalExpectedReturn: number;
}

export function generateDailySummary(
  signals: Signal[],
  recommendations: Recommendation[]
): DailySummary {
  const buyRecs = recommendations.filter(r => r.type === 'BUY' || r.type === 'INCREASE');
  const sellRecs = recommendations.filter(r => r.type === 'SELL' || r.type === 'DECREASE');
  const holdRecs = recommendations.filter(r => r.type === 'HOLD');
  
  // Calculate market sentiment from signals
  const buySignals = signals.filter(s => s.type === 'BUY').length;
  const sellSignals = signals.filter(s => s.type === 'SELL').length;
  let marketSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (buySignals > sellSignals * 1.5) marketSentiment = 'bullish';
  else if (sellSignals > buySignals * 1.5) marketSentiment = 'bearish';
  
  // Generate rebalancing actions
  const rebalancingActions: string[] = [];
  for (const rec of buyRecs) {
    if (rec.type === 'INCREASE') {
      rebalancingActions.push(`Tăng tỷ trọng ${rec.ticker} +${rec.suggestedPercent}%`);
    } else {
      rebalancingActions.push(`Thêm ${rec.ticker} ${rec.suggestedPercent}% vì ${rec.reason.split(',')[0]}`);
    }
  }
  for (const rec of sellRecs) {
    if (rec.type === 'DECREASE') {
      rebalancingActions.push(`Giảm tỷ trọng ${rec.ticker} ${rec.suggestedPercent}%`);
    } else {
      rebalancingActions.push(`Bán ${rec.ticker}`);
    }
  }
  
  const totalExpectedReturn = recommendations.reduce((sum, r) => sum + r.expectedReturn * Math.abs(r.suggestedPercent) / 100, 0);
  
  return {
    date: new Date(),
    marketSentiment,
    buyRecommendations: buyRecs,
    sellRecommendations: sellRecs,
    holdRecommendations: holdRecs,
    rebalancingActions,
    totalExpectedReturn,
  };
}
