import type { Ticker } from '../models/types.js';

export interface EarlySignal {
  symbol: string;
  type: 'EARLY_LONG' | 'EARLY_SHORT';
  confidence: 'high' | 'medium' | 'low';
  triggers: string[];
  score: number;
  data: {
    volume24h: string;
    priceChange: string;
    lastPrice: string;
  };
}

/**
 * Early detection strategy - catches moves BEFORE they reach +10%
 * Uses leading indicators:
 * 1. Volume acceleration (volume increasing faster than price)
 * 2. Small price breakouts (2-5% moves with volume)
 * 3. Momentum building (consistent small gains)
 */
export function detectEarlyEntries(tickers: Ticker[]): EarlySignal[] {
  const signals: EarlySignal[] = [];
  
  // Calculate average volume across all tickers for comparison
  const totalVolume = tickers.reduce((sum, t) => sum + parseFloat(t.volume24h), 0);
  const avgVolume = totalVolume / tickers.length;
  
  tickers.forEach(ticker => {
    const priceChange = parseFloat(ticker.priceChangePercent);
    const volume = parseFloat(ticker.volume24h);
    const volumeRatio = volume / avgVolume;
    
    const triggers: string[] = [];
    let score = 0;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    // BULLISH EARLY SIGNALS
    if (priceChange > 0) {
      // 1. Volume Surge with Small Price Move (2-5%)
      // This catches accumulation before breakout
      if (priceChange >= 2 && priceChange < 5 && volumeRatio > 2.5) {
        triggers.push(`Volume surge ${volumeRatio.toFixed(1)}x avg with early +${priceChange.toFixed(2)}% move`);
        score += 4;
        confidence = 'high';
      }
      
      // 2. Moderate Volume with Consistent Small Gains (1-3%)
      // Building momentum
      if (priceChange >= 1 && priceChange < 3 && volumeRatio > 1.8) {
        triggers.push(`Building momentum +${priceChange.toFixed(2)}% on ${volumeRatio.toFixed(1)}x volume`);
        score += 3;
        confidence = confidence === 'high' ? 'high' : 'medium';
      }
      
      // 3. Breakout Pattern (5-9% with strong volume)
      // Early stage of bigger move
      if (priceChange >= 5 && priceChange < 10 && volumeRatio > 2) {
        triggers.push(`Early breakout +${priceChange.toFixed(2)}% with strong volume`);
        score += 5;
        confidence = 'high';
      }
      
      // 4. Extreme Volume (potential whale accumulation)
      if (volumeRatio > 4 && priceChange >= 1 && priceChange < 10) {
        triggers.push(`Extreme volume ${volumeRatio.toFixed(1)}x - possible accumulation`);
        score += 3;
        confidence = 'high';
      }
      
      if (triggers.length > 0) {
        signals.push({
          symbol: ticker.symbol,
          type: 'EARLY_LONG',
          confidence,
          triggers,
          score,
          data: {
            volume24h: ticker.volume24h,
            priceChange: ticker.priceChangePercent,
            lastPrice: ticker.lastPrice,
          },
        });
      }
    }
    
    // BEARISH EARLY SIGNALS
    else if (priceChange < 0) {
      const absChange = Math.abs(priceChange);
      
      // 1. Volume Surge with Small Price Drop (-2% to -5%)
      if (absChange >= 2 && absChange < 5 && volumeRatio > 2.5) {
        triggers.push(`Volume surge ${volumeRatio.toFixed(1)}x avg with early -${absChange.toFixed(2)}% drop`);
        score -= 4;
        confidence = 'high';
      }
      
      // 2. Building Downward Momentum (-1% to -3%)
      if (absChange >= 1 && absChange < 3 && volumeRatio > 1.8) {
        triggers.push(`Building bearish momentum -${absChange.toFixed(2)}% on ${volumeRatio.toFixed(1)}x volume`);
        score -= 3;
        confidence = confidence === 'high' ? 'high' : 'medium';
      }
      
      // 3. Early Breakdown (-5% to -9%)
      if (absChange >= 5 && absChange < 10 && volumeRatio > 2) {
        triggers.push(`Early breakdown -${absChange.toFixed(2)}% with strong volume`);
        score -= 5;
        confidence = 'high';
      }
      
      // 4. Extreme Volume (potential whale distribution)
      if (volumeRatio > 4 && absChange >= 1 && absChange < 10) {
        triggers.push(`Extreme volume ${volumeRatio.toFixed(1)}x - possible distribution`);
        score -= 3;
        confidence = 'high';
      }
      
      if (triggers.length > 0) {
        signals.push({
          symbol: ticker.symbol,
          type: 'EARLY_SHORT',
          confidence,
          triggers,
          score,
          data: {
            volume24h: ticker.volume24h,
            priceChange: ticker.priceChangePercent,
            lastPrice: ticker.lastPrice,
          },
        });
      }
    }
  });
  
  // Sort by absolute score (highest confidence first)
  return signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
}

/**
 * Filter for high-confidence early signals only
 */
export function getHighConfidenceEarlySignals(signals: EarlySignal[]): EarlySignal[] {
  return signals.filter(s => s.confidence === 'high');
}
