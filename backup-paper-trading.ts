import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAPER_ACCOUNT_FILE = path.join(__dirname, 'paper-trading-account.json');
const BACKUP_FILE = path.join(__dirname, 'paper-trading-backup.json');

function backup() {
  try {
    if (!fs.existsSync(PAPER_ACCOUNT_FILE)) {
      console.log('❌ No paper trading account file found to backup');
      return;
    }

    const data = fs.readFileSync(PAPER_ACCOUNT_FILE, 'utf-8');
    const account = JSON.parse(data);
    
    // Add backup timestamp
    const backupData = {
      ...account,
      backupTimestamp: new Date().toISOString(),
      backupNote: 'Backup before deployment'
    };
    
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2));
    
    console.log('✅ Paper trading account backed up successfully!');
    console.log(`📊 Balance: $${account.balance.toFixed(2)}`);
    console.log(`📈 Total P&L: $${account.totalPnL.toFixed(2)} (${account.totalPnLPercent.toFixed(2)}%)`);
    console.log(`📍 Open Positions: ${account.openPositions.length}`);
    console.log(`📜 Total Trades: ${account.totalTrades}`);
    console.log(`🎯 Win Rate: ${account.winRate.toFixed(1)}%`);
    console.log(`💰 Profit Factor: ${account.profitFactor.toFixed(2)}`);
    console.log(`\n📁 Backup saved to: ${BACKUP_FILE}`);
    
  } catch (error: any) {
    console.error('❌ Error backing up account:', error.message);
  }
}

function restore() {
  try {
    if (!fs.existsSync(BACKUP_FILE)) {
      console.log('❌ No backup file found to restore');
      console.log('💡 Run "npm run backup-paper-trading" first to create a backup');
      return;
    }

    const data = fs.readFileSync(BACKUP_FILE, 'utf-8');
    const backup = JSON.parse(data);
    
    // Remove backup metadata
    delete backup.backupTimestamp;
    delete backup.backupNote;
    
    fs.writeFileSync(PAPER_ACCOUNT_FILE, JSON.stringify(backup, null, 2));
    
    console.log('✅ Paper trading account restored successfully!');
    console.log(`📊 Balance: $${backup.balance.toFixed(2)}`);
    console.log(`📈 Total P&L: $${backup.totalPnL.toFixed(2)} (${backup.totalPnLPercent.toFixed(2)}%)`);
    console.log(`📍 Open Positions: ${backup.openPositions.length}`);
    console.log(`📜 Total Trades: ${backup.totalTrades}`);
    console.log(`🎯 Win Rate: ${backup.winRate.toFixed(1)}%`);
    console.log(`💰 Profit Factor: ${backup.profitFactor.toFixed(2)}`);
    
  } catch (error: any) {
    console.error('❌ Error restoring account:', error.message);
  }
}

// Check command line argument
const command = process.argv[2];

if (command === 'backup') {
  backup();
} else if (command === 'restore') {
  restore();
} else {
  console.log('Usage:');
  console.log('  npm run backup-paper-trading backup   - Backup current account');
  console.log('  npm run backup-paper-trading restore  - Restore from backup');
}
