// Simple ML-like price prediction using statistical methods
// In a real app, this would call a backend ML model

import { PriceData, calculateReturns } from '@/data/mockData';

export interface PredictionFeatures {
  return1d: number;
  return3d: number;
  ma5: number;
  ma10: number;
  volatility: number;
  momentum: number;
  rsi: number;
}

export interface PredictionResult {
  predictedReturn: number;
  predictedPrice: number;
  confidence: number;
  direction: 'up' | 'down' | 'neutral';
  features: PredictionFeatures;
}

// Calculate Moving Average
function calculateMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

// Calculate RSI
function calculateRSI(returns: number[], period: number = 14): number {
  if (returns.length < period) return 50;
  
  const recentReturns = returns.slice(-period);
  let gains = 0;
  let losses = 0;
  
  for (const r of recentReturns) {
    if (r > 0) gains += r;
    else losses += Math.abs(r);
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate Volatility (Standard Deviation of returns)
function calculateVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, d) => sum + d, 0) / returns.length);
}

// Extract features from price data
export function extractFeatures(prices: PriceData[]): PredictionFeatures {
  const closePrices = prices.map(p => p.close);
  const returns = calculateReturns(prices);
  
  const return1d = returns.length > 0 ? returns[returns.length - 1] : 0;
  const return3d = returns.length >= 3 
    ? (closePrices[closePrices.length - 1] - closePrices[closePrices.length - 4]) / closePrices[closePrices.length - 4]
    : 0;
  
  const ma5 = calculateMA(closePrices, 5);
  const ma10 = calculateMA(closePrices, 10);
  const currentPrice = closePrices[closePrices.length - 1];
  
  const volatility = calculateVolatility(returns.slice(-10));
  const momentum = (currentPrice - ma10) / ma10;
  const rsi = calculateRSI(returns);
  
  return {
    return1d: Math.round(return1d * 10000) / 10000,
    return3d: Math.round(return3d * 10000) / 10000,
    ma5: Math.round(ma5 * 100) / 100,
    ma10: Math.round(ma10 * 100) / 100,
    volatility: Math.round(volatility * 10000) / 10000,
    momentum: Math.round(momentum * 10000) / 10000,
    rsi: Math.round(rsi * 100) / 100,
  };
}

// Simple prediction model (simulating RandomForest/XGBoost behavior)
export function predictPrice(prices: PriceData[]): PredictionResult {
  const features = extractFeatures(prices);
  const currentPrice = prices[prices.length - 1].close;
  
  // Weighted combination of signals (simulating ML model weights)
  let signal = 0;
  
  // Momentum signal
  signal += features.momentum * 0.3;
  
  // Mean reversion from RSI
  if (features.rsi > 70) signal -= 0.02;
  else if (features.rsi < 30) signal += 0.02;
  
  // Trend following from MA crossover
  const maDiff = (features.ma5 - features.ma10) / features.ma10;
  signal += maDiff * 0.25;
  
  // Recent return momentum
  signal += features.return1d * 0.15;
  signal += features.return3d * 0.1;
  
  // Add some noise to simulate model uncertainty
  const noise = (Math.random() - 0.5) * 0.01;
  signal += noise;
  
  // Clamp prediction
  const predictedReturn = Math.max(-0.05, Math.min(0.05, signal));
  const predictedPrice = currentPrice * (1 + predictedReturn);
  
  // Calculate confidence based on volatility and signal strength
  const signalStrength = Math.abs(signal);
  const confidence = Math.min(0.85, 0.5 + signalStrength * 5 - features.volatility * 10);
  
  let direction: 'up' | 'down' | 'neutral' = 'neutral';
  if (predictedReturn > 0.005) direction = 'up';
  else if (predictedReturn < -0.005) direction = 'down';
  
  return {
    predictedReturn: Math.round(predictedReturn * 10000) / 10000,
    predictedPrice: Math.round(predictedPrice * 100) / 100,
    confidence: Math.round(Math.max(0.3, confidence) * 100) / 100,
    direction,
    features,
  };
}

// Batch predict for multiple tickers
export function batchPredict(priceDataMap: Record<string, PriceData[]>): Record<string, PredictionResult> {
  const results: Record<string, PredictionResult> = {};
  for (const [ticker, prices] of Object.entries(priceDataMap)) {
    results[ticker] = predictPrice(prices);
  }
  return results;
}
