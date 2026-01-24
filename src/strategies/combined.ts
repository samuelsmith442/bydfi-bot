import type { Ticker } from '../models/types.js';
import { detectVolumeSpikes } from './volume.js';
import { detectMomentum, type MomentumSignal } from './momentum.js';

export interface TradingSignal {
  symbol: string;
  type: 'STRONG_BUY' | 'BUY' | 'STRONG_SELL' | 'SELL' | 'NEUTRAL';
  reasons: string[];
  score: number;
  data: {
    volume24h: string;
    priceChange: string;
    lastPrice: string;
  };
}

export function generateCombinedSignals(tickers: Ticker[]): TradingSignal[] {
  const volumeSpikes = detectVolumeSpikes(tickers, 2.5);
  const momentumSignals = detectMomentum(tickers, 3);
  
  const signals: TradingSignal[] = [];
  
  tickers.forEach(ticker => {
    const hasVolumeSpike = volumeSpikes.some(v => v.symbol === ticker.symbol);
    const momentumSignal = momentumSignals.find(m => m.symbol === ticker.symbol);
    
    const reasons: string[] = [];
    let score = 0;
    
    if (hasVolumeSpike) {
      reasons.push('High volume spike detected');
      score += 3;
    }
    
    if (momentumSignal) {
      const priceChange = momentumSignal.priceChange;
      
      if (priceChange > 0) {
        if (momentumSignal.strength === 'strong') {
          reasons.push(`Strong bullish momentum (+${priceChange.toFixed(2)}%)`);
          score += 5;
        } else if (momentumSignal.strength === 'moderate') {
          reasons.push(`Moderate bullish momentum (+${priceChange.toFixed(2)}%)`);
          score += 3;
        }
      } else {
        if (momentumSignal.strength === 'strong') {
          reasons.push(`Strong bearish momentum (${priceChange.toFixed(2)}%)`);
          score -= 5;
        } else if (momentumSignal.strength === 'moderate') {
          reasons.push(`Moderate bearish momentum (${priceChange.toFixed(2)}%)`);
          score -= 3;
        }
      }
    }
    
    if (reasons.length === 0) {
      return;
    }
    
    let type: TradingSignal['type'] = 'NEUTRAL';
    if (score >= 6) {
      type = 'STRONG_BUY';
    } else if (score >= 3) {
      type = 'BUY';
    } else if (score <= -6) {
      type = 'STRONG_SELL';
    } else if (score <= -3) {
      type = 'SELL';
    }
    
    signals.push({
      symbol: ticker.symbol,
      type,
      reasons,
      score,
      data: {
        volume24h: ticker.volume24h,
        priceChange: ticker.priceChangePercent,
        lastPrice: ticker.lastPrice,
      },
    });
  });
  
  return signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
}
