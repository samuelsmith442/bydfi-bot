import { fetchKlinesCached, type Kline } from '../api/rest.js';

export interface MAResult {
  value: number;
  period: number;
  dataPoints: number;
  isValid: boolean;
}

/**
 * Calculate Simple Moving Average (SMA)
 * @param symbol - Trading pair symbol
 * @param period - Number of periods for MA (e.g., 20 for MA20)
 * @param interval - Candle interval (e.g., '1h')
 * @returns MA result with validation
 */
export async function calculateSMA(
  symbol: string,
  period: number,
  interval: string = '1h'
): Promise<MAResult> {
  try {
    // Fetch enough klines (period + buffer for safety)
    const klines = await fetchKlinesCached(symbol, interval, period + 5);
    
    if (klines.length < period) {
      return {
        value: 0,
        period,
        dataPoints: klines.length,
        isValid: false
      };
    }
    
    // Take the most recent 'period' candles
    const recentKlines = klines.slice(-period);
    
    // Extract close prices
    const closes = recentKlines.map(k => parseFloat(k.close)).filter(p => p > 0);
    
    if (closes.length < period) {
      return {
        value: 0,
        period,
        dataPoints: closes.length,
        isValid: false
      };
    }
    
    // Calculate SMA
    const sum = closes.reduce((acc, val) => acc + val, 0);
    const sma = sum / closes.length;
    
    return {
      value: sma,
      period,
      dataPoints: closes.length,
      isValid: true
    };
    
  } catch (error: any) {
    console.error(`[MA] Error calculating SMA for ${symbol}:`, error.message);
    return {
      value: 0,
      period,
      dataPoints: 0,
      isValid: false
    };
  }
}

/**
 * Batch calculate MA for multiple symbols
 * Processes in batches to avoid overwhelming the API
 */
export async function calculateSMABatch(
  symbols: string[],
  period: number,
  interval: string = '1h',
  batchSize: number = 10
): Promise<Map<string, MAResult>> {
  const results = new Map<string, MAResult>();
  
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    
    const batchPromises = batch.map(symbol => 
      calculateSMA(symbol, period, interval)
        .then(result => ({ symbol, result }))
    );
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const { symbol, result } of batchResults) {
      results.set(symbol, result);
    }
    
    // Delay between batches to avoid rate limiting
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}
