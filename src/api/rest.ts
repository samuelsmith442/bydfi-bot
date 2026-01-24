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

export async function fetchKlines(symbol: string, interval: string = '1m'): Promise<any[]> {
  const response = await axios.get(`${BASE_URL}/v1/swap/market/klines`, {
    params: { symbol, interval },
  });
  return Array.isArray(response.data) ? response.data : [];
}
