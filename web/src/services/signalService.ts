// Signal Engine - Generate buy/sell signals from ML + NLP + Technical Analysis

import { PriceData } from '@/data/mockData';
import { PredictionResult } from './predictionService';
import { SentimentResult } from './sentimentService';

export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type SignalStrength = 'strong' | 'moderate' | 'weak';

export interface TechnicalIndicators {
  rsi: number;
  ma5: number;
  ma10: number;
  ma20: number;
  macdSignal: 'bullish' | 'bearish' | 'neutral';
  trend: 'uptrend' | 'downtrend' | 'sideways';
  volatility: number;
}

export interface Signal {
  ticker: string;
  type: SignalType;
  strength: SignalStrength;
  confidence: number;
  reasons: string[];
  expectedReturn: number;
  riskLevel: 'low' | 'medium' | 'high';
  suggestedAllocation: number; // % of portfolio
  timestamp: Date;
  technical: TechnicalIndicators;
  sentiment: SentimentResult | null;
  prediction: PredictionResult | null;
}

export interface SignalConfig {
  returnThreshold: number; // e.g., 0.01 for 1%
  sentimentThreshold: number; // e.g., 0
  rsiOverbought: number; // e.g., 70
  rsiOversold: number; // e.g., 30
  maxVolatility: number; // e.g., 0.03
  probabilityThreshold: number; // e.g., 0.6
}

const DEFAULT_CONFIG: SignalConfig = {
  returnThreshold: 0.01,
  sentimentThreshold: 0,
  rsiOverbought: 70,
  rsiOversold: 30,
  maxVolatility: 0.03,
  probabilityThreshold: 0.6,
};

// Calculate MA20
function calculateMA20(prices: number[]): number {
  if (prices.length < 20) return prices[prices.length - 1];
  const slice = prices.slice(-20);
  return slice.reduce((sum, p) => sum + p, 0) / 20;
}

// Determine MACD signal (simplified)
function getMACDSignal(ma5: number, ma10: number, ma20: number): 'bullish' | 'bearish' | 'neutral' {
  if (ma5 > ma10 && ma10 > ma20) return 'bullish';
  if (ma5 < ma10 && ma10 < ma20) return 'bearish';
  return 'neutral';
}

// Determine trend
function getTrend(ma5: number, ma10: number, currentPrice: number): 'uptrend' | 'downtrend' | 'sideways' {
  const maDiff = (ma5 - ma10) / ma10;
  const priceToMa = (currentPrice - ma5) / ma5;
  
  if (maDiff > 0.01 && priceToMa > 0) return 'uptrend';
  if (maDiff < -0.01 && priceToMa < 0) return 'downtrend';
  return 'sideways';
}

// Calculate technical indicators
export function calculateTechnicalIndicators(prices: PriceData[]): TechnicalIndicators {
  const closePrices = prices.map(p => p.close);
  const currentPrice = closePrices[closePrices.length - 1];
  
  // Calculate MAs
  const ma5 = closePrices.slice(-5).reduce((s, p) => s + p, 0) / Math.min(5, closePrices.length);
  const ma10 = closePrices.slice(-10).reduce((s, p) => s + p, 0) / Math.min(10, closePrices.length);
  const ma20 = calculateMA20(closePrices);
  
  // Calculate RSI
  const returns = [];
  for (let i = 1; i < Math.min(15, closePrices.length); i++) {
    returns.push((closePrices[i] - closePrices[i - 1]) / closePrices[i - 1]);
  }
  
  let gains = 0, losses = 0;
  for (const r of returns) {
    if (r > 0) gains += r;
    else losses += Math.abs(r);
  }
  const avgGain = gains / returns.length;
  const avgLoss = losses / returns.length || 0.001;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  // Calculate volatility
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);
  
  return {
    rsi: Math.round(rsi * 100) / 100,
    ma5: Math.round(ma5 * 100) / 100,
    ma10: Math.round(ma10 * 100) / 100,
    ma20: Math.round(ma20 * 100) / 100,
    macdSignal: getMACDSignal(ma5, ma10, ma20),
    trend: getTrend(ma5, ma10, currentPrice),
    volatility: Math.round(volatility * 10000) / 10000,
  };
}

// Generate signal for a single ticker
export function generateSignal(
  ticker: string,
  prices: PriceData[],
  prediction: PredictionResult | null,
  sentiment: SentimentResult | null,
  config: SignalConfig = DEFAULT_CONFIG
): Signal {
  const technical = calculateTechnicalIndicators(prices);
  const reasons: string[] = [];
  let buyScore = 0;
  let sellScore = 0;
  
  // ML prediction signals
  if (prediction) {
    if (prediction.predictedReturn > config.returnThreshold) {
      buyScore += 2;
      reasons.push(`ML dự báo tăng ${(prediction.predictedReturn * 100).toFixed(2)}%`);
    } else if (prediction.predictedReturn < -config.returnThreshold) {
      sellScore += 2;
      reasons.push(`ML dự báo giảm ${(prediction.predictedReturn * 100).toFixed(2)}%`);
    }
    
    if (prediction.confidence > config.probabilityThreshold) {
      if (prediction.direction === 'up') buyScore += 1;
      else if (prediction.direction === 'down') sellScore += 1;
    }
  }
  
  // Sentiment signals
  if (sentiment) {
    if (sentiment.score > config.sentimentThreshold) {
      buyScore += 1;
      reasons.push(`Sentiment tích cực (${sentiment.score.toFixed(2)})`);
    } else if (sentiment.score < -config.sentimentThreshold) {
      sellScore += 1;
      reasons.push(`Sentiment tiêu cực (${sentiment.score.toFixed(2)})`);
    }
  }
  
  // Technical signals
  if (technical.trend === 'uptrend') {
    buyScore += 1;
    reasons.push('Xu hướng tăng (MA crossover)');
  } else if (technical.trend === 'downtrend') {
    sellScore += 1;
    reasons.push('Xu hướng giảm');
  }
  
  if (technical.rsi > config.rsiOverbought) {
    sellScore += 1;
    reasons.push(`RSI quá mua (${technical.rsi.toFixed(1)})`);
  } else if (technical.rsi < config.rsiOversold) {
    buyScore += 1;
    reasons.push(`RSI quá bán (${technical.rsi.toFixed(1)})`);
  } else if (technical.rsi > 50 && technical.rsi < 60) {
    buyScore += 0.5;
    reasons.push(`RSI trung tính tích cực (${technical.rsi.toFixed(1)})`);
  }
  
  if (technical.macdSignal === 'bullish') {
    buyScore += 1;
    reasons.push('MACD tín hiệu tăng');
  } else if (technical.macdSignal === 'bearish') {
    sellScore += 1;
    reasons.push('MACD tín hiệu giảm');
  }
  
  // Volatility check
  if (technical.volatility > config.maxVolatility) {
    sellScore += 0.5;
    reasons.push(`Biến động cao (${(technical.volatility * 100).toFixed(2)}%)`);
  }
  
  // Determine signal type
  let type: SignalType = 'HOLD';
  let strength: SignalStrength = 'weak';
  
  const netScore = buyScore - sellScore;
  
  if (netScore >= 3) {
    type = 'BUY';
    strength = 'strong';
  } else if (netScore >= 1.5) {
    type = 'BUY';
    strength = 'moderate';
  } else if (netScore >= 0.5) {
    type = 'BUY';
    strength = 'weak';
  } else if (netScore <= -3) {
    type = 'SELL';
    strength = 'strong';
  } else if (netScore <= -1.5) {
    type = 'SELL';
    strength = 'moderate';
  } else if (netScore <= -0.5) {
    type = 'SELL';
    strength = 'weak';
  }
  
  // Calculate confidence
  const totalScore = buyScore + sellScore;
  const confidence = totalScore > 0 ? Math.abs(netScore) / totalScore : 0.5;
  
  // Suggested allocation based on signal strength
  let suggestedAllocation = 0;
  if (type === 'BUY') {
    suggestedAllocation = strength === 'strong' ? 15 : strength === 'moderate' ? 10 : 5;
  } else if (type === 'SELL') {
    suggestedAllocation = strength === 'strong' ? -15 : strength === 'moderate' ? -10 : -5;
  }
  
  // Risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  if (technical.volatility < 0.015) riskLevel = 'low';
  else if (technical.volatility > 0.025) riskLevel = 'high';
  
  return {
    ticker,
    type,
    strength,
    confidence: Math.round(confidence * 100) / 100,
    reasons,
    expectedReturn: prediction?.predictedReturn || 0,
    riskLevel,
    suggestedAllocation,
    timestamp: new Date(),
    technical,
    sentiment,
    prediction,
  };
}

// Generate signals for multiple tickers
export function generateAllSignals(
  tickerData: Record<string, {
    prices: PriceData[];
    prediction: PredictionResult | null;
    sentiment: SentimentResult | null;
  }>,
  config?: SignalConfig
): Signal[] {
  return Object.entries(tickerData).map(([ticker, data]) =>
    generateSignal(ticker, data.prices, data.prediction, data.sentiment, config)
  );
}

// Get top buy signals
export function getTopBuySignals(signals: Signal[], limit: number = 5): Signal[] {
  return signals
    .filter(s => s.type === 'BUY')
    .sort((a, b) => {
      const scoreA = (a.strength === 'strong' ? 3 : a.strength === 'moderate' ? 2 : 1) * a.confidence;
      const scoreB = (b.strength === 'strong' ? 3 : b.strength === 'moderate' ? 2 : 1) * b.confidence;
      return scoreB - scoreA;
    })
    .slice(0, limit);
}

// Get top sell signals
export function getTopSellSignals(signals: Signal[], limit: number = 5): Signal[] {
  return signals
    .filter(s => s.type === 'SELL')
    .sort((a, b) => {
      const scoreA = (a.strength === 'strong' ? 3 : a.strength === 'moderate' ? 2 : 1) * a.confidence;
      const scoreB = (b.strength === 'strong' ? 3 : b.strength === 'moderate' ? 2 : 1) * b.confidence;
      return scoreB - scoreA;
    })
    .slice(0, limit);
}
