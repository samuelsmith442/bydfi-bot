import { PaperTradingManager } from './src/services/paper-trading.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAPER_ACCOUNT_FILE = path.join(__dirname, 'paper-trading-account.json');

const config = {
  initialBalance: 1000,
  leverage: 3,
  riskPercentage: 4,
  stopLossPercentage: 5,
  maxOpenPositions: 5,
};

const manager = new PaperTradingManager(config);

const command = process.argv[2];
const symbol = process.argv[3];

switch (command) {
  case 'status':
    manager.printAccountSummary();
    const account = manager.getAccount();
    
    if (account.openPositions.length > 0) {
      console.log('📊 OPEN POSITIONS:');
      console.log('='.repeat(60));
      account.openPositions.forEach((pos, idx) => {
        const pnlEmoji = pos.unrealizedPnL >= 0 ? '✅' : '❌';
        console.log(`${pnlEmoji} #${idx + 1} ${pos.symbol} ${pos.side}`);
        console.log(`   Entry: $${pos.entryPrice.toFixed(4)} | Current: $${pos.currentPrice.toFixed(4)}`);
        console.log(`   Size: $${pos.positionSize.toFixed(2)} (${pos.leverage}x) | Stop: $${pos.stopLoss.toFixed(4)}`);
        console.log(`   P&L: $${pos.unrealizedPnL.toFixed(2)} (${pos.unrealizedPnLPercent.toFixed(2)}%)`);
        console.log('');
      });
    }
    
    if (account.closedTrades.length > 0) {
      console.log('\n📈 RECENT TRADES (Last 10):');
      console.log('='.repeat(60));
      account.closedTrades.slice(-10).reverse().forEach((trade, idx) => {
        const pnlEmoji = trade.realizedPnL >= 0 ? '✅' : '❌';
        const duration = Math.floor(trade.duration / (1000 * 60));
        console.log(`${pnlEmoji} ${trade.symbol} ${trade.side} - ${trade.closeReason}`);
        console.log(`   Entry: $${trade.entryPrice.toFixed(4)} → Exit: $${trade.exitPrice.toFixed(4)}`);
        console.log(`   P&L: $${trade.realizedPnL.toFixed(2)} (${trade.realizedPnLPercent.toFixed(2)}%) | Duration: ${duration}min`);
        console.log('');
      });
    }
    break;

  case 'close':
    if (!symbol) {
      console.error('Usage: npx tsx paper-trading-cli.ts close <SYMBOL>');
      process.exit(1);
    }
    
    const position = manager.getAccount().openPositions.find(p => p.symbol.toLowerCase() === symbol.toLowerCase());
    if (!position) {
      console.error(`No open position found for ${symbol}`);
      process.exit(1);
    }
    
    manager.closePosition(position.id, position.currentPrice, 'MANUAL');
    console.log(`\n✅ Closed position for ${symbol}`);
    manager.printAccountSummary();
    break;

  case 'reset':
    if (fs.existsSync(PAPER_ACCOUNT_FILE)) {
      fs.unlinkSync(PAPER_ACCOUNT_FILE);
      console.log('✅ Paper trading account reset to $1000');
    } else {
      console.log('No account file found');
    }
    break;

  default:
    console.log('Paper Trading CLI');
    console.log('='.repeat(60));
    console.log('Commands:');
    console.log('  status              - Show account summary and open positions');
    console.log('  close <SYMBOL>      - Manually close a position');
    console.log('  reset               - Reset account to initial $1000');
    console.log('\nExamples:');
    console.log('  npx tsx paper-trading-cli.ts status');
    console.log('  npx tsx paper-trading-cli.ts close ORCA-USDT');
}
