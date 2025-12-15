// Capital Simulation Engine - Simulate portfolio performance over time

import { PriceData, PRICE_DATA, VNINDEX_DATA } from '@/data/mockData';
import { Signal, generateSignal, calculateTechnicalIndicators } from './signalService';
import { predictPrice } from './predictionService';
import { analyzeSentiment, aggregateSentiment, SentimentResult } from './sentimentService';
import { NEWS_DATA } from '@/data/mockData';

export interface SimulationConfig {
  initialCapital: number;
  startDate: Date;
  endDate: Date;
  maxPositionSize: number; // Max % per stock
  minCashReserve: number; // Min % cash to keep
  rebalanceFrequency: 'daily' | 'weekly';
  takeProfitPercent: number;
  stopLossPercent: number;
  transactionFee: number; // e.g., 0.0015 for 0.15%
}

export interface Position {
  ticker: string;
  shares: number;
  avgCost: number;
  entryDate: Date;
}

export interface Transaction {
  date: Date;
  ticker: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  value: number;
  fee: number;
  reason: string;
}

export interface DailySnapshot {
  date: Date;
  cash: number;
  positions: Position[];
  portfolioValue: number;
  totalValue: number;
  dailyReturn: number;
  cumulativeReturn: number;
  benchmarkValue: number;
  benchmarkReturn: number;
}

export interface SimulationResult {
  config: SimulationConfig;
  transactions: Transaction[];
  dailySnapshots: DailySnapshot[];
  finalCapital: number;
  totalReturn: number;
  annualizedReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
}

const DEFAULT_CONFIG: SimulationConfig = {
  initialCapital: 100_000_000, // 100 million VND
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  maxPositionSize: 0.25,
  minCashReserve: 0.1,
  rebalanceFrequency: 'weekly',
  takeProfitPercent: 0.15,
  stopLossPercent: -0.07,
  transactionFee: 0.0015,
};

// Get price on a specific date (or closest before)
function getPriceOnDate(prices: PriceData[], targetDate: Date): PriceData | null {
  const targetTime = targetDate.getTime();
  let closest: PriceData | null = null;
  
  for (const price of prices) {
    const priceTime = new Date(price.date).getTime();
    if (priceTime <= targetTime) {
      if (!closest || priceTime > new Date(closest.date).getTime()) {
        closest = price;
      }
    }
  }
  
  return closest;
}

// Get prices up to a specific date
function getPricesUpToDate(prices: PriceData[], targetDate: Date): PriceData[] {
  const targetTime = targetDate.getTime();
  return prices.filter(p => new Date(p.date).getTime() <= targetTime);
}

// Get sentiment for a ticker around a date
function getSentimentForTicker(ticker: string, date: Date): SentimentResult | null {
  const targetTime = date.getTime();
  const relevantNews = NEWS_DATA.filter(n => {
    const newsTime = new Date(n.date).getTime();
    return n.ticker === ticker && Math.abs(newsTime - targetTime) < 7 * 24 * 60 * 60 * 1000; // Within 7 days
  });
  
  if (relevantNews.length === 0) return null;
  
  const sentiments = relevantNews.map(n => analyzeSentiment(n.title + ' ' + n.content));
  return aggregateSentiment(sentiments);
}

// Generate signal for simulation
function getSimulationSignal(ticker: string, prices: PriceData[], date: Date): Signal | null {
  const pricesUpToDate = getPricesUpToDate(prices, date);
  if (pricesUpToDate.length < 10) return null;
  
  const prediction = predictPrice(pricesUpToDate);
  const sentiment = getSentimentForTicker(ticker, date);
  
  return generateSignal(ticker, pricesUpToDate, prediction, sentiment);
}

// Main simulation function
export function runSimulation(
  tickers: string[],
  config: Partial<SimulationConfig> = {}
): SimulationResult {
  const cfg: SimulationConfig = { ...DEFAULT_CONFIG, ...config };
  
  let cash = cfg.initialCapital;
  let positions: Position[] = [];
  const transactions: Transaction[] = [];
  const dailySnapshots: DailySnapshot[] = [];
  
  // Get all trading days
  const allDates: Date[] = [];
  const startTime = cfg.startDate.getTime();
  const endTime = cfg.endDate.getTime();
  
  // Use VNINDEX dates as reference for trading days
  for (const data of VNINDEX_DATA) {
    const dataTime = new Date(data.date).getTime();
    if (dataTime >= startTime && dataTime <= endTime) {
      allDates.push(new Date(data.date));
    }
  }
  
  if (allDates.length === 0) {
    // If no dates in range, use available dates
    for (const data of VNINDEX_DATA) {
      allDates.push(new Date(data.date));
    }
  }
  
  allDates.sort((a, b) => a.getTime() - b.getTime());
  
  const initialBenchmark = getPriceOnDate(VNINDEX_DATA, allDates[0])?.close || 1200;
  let prevTotalValue = cfg.initialCapital;
  
  // Simulate each day
  for (let dayIndex = 0; dayIndex < allDates.length; dayIndex++) {
    const currentDate = allDates[dayIndex];
    const isRebalanceDay = cfg.rebalanceFrequency === 'daily' || dayIndex % 5 === 0;
    
    // Get current prices
    const currentPrices: Record<string, number> = {};
    for (const ticker of tickers) {
      const priceData = getPriceOnDate(PRICE_DATA[ticker] || [], currentDate);
      if (priceData) {
        currentPrices[ticker] = priceData.close;
      }
    }
    
    // Calculate portfolio value
    let portfolioValue = 0;
    for (const pos of positions) {
      const price = currentPrices[pos.ticker];
      if (price) {
        portfolioValue += pos.shares * price;
      }
    }
    
    const totalValue = cash + portfolioValue;
    const dailyReturn = prevTotalValue > 0 ? (totalValue - prevTotalValue) / prevTotalValue : 0;
    const cumulativeReturn = (totalValue - cfg.initialCapital) / cfg.initialCapital;
    
    // Benchmark value
    const benchmarkPrice = getPriceOnDate(VNINDEX_DATA, currentDate)?.close || initialBenchmark;
    const benchmarkReturn = (benchmarkPrice - initialBenchmark) / initialBenchmark;
    
    // Check for take-profit / stop-loss
    const positionsToSell: { position: Position; reason: string }[] = [];
    for (const pos of positions) {
      const currentPrice = currentPrices[pos.ticker];
      if (!currentPrice) continue;
      
      const profitLoss = (currentPrice - pos.avgCost) / pos.avgCost;
      
      if (profitLoss >= cfg.takeProfitPercent) {
        positionsToSell.push({ position: pos, reason: `Chốt lời ${(profitLoss * 100).toFixed(1)}%` });
      } else if (profitLoss <= cfg.stopLossPercent) {
        positionsToSell.push({ position: pos, reason: `Cắt lỗ ${(profitLoss * 100).toFixed(1)}%` });
      }
    }
    
    // Execute sells
    for (const { position, reason } of positionsToSell) {
      const price = currentPrices[position.ticker];
      if (!price) continue;
      
      const sellValue = position.shares * price;
      const fee = sellValue * cfg.transactionFee;
      
      transactions.push({
        date: currentDate,
        ticker: position.ticker,
        type: 'SELL',
        shares: position.shares,
        price,
        value: sellValue,
        fee,
        reason,
      });
      
      cash += sellValue - fee;
      positions = positions.filter(p => p.ticker !== position.ticker);
    }
    
    // Rebalancing logic
    if (isRebalanceDay && dayIndex > 5) {
      // Generate signals for all tickers
      const signals: Signal[] = [];
      for (const ticker of tickers) {
        const prices = PRICE_DATA[ticker];
        if (!prices) continue;
        
        const signal = getSimulationSignal(ticker, prices, currentDate);
        if (signal) {
          signals.push(signal);
        }
      }
      
      // Check existing positions for sell signals
      for (const pos of [...positions]) {
        const signal = signals.find(s => s.ticker === pos.ticker);
        if (signal && signal.type === 'SELL' && signal.strength !== 'weak') {
          const price = currentPrices[pos.ticker];
          if (!price) continue;
          
          const sellValue = pos.shares * price;
          const fee = sellValue * cfg.transactionFee;
          
          transactions.push({
            date: currentDate,
            ticker: pos.ticker,
            type: 'SELL',
            shares: pos.shares,
            price,
            value: sellValue,
            fee,
            reason: signal.reasons.slice(0, 2).join('. '),
          });
          
          cash += sellValue - fee;
          positions = positions.filter(p => p.ticker !== pos.ticker);
        }
      }
      
      // Look for buy opportunities if we have cash
      const availableCash = cash - (totalValue * cfg.minCashReserve);
      
      if (availableCash > 0) {
        const buySignals = signals
          .filter(s => s.type === 'BUY' && !positions.find(p => p.ticker === s.ticker))
          .sort((a, b) => {
            // Sort by expected return / volatility ratio
            const ratioA = a.expectedReturn / (a.technical.volatility || 0.01);
            const ratioB = b.expectedReturn / (b.technical.volatility || 0.01);
            return ratioB - ratioA;
          });
        
        for (const signal of buySignals.slice(0, 2)) {
          const price = currentPrices[signal.ticker];
          if (!price) continue;
          
          // Calculate position size
          const maxPositionValue = totalValue * cfg.maxPositionSize;
          const targetValue = Math.min(
            maxPositionValue,
            availableCash * (signal.suggestedAllocation / 100) * 2
          );
          
          if (targetValue < price) continue; // Can't even buy 1 share
          
          const shares = Math.floor(targetValue / price);
          if (shares === 0) continue;
          
          const buyValue = shares * price;
          const fee = buyValue * cfg.transactionFee;
          
          if (buyValue + fee > cash) continue;
          
          transactions.push({
            date: currentDate,
            ticker: signal.ticker,
            type: 'BUY',
            shares,
            price,
            value: buyValue,
            fee,
            reason: signal.reasons.slice(0, 2).join('. '),
          });
          
          cash -= buyValue + fee;
          positions.push({
            ticker: signal.ticker,
            shares,
            avgCost: price,
            entryDate: currentDate,
          });
        }
      }
    }
    
    // Recalculate portfolio value after trades
    portfolioValue = 0;
    for (const pos of positions) {
      const price = currentPrices[pos.ticker];
      if (price) {
        portfolioValue += pos.shares * price;
      }
    }
    
    // Record daily snapshot
    dailySnapshots.push({
      date: currentDate,
      cash,
      positions: [...positions],
      portfolioValue,
      totalValue: cash + portfolioValue,
      dailyReturn,
      cumulativeReturn: (cash + portfolioValue - cfg.initialCapital) / cfg.initialCapital,
      benchmarkValue: benchmarkPrice,
      benchmarkReturn,
    });
    
    prevTotalValue = cash + portfolioValue;
  }
  
  // Calculate final metrics
  const finalSnapshot = dailySnapshots[dailySnapshots.length - 1];
  const finalCapital = finalSnapshot?.totalValue || cfg.initialCapital;
  const totalReturn = (finalCapital - cfg.initialCapital) / cfg.initialCapital;
  
  // Calculate annualized return
  const dayCount = dailySnapshots.length;
  const annualizedReturn = Math.pow(1 + totalReturn, 252 / dayCount) - 1;
  
  // Benchmark return
  const benchmarkReturn = finalSnapshot?.benchmarkReturn || 0;
  const excessReturn = totalReturn - benchmarkReturn;
  
  // Max drawdown
  let maxDrawdown = 0;
  let peak = cfg.initialCapital;
  for (const snapshot of dailySnapshots) {
    if (snapshot.totalValue > peak) {
      peak = snapshot.totalValue;
    }
    const drawdown = (peak - snapshot.totalValue) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  // Sharpe ratio (simplified)
  const returns = dailySnapshots.map(s => s.dailyReturn);
  const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn * 252) / (stdDev * Math.sqrt(252)) : 0;
  
  // Win rate
  const sellTransactions = transactions.filter(t => t.type === 'SELL');
  const profitableTrades = sellTransactions.filter(t => {
    // Find corresponding buy
    const buyTx = transactions.find(b => b.ticker === t.ticker && b.type === 'BUY' && new Date(b.date) < new Date(t.date));
    return buyTx ? t.price > buyTx.price : false;
  }).length;
  
  return {
    config: cfg,
    transactions,
    dailySnapshots,
    finalCapital: Math.round(finalCapital),
    totalReturn: Math.round(totalReturn * 10000) / 10000,
    annualizedReturn: Math.round(annualizedReturn * 10000) / 10000,
    benchmarkReturn: Math.round(benchmarkReturn * 10000) / 10000,
    excessReturn: Math.round(excessReturn * 10000) / 10000,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    winRate: sellTransactions.length > 0 ? Math.round((profitableTrades / sellTransactions.length) * 100) : 0,
    totalTrades: transactions.length,
    profitableTrades,
  };
}

// Format currency
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format percent
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(decimals)}%`;
}
