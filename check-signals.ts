import 'dotenv/config';
import { printSignalReport } from './src/services/signal-history.js';

// Get symbols from command line arguments or use defaults
const symbols = process.argv.slice(2);

if (symbols.length === 0) {
  console.log('Usage: tsx check-signals.ts SYN ENSO BULLA');
  console.log('Or check specific symbols: tsx check-signals.ts BTC ETH');
  process.exit(1);
}

// Print the report
printSignalReport(symbols.map(s => s.toUpperCase()));
