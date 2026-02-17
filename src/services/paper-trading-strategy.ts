import { PaperTradingManager } from './paper-trading.js';
import type { TradingSignal } from '../strategies/combined.js';
import type { Ticker } from '../models/types.js';

export class PaperTradingStrategy {
  private manager: PaperTradingManager;
  private minConfirmedScore: number;
  private autoTradeEnabled: boolean;

  constructor(manager: PaperTradingManager, minConfirmedScore: number = 4, autoTradeEnabled: boolean = true) {
    this.manager = manager;
    this.minConfirmedScore = minConfirmedScore;
    this.autoTradeEnabled = autoTradeEnabled;
  }

  public processConfirmedSignals(signals: TradingSignal[], tickers: Ticker[]): void {
    if (!this.autoTradeEnabled) return;

    const priceMap = new Map<string, number>();
    for (const ticker of tickers) {
      priceMap.set(ticker.symbol, parseFloat(ticker.lastPrice));
    }

    this.manager.updatePositions(priceMap);

    for (const signal of signals) {
      if (Math.abs(signal.score) < this.minConfirmedScore) continue;

      const currentPrice = priceMap.get(signal.symbol);
      if (!currentPrice) continue;

      const side = signal.score > 0 ? 'LONG' : 'SHORT';
      
      const priceChangePercent = parseFloat(signal.data.priceChange);
      
      if (side === 'SHORT' && priceChangePercent > 0) {
        console.log(`[PAPER STRATEGY] 📉 Bearish signal detected: ${signal.symbol}`);
        console.log(`[PAPER STRATEGY]    Price: $${currentPrice.toFixed(4)} (+${priceChangePercent.toFixed(2)}%)`);
        console.log(`[PAPER STRATEGY]    Score: ${signal.score}`);
        console.log(`[PAPER STRATEGY]    Reasoning: Price exhaustion expected after ${priceChangePercent.toFixed(2)}% pump`);
        
        this.manager.openPosition(signal.symbol, 'SHORT', currentPrice);
      } else if (side === 'LONG' && priceChangePercent < 0) {
        console.log(`[PAPER STRATEGY] 📈 Bullish signal detected: ${signal.symbol}`);
        console.log(`[PAPER STRATEGY]    Price: $${currentPrice.toFixed(4)} (${priceChangePercent.toFixed(2)}%)`);
        console.log(`[PAPER STRATEGY]    Score: ${signal.score}`);
        
        this.manager.openPosition(signal.symbol, 'LONG', currentPrice);
      }
    }
  }

  public setAutoTrade(enabled: boolean): void {
    this.autoTradeEnabled = enabled;
    console.log(`[PAPER STRATEGY] Auto-trading ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  public getManager(): PaperTradingManager {
    return this.manager;
  }
}
