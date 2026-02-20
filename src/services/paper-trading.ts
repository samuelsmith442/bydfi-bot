import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PaperTradingConfig, Position, Trade, PaperAccount } from '../models/paper-trading-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAPER_ACCOUNT_FILE = path.join(__dirname, '../../paper-trading-account.json');

export class PaperTradingManager {
  private config: PaperTradingConfig;
  private account: PaperAccount;

  constructor(config: PaperTradingConfig) {
    this.config = config;
    this.account = this.loadAccount();
  }

  private loadAccount(): PaperAccount {
    try {
      if (fs.existsSync(PAPER_ACCOUNT_FILE)) {
        const data = fs.readFileSync(PAPER_ACCOUNT_FILE, 'utf-8');
        const saved = JSON.parse(data);
        
        saved.openPositions = saved.openPositions.map((p: any) => ({
          ...p,
          openedAt: new Date(p.openedAt),
          closedAt: p.closedAt ? new Date(p.closedAt) : undefined,
        }));
        
        saved.closedTrades = saved.closedTrades.map((t: any) => ({
          ...t,
          openedAt: new Date(t.openedAt),
          closedAt: new Date(t.closedAt),
        }));
        
        return saved;
      }
    } catch (error) {
      console.error('[PAPER] Error loading account:', error);
    }

    return {
      balance: this.config.initialBalance,
      equity: this.config.initialBalance,
      initialBalance: this.config.initialBalance,
      totalPnL: 0,
      totalPnLPercent: 0,
      openPositions: [],
      closedTrades: [],
      winRate: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      largestWin: 0,
      largestLoss: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
    };
  }

  private saveAccount(): void {
    try {
      fs.writeFileSync(PAPER_ACCOUNT_FILE, JSON.stringify(this.account, null, 2));
    } catch (error) {
      console.error('[PAPER] Error saving account:', error);
    }
  }

  public openPosition(symbol: string, side: 'LONG' | 'SHORT', currentPrice: number): Position | null {
    if (this.account.openPositions.length >= this.config.maxOpenPositions) {
      console.log(`[PAPER] Max positions (${this.config.maxOpenPositions}) reached. Cannot open ${symbol}`);
      return null;
    }

    if (this.account.openPositions.find(p => p.symbol === symbol)) {
      console.log(`[PAPER] Position already open for ${symbol}`);
      return null;
    }

    const riskAmount = this.account.balance * (this.config.riskPercentage / 100);
    const positionSize = riskAmount * this.config.leverage;
    const quantity = positionSize / currentPrice;

    const stopLossPrice = side === 'LONG'
      ? currentPrice * (1 - this.config.stopLossPercentage / 100)
      : currentPrice * (1 + this.config.stopLossPercentage / 100);

    const position: Position = {
      id: uuidv4(),
      symbol,
      side,
      entryPrice: currentPrice,
      currentPrice,
      quantity,
      leverage: this.config.leverage,
      stopLoss: stopLossPrice,
      positionSize,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      openedAt: new Date(),
      status: 'OPEN',
      source: 'BOT',
    };

    if (this.config.takeProfitPercentage) {
      position.takeProfit = side === 'LONG'
        ? currentPrice * (1 + this.config.takeProfitPercentage / 100)
        : currentPrice * (1 - this.config.takeProfitPercentage / 100);
    }

    this.account.openPositions.push(position);
    this.account.balance -= riskAmount;
    this.saveAccount();

    console.log(`[PAPER] 🔓 Opened ${side} position: ${symbol} @ $${currentPrice.toFixed(4)}`);
    console.log(`[PAPER]    Position size: $${positionSize.toFixed(2)} (${this.config.leverage}x leverage)`);
    console.log(`[PAPER]    Stop loss: $${stopLossPrice.toFixed(4)} (${this.config.stopLossPercentage}%)`);
    if (position.takeProfit) {
      console.log(`[PAPER]    Take profit: $${position.takeProfit.toFixed(4)}`);
    }

    return position;
  }

  public openManualPosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    entryPrice: number,
    stopLoss: number,
    takeProfit?: number,
    notes?: string
  ): Position | null {
    if (this.account.openPositions.length >= this.config.maxOpenPositions) {
      console.log(`[PAPER] Max positions (${this.config.maxOpenPositions}) reached. Cannot open ${symbol}`);
      return null;
    }

    if (this.account.openPositions.find(p => p.symbol === symbol)) {
      console.log(`[PAPER] Position already open for ${symbol}`);
      return null;
    }

    const riskAmount = this.account.balance * (this.config.riskPercentage / 100);
    const positionSize = riskAmount * this.config.leverage;
    const quantity = positionSize / entryPrice;

    const position: Position = {
      id: uuidv4(),
      symbol: symbol.toUpperCase(),
      side,
      entryPrice,
      currentPrice: entryPrice,
      quantity,
      leverage: this.config.leverage,
      stopLoss,
      positionSize,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      openedAt: new Date(),
      status: 'OPEN',
      source: 'MANUAL',
    };

    if (takeProfit) position.takeProfit = takeProfit;
    if (notes) position.notes = notes;

    this.account.openPositions.push(position);
    this.account.balance -= riskAmount;
    this.saveAccount();

    console.log(`[PAPER] 🖊️  Opened MANUAL ${side} position: ${symbol} @ $${entryPrice}`);
    console.log(`[PAPER]    Size: $${positionSize.toFixed(2)} | SL: $${stopLoss}${takeProfit ? ` | TP: $${takeProfit}` : ''}`);

    return position;
  }

  public updatePositions(prices: Map<string, number>): void {
    let hasChanges = false;

    for (const position of this.account.openPositions) {
      const currentPrice = prices.get(position.symbol);
      if (!currentPrice) continue;

      position.currentPrice = currentPrice;

      const priceChange = position.side === 'LONG'
        ? (currentPrice - position.entryPrice) / position.entryPrice
        : (position.entryPrice - currentPrice) / position.entryPrice;

      position.unrealizedPnL = priceChange * position.positionSize;
      position.unrealizedPnLPercent = priceChange * 100 * position.leverage;

      const shouldStopLoss = position.side === 'LONG'
        ? currentPrice <= position.stopLoss
        : currentPrice >= position.stopLoss;

      const shouldTakeProfit = position.takeProfit
        ? position.side === 'LONG'
          ? currentPrice >= position.takeProfit
          : currentPrice <= position.takeProfit
        : false;

      if (shouldStopLoss) {
        this.closePosition(position.id, currentPrice, 'STOP_LOSS');
        hasChanges = true;
      } else if (shouldTakeProfit) {
        this.closePosition(position.id, currentPrice, 'TAKE_PROFIT');
        hasChanges = true;
      }
    }

    this.updateAccountMetrics();
    
    if (hasChanges) {
      this.saveAccount();
    }
  }

  public closePosition(positionId: string, exitPrice: number, reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL'): Trade | null {
    const positionIndex = this.account.openPositions.findIndex(p => p.id === positionId);
    if (positionIndex === -1) return null;

    const position = this.account.openPositions[positionIndex];
    if (!position) return null;
    
    const priceChange = position.side === 'LONG'
      ? (exitPrice - position.entryPrice) / position.entryPrice
      : (position.entryPrice - exitPrice) / position.entryPrice;

    const realizedPnL = priceChange * position.positionSize;
    const realizedPnLPercent = priceChange * 100 * position.leverage;

    const trade: Trade = {
      id: position.id,
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      leverage: position.leverage,
      positionSize: position.positionSize,
      realizedPnL,
      realizedPnLPercent,
      openedAt: position.openedAt,
      closedAt: new Date(),
      closeReason: reason,
      duration: new Date().getTime() - position.openedAt.getTime(),
      source: position.source,
      ...(position.notes ? { notes: position.notes } : {}),
    };

    this.account.openPositions.splice(positionIndex, 1);
    this.account.closedTrades.push(trade);
    
    const riskAmount = position.positionSize / this.config.leverage;
    this.account.balance += riskAmount + realizedPnL;

    this.updateAccountMetrics();
    this.saveAccount();

    const emoji = realizedPnL >= 0 ? '✅' : '❌';
    console.log(`[PAPER] ${emoji} Closed ${position.side} position: ${position.symbol}`);
    console.log(`[PAPER]    Entry: $${position.entryPrice.toFixed(4)} → Exit: $${exitPrice.toFixed(4)}`);
    console.log(`[PAPER]    P&L: $${realizedPnL.toFixed(2)} (${realizedPnLPercent.toFixed(2)}%)`);
    console.log(`[PAPER]    Reason: ${reason}`);

    return trade;
  }

  private updateAccountMetrics(): void {
    let totalUnrealizedPnL = 0;
    for (const position of this.account.openPositions) {
      totalUnrealizedPnL += position.unrealizedPnL;
    }

    this.account.equity = this.account.balance + totalUnrealizedPnL;
    this.account.totalPnL = this.account.equity - this.account.initialBalance;
    this.account.totalPnLPercent = (this.account.totalPnL / this.account.initialBalance) * 100;

    const closedTrades = this.account.closedTrades;
    this.account.totalTrades = closedTrades.length;
    this.account.winningTrades = closedTrades.filter(t => t.realizedPnL > 0).length;
    this.account.losingTrades = closedTrades.filter(t => t.realizedPnL < 0).length;
    this.account.winRate = this.account.totalTrades > 0
      ? (this.account.winningTrades / this.account.totalTrades) * 100
      : 0;

    const wins = closedTrades.filter(t => t.realizedPnL > 0);
    const losses = closedTrades.filter(t => t.realizedPnL < 0);

    this.account.largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.realizedPnL)) : 0;
    this.account.largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.realizedPnL)) : 0;
    this.account.averageWin = wins.length > 0
      ? wins.reduce((sum, t) => sum + t.realizedPnL, 0) / wins.length
      : 0;
    this.account.averageLoss = losses.length > 0
      ? losses.reduce((sum, t) => sum + t.realizedPnL, 0) / losses.length
      : 0;

    const totalWins = wins.reduce((sum, t) => sum + t.realizedPnL, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.realizedPnL, 0));
    this.account.profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;
  }

  public getAccount(): PaperAccount {
    return this.account;
  }

  public resetAccount(): void {
    this.account = {
      balance: this.config.initialBalance,
      equity: this.config.initialBalance,
      initialBalance: this.config.initialBalance,
      totalPnL: 0,
      totalPnLPercent: 0,
      openPositions: [],
      closedTrades: [],
      winRate: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      largestWin: 0,
      largestLoss: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
    };
    this.saveAccount();
    console.log(`[PAPER] 🔄 Account reset to $${this.config.initialBalance}`);
  }

  public printAccountSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PAPER TRADING ACCOUNT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Balance: $${this.account.balance.toFixed(2)}`);
    console.log(`Equity: $${this.account.equity.toFixed(2)}`);
    console.log(`Total P&L: $${this.account.totalPnL.toFixed(2)} (${this.account.totalPnLPercent.toFixed(2)}%)`);
    console.log(`Open Positions: ${this.account.openPositions.length}`);
    console.log(`Total Trades: ${this.account.totalTrades}`);
    console.log(`Win Rate: ${this.account.winRate.toFixed(1)}%`);
    console.log(`Profit Factor: ${this.account.profitFactor.toFixed(2)}`);
    console.log('='.repeat(60) + '\n');
  }
}
