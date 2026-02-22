import type { Ticker } from '../models/types.js';
import { calculateSMABatch } from '../utils/moving-average.js';

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
  
  return signals.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}
