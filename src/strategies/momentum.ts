import type { Ticker } from '../models/types.js';

export interface MomentumSignal {
  symbol: string;
  priceChange: number;
  strength: 'strong' | 'moderate' | 'weak';
}

export function detectMomentum(tickers: Ticker[], minChange: number = 5): MomentumSignal[] {
  return tickers
    .map(t => {
      const priceChange = parseFloat(t.priceChangePercent);
      let strength: 'strong' | 'moderate' | 'weak' = 'weak';
      
      if (Math.abs(priceChange) >= 10) {
        strength = 'strong';
      } else if (Math.abs(priceChange) >= 5) {
        strength = 'moderate';
      }
      
      return {
        symbol: t.symbol,
        priceChange,
        strength,
      };
    })
    .filter(signal => Math.abs(signal.priceChange) >= minChange);
}

export function detectBullishMomentum(tickers: Ticker[], minChange: number = 3): Ticker[] {
  return tickers.filter(t => parseFloat(t.priceChangePercent) >= minChange);
}

export function detectBearishMomentum(tickers: Ticker[], minChange: number = 3): Ticker[] {
  return tickers.filter(t => parseFloat(t.priceChangePercent) <= -minChange);
}
