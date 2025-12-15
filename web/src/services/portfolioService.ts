// Markowitz Portfolio Optimization

import { PriceData, calculateReturns } from '@/data/mockData';

export interface PortfolioWeights {
  [ticker: string]: number;
}

export interface PortfolioMetrics {
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
}

export interface OptimizedPortfolio {
  weights: PortfolioWeights;
  metrics: PortfolioMetrics;
}

export interface EfficientFrontierPoint {
  volatility: number;
  return: number;
  sharpeRatio: number;
  weights: PortfolioWeights;
}

const RISK_FREE_RATE = 0.05 / 252; // Daily risk-free rate (5% annual)

// Calculate mean returns for each ticker
function calculateMeanReturns(returnsMap: Record<string, number[]>): Record<string, number> {
  const meanReturns: Record<string, number> = {};
  for (const [ticker, returns] of Object.entries(returnsMap)) {
    meanReturns[ticker] = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  }
  return meanReturns;
}

// Calculate covariance matrix (simplified)
function calculateCovariance(returns1: number[], returns2: number[]): number {
  const n = Math.min(returns1.length, returns2.length);
  const mean1 = returns1.reduce((sum, r) => sum + r, 0) / n;
  const mean2 = returns2.reduce((sum, r) => sum + r, 0) / n;
  
  let cov = 0;
  for (let i = 0; i < n; i++) {
    cov += (returns1[i] - mean1) * (returns2[i] - mean2);
  }
  return cov / (n - 1);
}

// Calculate portfolio return
function portfolioReturn(weights: number[], meanReturns: number[]): number {
  return weights.reduce((sum, w, i) => sum + w * meanReturns[i], 0);
}

// Calculate portfolio volatility
function portfolioVolatility(
  weights: number[],
  covMatrix: number[][]
): number {
  let variance = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      variance += weights[i] * weights[j] * covMatrix[i][j];
    }
  }
  return Math.sqrt(variance);
}

// Generate random portfolio weights
function randomWeights(n: number): number[] {
  const weights = Array(n).fill(0).map(() => Math.random());
  const sum = weights.reduce((s, w) => s + w, 0);
  return weights.map(w => w / sum);
}

// Monte Carlo portfolio simulation
export function generateRandomPortfolios(
  priceDataMap: Record<string, PriceData[]>,
  numPortfolios: number = 1000
): EfficientFrontierPoint[] {
  const tickers = Object.keys(priceDataMap);
  const n = tickers.length;
  
  // Calculate returns for each ticker
  const returnsMap: Record<string, number[]> = {};
  for (const ticker of tickers) {
    returnsMap[ticker] = calculateReturns(priceDataMap[ticker]);
  }
  
  const meanReturns = calculateMeanReturns(returnsMap);
  const meanReturnsArray = tickers.map(t => meanReturns[t]);
  
  // Build covariance matrix
  const covMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    covMatrix[i] = [];
    for (let j = 0; j < n; j++) {
      covMatrix[i][j] = calculateCovariance(
        returnsMap[tickers[i]],
        returnsMap[tickers[j]]
      );
    }
  }
  
  // Generate random portfolios
  const portfolios: EfficientFrontierPoint[] = [];
  
  for (let p = 0; p < numPortfolios; p++) {
    const weights = randomWeights(n);
    const ret = portfolioReturn(weights, meanReturnsArray);
    const vol = portfolioVolatility(weights, covMatrix);
    const sharpe = (ret - RISK_FREE_RATE) / vol;
    
    const weightsObj: PortfolioWeights = {};
    tickers.forEach((t, i) => {
      weightsObj[t] = Math.round(weights[i] * 10000) / 10000;
    });
    
    portfolios.push({
      return: ret * 252, // Annualize
      volatility: vol * Math.sqrt(252), // Annualize
      sharpeRatio: sharpe * Math.sqrt(252), // Annualize
      weights: weightsObj,
    });
  }
  
  return portfolios;
}

// Find optimal portfolio (max Sharpe ratio)
export function optimizePortfolio(
  priceDataMap: Record<string, PriceData[]>
): OptimizedPortfolio {
  const portfolios = generateRandomPortfolios(priceDataMap, 5000);
  
  // Find max Sharpe ratio portfolio
  let bestPortfolio = portfolios[0];
  for (const p of portfolios) {
    if (p.sharpeRatio > bestPortfolio.sharpeRatio) {
      bestPortfolio = p;
    }
  }
  
  return {
    weights: bestPortfolio.weights,
    metrics: {
      expectedReturn: Math.round(bestPortfolio.return * 10000) / 10000,
      volatility: Math.round(bestPortfolio.volatility * 10000) / 10000,
      sharpeRatio: Math.round(bestPortfolio.sharpeRatio * 100) / 100,
    },
  };
}

// Find minimum volatility portfolio
export function findMinVolatilityPortfolio(
  priceDataMap: Record<string, PriceData[]>
): OptimizedPortfolio {
  const portfolios = generateRandomPortfolios(priceDataMap, 5000);
  
  let bestPortfolio = portfolios[0];
  for (const p of portfolios) {
    if (p.volatility < bestPortfolio.volatility) {
      bestPortfolio = p;
    }
  }
  
  return {
    weights: bestPortfolio.weights,
    metrics: {
      expectedReturn: Math.round(bestPortfolio.return * 10000) / 10000,
      volatility: Math.round(bestPortfolio.volatility * 10000) / 10000,
      sharpeRatio: Math.round(bestPortfolio.sharpeRatio * 100) / 100,
    },
  };
}

// Calculate efficient frontier
export function calculateEfficientFrontier(
  priceDataMap: Record<string, PriceData[]>
): EfficientFrontierPoint[] {
  const portfolios = generateRandomPortfolios(priceDataMap, 3000);
  
  // Sort by volatility
  portfolios.sort((a, b) => a.volatility - b.volatility);
  
  // Get efficient frontier (portfolios with highest return for each volatility level)
  const frontier: EfficientFrontierPoint[] = [];
  let maxReturn = -Infinity;
  
  for (const p of portfolios) {
    if (p.return > maxReturn) {
      frontier.push(p);
      maxReturn = p.return;
    }
  }
  
  return frontier;
}
