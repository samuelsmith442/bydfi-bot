import type { Ticker } from '../models/types.js';

export interface PriceAnalysis {
  symbol: string;
  currentChange: number;
  momentum: 'ACCELERATING' | 'DECELERATING' | 'STABLE';
  isOverextended: boolean;
  pumpAge: 'FRESH' | 'ACTIVE' | 'EXHAUSTED' | 'UNKNOWN';
}

export function analyzePriceMomentum(ticker: Ticker): PriceAnalysis {
  const currentChange = parseFloat(ticker.priceChangePercent);
  
  let momentum: 'ACCELERATING' | 'DECELERATING' | 'STABLE' = 'STABLE';
  
  if (Math.abs(currentChange) > 30) {
    momentum = 'DECELERATING';
  } else if (Math.abs(currentChange) > 15 && Math.abs(currentChange) < 25) {
    momentum = 'ACCELERATING';
  }
  
  const isOverextended = Math.abs(currentChange) > 40;
  
  let pumpAge: 'FRESH' | 'ACTIVE' | 'EXHAUSTED' | 'UNKNOWN' = 'UNKNOWN';
  if (Math.abs(currentChange) < 10) {
    pumpAge = 'FRESH';
  } else if (Math.abs(currentChange) >= 10 && Math.abs(currentChange) < 30) {
    pumpAge = 'ACTIVE';
  } else if (Math.abs(currentChange) >= 30) {
    pumpAge = 'EXHAUSTED';
  }
  
  return {
    symbol: ticker.symbol,
    currentChange,
    momentum,
    isOverextended,
    pumpAge,
  };
}

export function getPriceScore(analysis: PriceAnalysis): number {
  let score = 0;
  
  if (analysis.pumpAge === 'EXHAUSTED') {
    score += 3;
  } else if (analysis.pumpAge === 'FRESH') {
    score -= 2;
  }
  
  if (analysis.isOverextended) {
    score += 2;
  }
  
  if (analysis.momentum === 'DECELERATING') {
    score += 2;
  } else if (analysis.momentum === 'ACCELERATING') {
    score -= 1;
  }
  
  return score;
}

export function shouldTradeBasedOnTiming(analysis: PriceAnalysis, side: 'LONG' | 'SHORT'): boolean {
  if (side === 'SHORT') {
    if (analysis.pumpAge === 'FRESH') return false;
    if (analysis.pumpAge === 'EXHAUSTED' && analysis.momentum === 'DECELERATING') return true;
    if (analysis.pumpAge === 'ACTIVE' && analysis.currentChange > 20) return true;
  } else {
    if (analysis.pumpAge === 'FRESH' && analysis.currentChange < -5) return false;
    if (analysis.pumpAge === 'EXHAUSTED' && analysis.momentum === 'DECELERATING' && analysis.currentChange < 0) return true;
    if (analysis.pumpAge === 'ACTIVE' && analysis.currentChange < -15) return true;
  }
  
  return true;
}
