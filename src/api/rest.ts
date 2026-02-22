import axios from 'axios';
import type { Ticker } from '../models/types.js';

const BASE_URL = 'https://api.bydfi.com/api';

export async function fetchTickers(): Promise<Ticker[]> {
  const response = await axios.get(`${BASE_URL}/v1/swap/market/ticker/24hr`);
  
  console.log('[API] Response status:', response.status);
  console.log('[API] Response data type:', typeof response.data);
  console.log('[API] Is array?:', Array.isArray(response.data));
  
  // Handle different response structures
  let tickerData: any[] = [];
  
  if (Array.isArray(response.data)) {
    tickerData = response.data;
    console.log('[API] Response is array with', response.data.length, 'items');
  } else if (response.data && typeof response.data === 'object') {
    // Check if data is wrapped in a property like 'data', 'result', etc.
    if (Array.isArray(response.data.data)) {
      tickerData = response.data.data;
      console.log('[API] Found data in response.data.data');
    } else if (Array.isArray(response.data.result)) {
      tickerData = response.data.result;
      console.log('[API] Found data in response.data.result');
    } else {
      // Response is an object - convert values to array
      tickerData = Object.values(response.data);
      console.log('[API] Response is object, converted to array with', tickerData.length, 'items');
    }
  }
  
  console.log('[API] Ticker data length:', tickerData.length);
  
  if (tickerData.length === 0) {
    return [];
  }
  
  const tickers = tickerData.map((ticker: any) => {
    const mapped = {
      symbol: ticker.symbol || '',
      lastPrice: (ticker.last || '0').toString(),
      volume24h: (ticker.vol || '0').toString(),
      priceChangePercent: calculatePriceChange(ticker.open, ticker.last),
    };
    return mapped;
  });
  
  console.log('[API] Sample symbols:', tickers.slice(0, 3).map(t => t.symbol));
  
  return tickers;
}

function calculatePriceChange(open: string, last: string): string {
  const openPrice = parseFloat(open || '0');
  const lastPrice = parseFloat(last || '0');
  if (openPrice === 0) return '0';
  return (((lastPrice - openPrice) / openPrice) * 100).toFixed(2);
}

// Kline data type definition
export interface Kline {
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

/**
 * Fetch historical kline/candlestick data
 * @param symbol - Trading pair symbol (e.g., 'BTCUSDT')
 * @param interval - Candle interval ('1m', '5m', '15m', '1h', '4h', '1d')
 * @param limit - Number of candles to fetch (default: 100)
 * @returns Array of kline data
 */
export async function fetchKlines(
  symbol: string,
  interval: string = '1m',
  limit: number = 100
): Promise<Kline[]> {
  try {
    const endTime = Date.now();
    const startTime = endTime - (limit * getIntervalMs(interval));
    
    const response = await axios.get(`${BASE_URL}/v1/swap/market/klines`, {
      params: { symbol, interval, startTime, endTime }
    });
    
    // API returns: { code, message, data: [...], success }
    if (!response.data?.data || !Array.isArray(response.data.data)) {
      console.warn(`[API] Unexpected klines format for ${symbol}`);
      return [];
    }
    
    // Convert API format to Kline objects
    // API format: { s: symbol, t: timestamp, o: open, h: high, l: low, c: close, v: volume }
    const klines: Kline[] = response.data.data.map((item: any) => ({
      timestamp: parseInt(item.t),
      open: item.o?.toString() || '0',
      high: item.h?.toString() || '0',
      low: item.l?.toString() || '0',
      close: item.c?.toString() || '0',
      volume: item.v?.toString() || '0'
    }));
    
    return klines;
    
  } catch (error: any) {
    console.error(`[API] Error fetching klines for ${symbol}:`, error.message);
    return [];
  }
}

// Helper to convert interval string to milliseconds
function getIntervalMs(interval: string): number {
  const unit = interval.slice(-1);
  const value = parseInt(interval.slice(0, -1)) || 1;
  
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 60 * 1000; // Default to 1 minute
  }
}

// Cached version to reduce API calls
const klinesCache = new Map<string, { data: Kline[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchKlinesCached(
  symbol: string,
  interval: string = '1m',
  limit: number = 100
): Promise<Kline[]> {
  const cacheKey = `${symbol}_${interval}_${limit}`;
  const cached = klinesCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchKlines(symbol, interval, limit);
  
  if (data.length > 0) {
    klinesCache.set(cacheKey, { data, timestamp: Date.now() });
  }
  
  return data;
}
