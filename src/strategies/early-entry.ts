import type { Ticker } from '../models/types.js';
import { calculateAdaptiveMACD } from '../utils/adaptive-macd.js';

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
 * 4. Adaptive MACD+ confirmation (async enrichment on top candidates)
 */
function detectEarlyEntriesSync(tickers: Ticker[]): EarlySignal[] {
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
      // 1. Strong volume surge with small price move (2-5%) — high confidence
      if (priceChange >= 2 && priceChange < 5 && volumeRatio > 2.0) {
        triggers.push(`Volume surge ${volumeRatio.toFixed(1)}x avg with early +${priceChange.toFixed(2)}% move`);
        score += 4;
        confidence = 'high';
      }

      // 2. Moderate volume with small gains (1-3%) — medium confidence
      if (priceChange >= 1 && priceChange < 3 && volumeRatio > 1.5) {
        triggers.push(`Building momentum +${priceChange.toFixed(2)}% on ${volumeRatio.toFixed(1)}x volume`);
        score += 3;
        confidence = confidence === 'high' ? 'high' : 'medium';
      }

      // 3. Breakout pattern (5-9% with volume) — high confidence
      if (priceChange >= 5 && priceChange < 10 && volumeRatio > 1.5) {
        triggers.push(`Early breakout +${priceChange.toFixed(2)}% with strong volume`);
        score += 5;
        confidence = 'high';
      }

      // 4. Extreme volume — whale accumulation signal
      if (volumeRatio > 3 && priceChange >= 1 && priceChange < 10) {
        triggers.push(`Extreme volume ${volumeRatio.toFixed(1)}x - possible accumulation`);
        score += 3;
        confidence = 'high';
      }

      // 5. Quiet market catch-all: any move ≥1% with above-average volume
      if (priceChange >= 1 && volumeRatio > 1.2 && triggers.length === 0) {
        triggers.push(`Above-avg volume ${volumeRatio.toFixed(1)}x on +${priceChange.toFixed(2)}% move`);
        score += 2;
        confidence = 'medium';
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

      // 1. Strong volume surge with small drop (-2% to -5%) — high confidence
      if (absChange >= 2 && absChange < 5 && volumeRatio > 2.0) {
        triggers.push(`Volume surge ${volumeRatio.toFixed(1)}x avg with early -${absChange.toFixed(2)}% drop`);
        score -= 4;
        confidence = 'high';
      }

      // 2. Building downward momentum (-1% to -3%) — medium confidence
      if (absChange >= 1 && absChange < 3 && volumeRatio > 1.5) {
        triggers.push(`Building bearish momentum -${absChange.toFixed(2)}% on ${volumeRatio.toFixed(1)}x volume`);
        score -= 3;
        confidence = confidence === 'high' ? 'high' : 'medium';
      }

      // 3. Early breakdown (-5% to -9%) — high confidence
      if (absChange >= 5 && absChange < 10 && volumeRatio > 1.5) {
        triggers.push(`Early breakdown -${absChange.toFixed(2)}% with strong volume`);
        score -= 5;
        confidence = 'high';
      }

      // 4. Extreme volume — whale distribution signal
      if (volumeRatio > 3 && absChange >= 1 && absChange < 10) {
        triggers.push(`Extreme volume ${volumeRatio.toFixed(1)}x - possible distribution`);
        score -= 3;
        confidence = 'high';
      }

      // 5. Quiet market catch-all: any drop ≥1% with above-average volume
      if (absChange >= 1 && volumeRatio > 1.2 && triggers.length === 0) {
        triggers.push(`Above-avg volume ${volumeRatio.toFixed(1)}x on -${absChange.toFixed(2)}% drop`);
        score -= 2;
        confidence = 'medium';
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
 * Enrich top early signals with Adaptive MACD+ confirmation.
 * - bullCross on LONG  → upgrades medium→high, +2 score
 * - bearCross on SHORT → upgrades medium→high, -2 score
 * - histogram confirms direction → +1 / -1 score
 * - MACD contradicts direction → downgrades high→medium, removes 1 score point
 * Only checks top N signals to limit API calls.
 */
async function enrichWithAdaptiveMACD(
  signals: EarlySignal[],
  interval: string = '1h',
  topN: number = 10
): Promise<EarlySignal[]> {
  const candidates = signals.slice(0, topN);
  const rest       = signals.slice(topN);

  const enriched = await Promise.all(
    candidates.map(async signal => {
      try {
        const macd = await calculateAdaptiveMACD(signal.symbol, { interval, limit: 200 });
        if (!macd.isValid) return signal;

        const isLong  = signal.type === 'EARLY_LONG';
        const isShort = signal.type === 'EARLY_SHORT';

        let { score, confidence, triggers } = signal;

        // ── Crossover confirmation ────────────────────────────────────────
        if (isLong && macd.bullCross) {
          triggers = [...triggers, `Adaptive MACD bull cross (${macd.bestFast}/${macd.bestSlow})` ];
          score   += 2;
          if (confidence === 'medium') confidence = 'high';
        } else if (isShort && macd.bearCross) {
          triggers = [...triggers, `Adaptive MACD bear cross (${macd.bestFast}/${macd.bestSlow})` ];
          score   -= 2;
          if (confidence === 'medium') confidence = 'high';
        }

        // ── Histogram momentum confirmation ───────────────────────────────
        if (isLong && macd.histogram > 0) {
          triggers = [...triggers, `MACD histogram bullish (${macd.histogram.toFixed(4)})` ];
          score   += 1;
        } else if (isShort && macd.histogram < 0) {
          triggers = [...triggers, `MACD histogram bearish (${macd.histogram.toFixed(4)})` ];
          score   -= 1;
        }

        // ── Contradiction — MACD opposes the signal direction ─────────────
        if (isLong && macd.bearCross) {
          triggers = [...triggers, `⚠️ MACD bear cross opposes long` ];
          score   -= 1;
          if (confidence === 'high') confidence = 'medium';
        } else if (isShort && macd.bullCross) {
          triggers = [...triggers, `⚠️ MACD bull cross opposes short` ];
          score   += 1;
          if (confidence === 'high') confidence = 'medium';
        }

        return { ...signal, score, confidence, triggers };
      } catch {
        return signal;
      }
    })
  );

  return [...enriched, ...rest].sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
}

/**
 * Async version — runs volume/price detection then enriches top signals
 * with Adaptive MACD+ confirmation. Use this in index.ts.
 */
export async function detectEarlyEntries(
  tickers: Ticker[],
  options: { macdInterval?: string; macdTopN?: number; skipMACD?: boolean } = {}
): Promise<EarlySignal[]> {
  const { macdInterval = '1h', macdTopN = 10, skipMACD = false } = options;
  const raw = detectEarlyEntriesSync(tickers);
  if (skipMACD || raw.length === 0) return raw;
  return enrichWithAdaptiveMACD(raw, macdInterval, macdTopN);
}

/**
 * Filter for high-confidence early signals only
 */
export function getHighConfidenceEarlySignals(signals: EarlySignal[]): EarlySignal[] {
  return signals.filter(s => s.confidence === 'high');
}
