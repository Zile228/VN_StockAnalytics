// Simple Backtesting Engine

import { PriceData, PRICE_DATA, calculateReturns } from '@/data/mockData';
import { PortfolioWeights } from './portfolioService';

export interface BacktestConfig {
  tickers: string[];
  weights: PortfolioWeights;
  startDate: string;
  endDate: string;
  initialCapital: number;
  rebalancePeriod: 'daily' | 'weekly' | 'monthly';
}

export interface BacktestResult {
  equityCurve: { date: string; value: number }[];
  metrics: BacktestMetrics;
  trades: Trade[];
}

export interface BacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
}

export interface Trade {
  date: string;
  ticker: string;
  action: 'buy' | 'sell' | 'rebalance';
  shares: number;
  price: number;
  value: number;
}

// Calculate max drawdown
function calculateMaxDrawdown(equityCurve: number[]): number {
  let maxValue = equityCurve[0];
  let maxDrawdown = 0;
  
  for (const value of equityCurve) {
    if (value > maxValue) {
      maxValue = value;
    }
    const drawdown = (maxValue - value) / maxValue;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown;
}

// Run backtest
export function runBacktest(config: BacktestConfig): BacktestResult {
  const { tickers, weights, initialCapital, rebalancePeriod } = config;
  
  // Get aligned price data
  const allDates = new Set<string>();
  for (const ticker of tickers) {
    const prices = PRICE_DATA[ticker];
    if (prices) {
      prices.forEach(p => allDates.add(p.date));
    }
  }
  
  const sortedDates = Array.from(allDates).sort();
  
  // Initialize portfolio
  let portfolioValue = initialCapital;
  const holdings: Record<string, number> = {};
  const equityCurve: { date: string; value: number }[] = [];
  const trades: Trade[] = [];
  
  // Initialize holdings based on weights
  for (const ticker of tickers) {
    const allocation = weights[ticker] || 0;
    const prices = PRICE_DATA[ticker];
    if (prices && prices.length > 0) {
      const initialPrice = prices[0].close;
      const targetValue = initialCapital * allocation;
      holdings[ticker] = targetValue / initialPrice;
      
      trades.push({
        date: prices[0].date,
        ticker,
        action: 'buy',
        shares: holdings[ticker],
        price: initialPrice,
        value: targetValue,
      });
    }
  }
  
  // Track daily returns for metrics
  const dailyReturns: number[] = [];
  let lastRebalanceDate = sortedDates[0];
  
  // Run through each date
  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i];
    let dailyValue = 0;
    
    // Calculate portfolio value
    for (const ticker of tickers) {
      const prices = PRICE_DATA[ticker];
      if (prices) {
        const priceData = prices.find(p => p.date === date);
        if (priceData && holdings[ticker]) {
          dailyValue += holdings[ticker] * priceData.close;
        }
      }
    }
    
    // Track daily return
    if (i > 0 && portfolioValue > 0) {
      dailyReturns.push((dailyValue - portfolioValue) / portfolioValue);
    }
    
    portfolioValue = dailyValue;
    equityCurve.push({ date, value: Math.round(portfolioValue * 100) / 100 });
    
    // Check for rebalance
    const shouldRebalance = shouldRebalancePortfolio(
      date,
      lastRebalanceDate,
      rebalancePeriod
    );
    
    if (shouldRebalance && i > 0) {
      // Rebalance to target weights
      for (const ticker of tickers) {
        const prices = PRICE_DATA[ticker];
        if (prices) {
          const priceData = prices.find(p => p.date === date);
          if (priceData) {
            const targetWeight = weights[ticker] || 0;
            const targetValue = portfolioValue * targetWeight;
            const currentValue = (holdings[ticker] || 0) * priceData.close;
            const diff = targetValue - currentValue;
            
            if (Math.abs(diff) > portfolioValue * 0.01) {
              const shareDiff = diff / priceData.close;
              holdings[ticker] = (holdings[ticker] || 0) + shareDiff;
              
              trades.push({
                date,
                ticker,
                action: 'rebalance',
                shares: Math.abs(shareDiff),
                price: priceData.close,
                value: Math.abs(diff),
              });
            }
          }
        }
      }
      lastRebalanceDate = date;
    }
  }
  
  // Calculate metrics
  const totalReturn = (portfolioValue - initialCapital) / initialCapital;
  const tradingDays = dailyReturns.length;
  const annualizedReturn = Math.pow(1 + totalReturn, 252 / tradingDays) - 1;
  
  const avgReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(252);
  
  const riskFreeRate = 0.05;
  const sharpeRatio = (annualizedReturn - riskFreeRate) / volatility;
  
  const maxDrawdown = calculateMaxDrawdown(equityCurve.map(e => e.value));
  
  const winningDays = dailyReturns.filter(r => r > 0).length;
  const winRate = winningDays / dailyReturns.length;
  
  return {
    equityCurve,
    metrics: {
      totalReturn: Math.round(totalReturn * 10000) / 10000,
      annualizedReturn: Math.round(annualizedReturn * 10000) / 10000,
      volatility: Math.round(volatility * 10000) / 10000,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
      winRate: Math.round(winRate * 10000) / 10000,
      totalTrades: trades.length,
    },
    trades,
  };
}

function shouldRebalancePortfolio(
  currentDate: string,
  lastRebalanceDate: string,
  period: 'daily' | 'weekly' | 'monthly'
): boolean {
  const current = new Date(currentDate);
  const last = new Date(lastRebalanceDate);
  const diffDays = Math.floor((current.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  
  switch (period) {
    case 'daily':
      return diffDays >= 1;
    case 'weekly':
      return diffDays >= 7;
    case 'monthly':
      return diffDays >= 30;
    default:
      return false;
  }
}

// Compare backtest with benchmark
export function compareToBenchmark(
  backtestResult: BacktestResult,
  benchmarkPrices: PriceData[],
  initialCapital: number
): { date: string; portfolio: number; benchmark: number }[] {
  const benchmarkStart = benchmarkPrices[0].close;
  
  return backtestResult.equityCurve.map(point => {
    const benchmarkPrice = benchmarkPrices.find(p => p.date === point.date);
    const benchmarkValue = benchmarkPrice 
      ? (benchmarkPrice.close / benchmarkStart) * initialCapital
      : initialCapital;
    
    return {
      date: point.date,
      portfolio: point.value,
      benchmark: Math.round(benchmarkValue * 100) / 100,
    };
  });
}
