export interface LeverageTiers {
  high:   number
  medium: number
  low:    number
}

export interface PaperTradingConfig {
  initialBalance: number;
  leverage: number;
  leverageTiers?: LeverageTiers;
  riskPercentage: number;
  stopLossPercentage: number;
  takeProfitPercentage?: number;
  maxOpenPositions: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  stopLoss: number;
  takeProfit?: number;
  positionSize: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  openedAt: Date;
  closedAt?: Date;
  status: 'OPEN' | 'CLOSED' | 'STOPPED';
  closeReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL';
  realizedPnL?: number;
  source: 'BOT' | 'MANUAL';
  notes?: string;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  leverage: number;
  positionSize: number;
  realizedPnL: number;
  realizedPnLPercent: number;
  openedAt: Date;
  closedAt: Date;
  closeReason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL';
  duration: number;
  source: 'BOT' | 'MANUAL';
  notes?: string;
}

export interface PaperAccount {
  balance: number;
  equity: number;
  initialBalance: number;
  totalPnL: number;
  totalPnLPercent: number;
  openPositions: Position[];
  closedTrades: Trade[];
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  largestWin: number;
  largestLoss: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
}
