import type { Ticker } from '../models/types.js';
import { calculateSMABatch } from '../utils/moving-average.js';
import { calculateAdaptiveMACD } from '../utils/adaptive-macd.js';

export interface MeanReversionSignal {
  symbol: string;
  type: 'MEAN_REVERSION_LONG' | 'MEAN_REVERSION_SHORT';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  currentPrice: number;
  ma20: number;
  deviation: number;
  reasons: string[];
  data: {
    volume24h: string;
    priceChange: string;
    lastPrice: string;
  };
}

const CONFIG = {
  maPeriod: 20,
  buyDeviation: -5,
  sellDeviation: 5,
  highConfidenceThreshold: 8,
  minVolume: 100000
};

export async function detectMeanReversion(tickers: Ticker[]): Promise<MeanReversionSignal[]> {
  const signals: MeanReversionSignal[] = [];
  
  // Filter tickers by minimum volume and sort by volume (highest first)
  const validTickers = tickers
    .filter(t => parseFloat(t.volume24h) >= CONFIG.minVolume)
    .sort((a, b) => parseFloat(b.volume24h) - parseFloat(a.volume24h))
    .slice(0, 20); // Limit to top 20 by volume to avoid rate limits
  
  console.log(`[MEAN_REVERSION] Analyzing top ${validTickers.length} tickers by volume (min: $${CONFIG.minVolume})`);
  
  // Batch calculate MAs with smaller batches and longer delays
  const symbols = validTickers.map(t => t.symbol);
  const maResults = await calculateSMABatch(symbols, CONFIG.maPeriod, '1h', 5);
  
  // Generate signals
  for (const ticker of validTickers) {
    const maResult = maResults.get(ticker.symbol);
    
    if (!maResult || !maResult.isValid) {
      continue; // Skip if MA calculation failed
    }
    
    const currentPrice = parseFloat(ticker.lastPrice);
    const ma = maResult.value;
    const deviation = ((currentPrice - ma) / ma) * 100;
    
    const reasons: string[] = [];
    let type: 'MEAN_REVERSION_LONG' | 'MEAN_REVERSION_SHORT' | null = null;
    let score = 0;
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    
    // LONG: Price below MA (oversold)
    if (deviation <= CONFIG.buyDeviation) {
      type = 'MEAN_REVERSION_LONG';
      const absDeviation = Math.abs(deviation);
      
      if (absDeviation >= CONFIG.highConfidenceThreshold) {
        confidence = 'HIGH';
        score = 5;
        reasons.push(`Price ${deviation.toFixed(2)}% below MA${CONFIG.maPeriod} - Strong oversold`);
      } else {
        confidence = 'MEDIUM';
        score = 3;
        reasons.push(`Price ${deviation.toFixed(2)}% below MA${CONFIG.maPeriod} - Oversold`);
      }
      
      reasons.push(`MA${CONFIG.maPeriod}: $${ma.toFixed(4)}`);
      reasons.push(`Expected reversion to mean`);
    }
    
    // SHORT: Price above MA (overbought)
    else if (deviation >= CONFIG.sellDeviation) {
      type = 'MEAN_REVERSION_SHORT';
      
      if (deviation >= CONFIG.highConfidenceThreshold) {
        confidence = 'HIGH';
        score = -5;
        reasons.push(`Price ${deviation.toFixed(2)}% above MA${CONFIG.maPeriod} - Strong overbought`);
      } else {
        confidence = 'MEDIUM';
        score = -3;
        reasons.push(`Price ${deviation.toFixed(2)}% above MA${CONFIG.maPeriod} - Overbought`);
      }
      
      reasons.push(`MA${CONFIG.maPeriod}: $${ma.toFixed(4)}`);
      reasons.push(`Expected reversion to mean`);
    }
    
    if (type) {
      signals.push({
        symbol: ticker.symbol,
        type,
        confidence,
        score,
        currentPrice,
        ma20: ma,
        deviation,
        reasons,
        data: {
          volume24h: ticker.volume24h,
          priceChange: ticker.priceChangePercent,
          lastPrice: ticker.lastPrice
        }
      });
    }
  }
  
  console.log(`[MEAN_REVERSION] Generated ${signals.length} signals`);

  if (signals.length === 0) return signals;

  // ── Adaptive MACD confirmation — enrich top 10 by deviation ─────────────
  const topN   = Math.min(10, signals.length);
  const top    = signals.slice(0, topN);
  const rest   = signals.slice(topN);

  const enriched = await Promise.all(
    top.map(async signal => {
      try {
        const macd = await calculateAdaptiveMACD(signal.symbol, { interval: '1h', limit: 200 });
        if (!macd.isValid) return signal;

        const isLong  = signal.type === 'MEAN_REVERSION_LONG';
        const isShort = signal.type === 'MEAN_REVERSION_SHORT';
        let { score, confidence, reasons } = signal;

        // Crossover aligns with reversion direction → strong confirmation
        if (isLong && macd.bullCross) {
          reasons = [...reasons, `Adaptive MACD bull cross (${macd.bestFast}/${macd.bestSlow}) confirms reversal`];
          score  += 2;
          if (confidence === 'LOW') confidence = 'MEDIUM';
          if (confidence === 'MEDIUM') confidence = 'HIGH';
        } else if (isShort && macd.bearCross) {
          reasons = [...reasons, `Adaptive MACD bear cross (${macd.bestFast}/${macd.bestSlow}) confirms reversal`];
          score  -= 2;
          if (confidence === 'LOW') confidence = 'MEDIUM';
          if (confidence === 'MEDIUM') confidence = 'HIGH';
        }

        // Histogram momentum alignment
        if (isLong && macd.histogram > 0) {
          reasons = [...reasons, `MACD histogram bullish — momentum turning up`];
          score  += 1;
        } else if (isShort && macd.histogram < 0) {
          reasons = [...reasons, `MACD histogram bearish — momentum turning down`];
          score  -= 1;
        }

        // MACD contradicts reversion → downgrade confidence
        if (isLong && macd.bearCross) {
          reasons = [...reasons, `⚠️ MACD bear cross — reversion may fail`];
          score  -= 1;
          if (confidence === 'HIGH') confidence = 'MEDIUM';
        } else if (isShort && macd.bullCross) {
          reasons = [...reasons, `⚠️ MACD bull cross — reversion may fail`];
          score  += 1;
          if (confidence === 'HIGH') confidence = 'MEDIUM';
        }

        return { ...signal, score, confidence, reasons };
      } catch {
        return signal;
      }
    })
  );

  return [...enriched, ...rest].sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}
