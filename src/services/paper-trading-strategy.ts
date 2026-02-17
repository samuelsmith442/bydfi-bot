import { PaperTradingManager } from './paper-trading.js';
import type { TradingSignal } from '../strategies/combined.js';
import type { Ticker } from '../models/types.js';
import { enhanceSignals, filterTradableSignals, getBestSignals } from '../utils/enhanced-scoring.js';

export class PaperTradingStrategy {
  private manager: PaperTradingManager;
  private minEnhancedScore: number;
  private autoTradeEnabled: boolean;

  constructor(manager: PaperTradingManager, minEnhancedScore: number = 6, autoTradeEnabled: boolean = true) {
    this.manager = manager;
    this.minEnhancedScore = minEnhancedScore;
    this.autoTradeEnabled = autoTradeEnabled;
  }

  public processConfirmedSignals(signals: TradingSignal[], tickers: Ticker[]): void {
    if (!this.autoTradeEnabled) return;

    const priceMap = new Map<string, number>();
    for (const ticker of tickers) {
      priceMap.set(ticker.symbol, parseFloat(ticker.lastPrice));
    }

    this.manager.updatePositions(priceMap);

    const enhancedSignals = enhanceSignals(signals, tickers);
    const tradableSignals = filterTradableSignals(enhancedSignals, this.minEnhancedScore);
    const bestSignals = getBestSignals(tradableSignals, 3);

    console.log(`[PAPER STRATEGY] 📊 Enhanced Analysis: ${enhancedSignals.length} signals analyzed`);
    console.log(`[PAPER STRATEGY]    Tradable: ${tradableSignals.length} | Best: ${bestSignals.length}`);

    for (const signal of bestSignals) {
      const currentPrice = priceMap.get(signal.symbol);
      if (!currentPrice) continue;

      const side = signal.score > 0 ? 'LONG' : 'SHORT';
      const priceChangePercent = parseFloat(signal.data.priceChange);
      
      console.log(`[PAPER STRATEGY] ${side === 'SHORT' ? '📉' : '📈'} ${signal.tradingRecommendation}: ${signal.symbol}`);
      console.log(`[PAPER STRATEGY]    Price: $${currentPrice.toFixed(4)} (${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)`);
      console.log(`[PAPER STRATEGY]    Base Score: ${signal.score} → Enhanced: ${signal.enhancedScore}`);
      console.log(`[PAPER STRATEGY]    Volume: ${signal.volumeTrend} | Momentum: ${signal.priceMomentum} | Age: ${signal.pumpAge}`);
      console.log(`[PAPER STRATEGY]    Confidence: ${signal.confidenceLevel}% | Exhaustion: ${signal.isExhaustion ? 'YES' : 'NO'}`);
      
      if (side === 'SHORT' && priceChangePercent > 0) {
        console.log(`[PAPER STRATEGY]    ✅ Opening SHORT - Exhaustion play on +${priceChangePercent.toFixed(2)}% pump`);
        this.manager.openPosition(signal.symbol, 'SHORT', currentPrice);
      } else if (side === 'LONG' && priceChangePercent < 0) {
        console.log(`[PAPER STRATEGY]    ✅ Opening LONG - Bounce play on ${priceChangePercent.toFixed(2)}% dip`);
        this.manager.openPosition(signal.symbol, 'LONG', currentPrice);
      } else {
        console.log(`[PAPER STRATEGY]    ⏸️  Skipped - Price direction doesn't match strategy`);
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
