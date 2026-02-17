import type { Ticker } from '../models/types.js';

export interface VolumeAnalysis {
  symbol: string;
  currentVolume: number;
  averageVolume: number;
  volumeRatio: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  isExhaustion: boolean;
}

export function analyzeVolumeTrend(ticker: Ticker, allTickers: Ticker[]): VolumeAnalysis {
  const currentVolume = parseFloat(ticker.volume24h);
  
  const similarTickers = allTickers
    .filter(t => t.symbol !== ticker.symbol)
    .map(t => parseFloat(t.volume24h))
    .sort((a, b) => b - a);
  
  const medianVolume = similarTickers[Math.floor(similarTickers.length / 2)] || currentVolume;
  const averageVolume = medianVolume;
  
  const volumeRatio = currentVolume / averageVolume;
  
  let trend: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
  const priceChange = parseFloat(ticker.priceChangePercent);
  
  if (volumeRatio > 3.0) {
    trend = 'INCREASING';
  } else if (volumeRatio < 1.5 && Math.abs(priceChange) > 5) {
    trend = 'DECREASING';
  }
  
  const isExhaustion = trend === 'DECREASING' && Math.abs(priceChange) > 10;
  
  return {
    symbol: ticker.symbol,
    currentVolume,
    averageVolume,
    volumeRatio,
    trend,
    isExhaustion,
  };
}

export function getVolumeScore(analysis: VolumeAnalysis, priceChange: number): number {
  let score = 0;
  
  if (priceChange > 0) {
    if (analysis.trend === 'DECREASING' && priceChange > 15) {
      score += 3;
    } else if (analysis.trend === 'INCREASING' && priceChange > 20) {
      score -= 2;
    }
  } else {
    if (analysis.trend === 'DECREASING' && priceChange < -15) {
      score += 3;
    } else if (analysis.trend === 'INCREASING' && priceChange < -20) {
      score -= 2;
    }
  }
  
  if (analysis.isExhaustion) {
    score += 2;
  }
  
  if (analysis.volumeRatio > 5) {
    score += 1;
  }
  
  return score;
}
