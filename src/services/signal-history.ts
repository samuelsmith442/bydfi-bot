import type { EarlySignal } from '../strategies/early-entry.js';
import type { TradingSignal } from '../strategies/combined.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SignalHistoryEntry {
  timestamp: string;
  symbol: string;
  type: 'EARLY_LONG' | 'EARLY_SHORT' | 'CONFIRMED_LONG' | 'CONFIRMED_SHORT';
  priceChange: string;
  price: string;
  confidence?: string;
  score?: number;
  triggers?: string[];
  reasons?: string[];
}

const HISTORY_FILE = path.join(__dirname, '../../signal-history.json');
const MAX_HISTORY_ENTRIES = 1000;

let signalHistory: SignalHistoryEntry[] = [];

/**
 * Load signal history from file
 */
export function loadSignalHistory(): void {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      signalHistory = JSON.parse(data);
      console.log(`[HISTORY] Loaded ${signalHistory.length} historical signals`);
    }
  } catch (error) {
    console.error('[HISTORY] Error loading history:', error);
    signalHistory = [];
  }
}

/**
 * Save signal history to file
 */
function saveSignalHistory(): void {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(signalHistory, null, 2));
  } catch (error) {
    console.error('[HISTORY] Error saving history:', error);
  }
}

/**
 * Log early signals to history
 */
export function logEarlySignals(signals: EarlySignal[]): void {
  const timestamp = new Date().toISOString();
  
  signals.forEach(signal => {
    const entry: SignalHistoryEntry = {
      timestamp,
      symbol: signal.symbol,
      type: signal.type,
      priceChange: signal.data.priceChange,
      price: signal.data.lastPrice,
      confidence: signal.confidence,
      triggers: signal.triggers,
    };
    
    signalHistory.push(entry);
    console.log(`[HISTORY] Logged early signal: ${signal.symbol} (${signal.type}) at ${signal.data.priceChange}%`);
  });
  
  // Keep only recent entries
  if (signalHistory.length > MAX_HISTORY_ENTRIES) {
    signalHistory = signalHistory.slice(-MAX_HISTORY_ENTRIES);
  }
  
  saveSignalHistory();
}

/**
 * Log confirmed signals to history
 */
export function logConfirmedSignals(signals: TradingSignal[]): void {
  const timestamp = new Date().toISOString();
  
  signals.forEach(signal => {
    const entry: SignalHistoryEntry = {
      timestamp,
      symbol: signal.symbol,
      type: signal.score > 0 ? 'CONFIRMED_LONG' : 'CONFIRMED_SHORT',
      priceChange: signal.data.priceChange,
      price: signal.data.lastPrice,
      score: signal.score,
      reasons: signal.reasons,
    };
    
    signalHistory.push(entry);
  });
  
  // Keep only recent entries
  if (signalHistory.length > MAX_HISTORY_ENTRIES) {
    signalHistory = signalHistory.slice(-MAX_HISTORY_ENTRIES);
  }
  
  saveSignalHistory();
}

/**
 * Check if a symbol appeared in early signals before confirmed
 */
export function wasInEarlySignals(symbol: string, hoursAgo: number = 24): boolean {
  const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  
  return signalHistory.some(entry => 
    entry.symbol === symbol &&
    (entry.type === 'EARLY_LONG' || entry.type === 'EARLY_SHORT') &&
    new Date(entry.timestamp) > cutoffTime
  );
}

/**
 * Get signal progression for a symbol
 */
export function getSignalProgression(symbol: string, hoursAgo: number = 24): SignalHistoryEntry[] {
  const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  
  return signalHistory
    .filter(entry => 
      entry.symbol === symbol &&
      new Date(entry.timestamp) > cutoffTime
    )
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Search for specific symbols in history
 */
export function searchSymbols(symbols: string[], hoursAgo: number = 24): Map<string, SignalHistoryEntry[]> {
  const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  const results = new Map<string, SignalHistoryEntry[]>();
  
  symbols.forEach(symbol => {
    // Normalize symbol - add -USDT if not present
    const normalizedSymbol = symbol.toUpperCase().includes('-USDT') 
      ? symbol.toUpperCase() 
      : `${symbol.toUpperCase()}-USDT`;
    
    const entries = signalHistory.filter(entry => 
      entry.symbol.toUpperCase() === normalizedSymbol &&
      new Date(entry.timestamp) > cutoffTime
    );
    
    if (entries.length > 0) {
      results.set(normalizedSymbol, entries);
    }
  });
  
  return results;
}

/**
 * Print signal progression report
 */
export function printSignalReport(symbols: string[]): void {
  console.log('\n' + '='.repeat(70));
  console.log('📊 SIGNAL PROGRESSION REPORT');
  console.log('='.repeat(70));
  
  const results = searchSymbols(symbols, 24);
  
  if (results.size === 0) {
    console.log(`\n❌ No signals found for: ${symbols.join(', ')}`);
    console.log('='.repeat(70) + '\n');
    return;
  }
  
  results.forEach((entries, symbol) => {
    console.log(`\n🎯 ${symbol}:`);
    console.log('─'.repeat(70));
    
    const hasEarly = entries.some(e => e.type.includes('EARLY'));
    const hasConfirmed = entries.some(e => e.type.includes('CONFIRMED'));
    
    if (!hasEarly && hasConfirmed) {
      console.log(`  ⚠️  MISSED EARLY ENTRY - Only caught as confirmed signal`);
    }
    
    entries.forEach(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const emoji = entry.type.includes('LONG') ? '📈' : '📉';
      const typeLabel = entry.type.includes('EARLY') ? 'EARLY' : 'CONFIRMED';
      
      console.log(`  ${emoji} ${time} | ${typeLabel} | ${entry.priceChange}% | $${entry.price}`);
      
      if (entry.triggers) {
        console.log(`     Triggers: ${entry.triggers.join(', ')}`);
      }
      if (entry.reasons) {
        console.log(`     Reasons: ${entry.reasons.join(', ')}`);
      }
    });
    
    if (!hasEarly && hasConfirmed) {
      console.log(`  💡 Moved too fast between bot cycles (60 min interval)`);
    }
  });
  
  console.log('\n' + '='.repeat(70) + '\n');
}

// Load history on module initialization
loadSignalHistory();
