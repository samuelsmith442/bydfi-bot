import type { Ticker } from '../models/types.js';
import type { TradingSignal } from '../strategies/combined.js';
import { analyzeVolumeTrend, getVolumeScore } from './volume-analysis.js';
import { analyzePriceMomentum, getPriceScore, shouldTradeBasedOnTiming } from './price-analysis.js';

export interface EnhancedSignal extends TradingSignal {
  enhancedScore: number;
  volumeTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  priceMomentum: 'ACCELERATING' | 'DECELERATING' | 'STABLE';
  pumpAge: 'FRESH' | 'ACTIVE' | 'EXHAUSTED' | 'UNKNOWN';
  isExhaustion: boolean;
  tradingRecommendation: 'STRONG_TRADE' | 'TRADE' | 'WAIT' | 'AVOID';
  confidenceLevel: number;
}

export function enhanceSignal(signal: TradingSignal, ticker: Ticker, allTickers: Ticker[]): EnhancedSignal {
  const volumeAnalysis = analyzeVolumeTrend(ticker, allTickers);
  const priceAnalysis = analyzePriceMomentum(ticker);
  
  const priceChange = parseFloat(ticker.priceChangePercent);
  const volumeScore = getVolumeScore(volumeAnalysis, priceChange);
  const priceScore = getPriceScore(priceAnalysis);
  
  const enhancedScore = signal.score + volumeScore + priceScore;
  
  const side = signal.score > 0 ? 'LONG' : 'SHORT';
  const timingOk = shouldTradeBasedOnTiming(priceAnalysis, side);
  
  let tradingRecommendation: 'STRONG_TRADE' | 'TRADE' | 'WAIT' | 'AVOID' = 'WAIT';
  
  if (!timingOk) {
    tradingRecommendation = 'AVOID';
  } else if (Math.abs(enhancedScore) >= 8 && volumeAnalysis.isExhaustion) {
    tradingRecommendation = 'STRONG_TRADE';
  } else if (Math.abs(enhancedScore) >= 6) {
    tradingRecommendation = 'TRADE';
  } else if (Math.abs(enhancedScore) >= 4) {
    tradingRecommendation = 'WAIT';
  } else {
    tradingRecommendation = 'AVOID';
  }
  
  const confidenceLevel = Math.min(100, Math.abs(enhancedScore) * 10);
  
  return {
    ...signal,
    enhancedScore,
    volumeTrend: volumeAnalysis.trend,
    priceMomentum: priceAnalysis.momentum,
    pumpAge: priceAnalysis.pumpAge,
    isExhaustion: volumeAnalysis.isExhaustion,
    tradingRecommendation,
    confidenceLevel,
  };
}

export function enhanceSignals(signals: TradingSignal[], tickers: Ticker[]): EnhancedSignal[] {
  const tickerMap = new Map<string, Ticker>();
  for (const ticker of tickers) {
    tickerMap.set(ticker.symbol, ticker);
  }
  
  return signals
    .map(signal => {
      const ticker = tickerMap.get(signal.symbol);
      if (!ticker) return null;
      return enhanceSignal(signal, ticker, tickers);
    })
    .filter((s): s is EnhancedSignal => s !== null);
}

export function filterTradableSignals(enhancedSignals: EnhancedSignal[], minScore: number = 6): EnhancedSignal[] {
  return enhancedSignals.filter(signal => {
    if (signal.tradingRecommendation === 'AVOID') return false;
    if (Math.abs(signal.enhancedScore) < minScore) return false;
    return true;
  });
}

export function getBestSignals(enhancedSignals: EnhancedSignal[], maxCount: number = 3): EnhancedSignal[] {
  return enhancedSignals
    .filter(s => s.tradingRecommendation === 'STRONG_TRADE' || s.tradingRecommendation === 'TRADE')
    .sort((a, b) => Math.abs(b.enhancedScore) - Math.abs(a.enhancedScore))
    .slice(0, maxCount);
}
