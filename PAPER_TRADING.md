# Paper Trading System

## Overview

The paper trading system simulates real trades based on confirmed opportunities detected by the bot. This allows you to test strategies and learn which signals work best without risking real money.

## Configuration

**Current Settings:**
- **Starting Balance:** $1,000
- **Leverage:** 3x
- **Risk per Trade:** 4% of balance ($40 per trade)
- **Stop Loss:** 5% from entry
- **Max Open Positions:** 5
- **Auto-Trading:** Enabled (trades automatically on confirmed signals with score ≥ 4)

## How It Works

### Signal Processing

The bot automatically opens SHORT positions when:
- Confirmed signal score ≥ 4 (strong bearish signal)
- Price is pumping (positive price change)
- Strategy: Short exhausted pumps expecting reversal

The bot automatically opens LONG positions when:
- Confirmed signal score ≥ 4 (strong bullish signal)
- Price is dumping (negative price change)
- Strategy: Long oversold dips expecting bounce

### Position Management

**Entry:**
- Position size = Risk Amount × Leverage
- Risk Amount = Balance × 4% = $40
- Position Size = $40 × 3 = $120 per trade
- Quantity = Position Size / Entry Price

**Exit:**
- **Stop Loss:** Automatically closes at 5% loss
- **Manual Close:** Use CLI to close positions manually
- **No Take Profit:** Positions stay open until stopped or manually closed

### Risk Management

- Only 4% of balance risked per trade
- Maximum 5 positions open simultaneously
- Each position uses 3x leverage
- Stop loss protects against large losses

## CLI Commands

### View Account Status
```bash
npx tsx paper-trading-cli.ts status
```
Shows:
- Current balance and equity
- Total P&L
- Open positions with unrealized P&L
- Recent closed trades
- Win rate and profit factor

### Close Position Manually
```bash
npx tsx paper-trading-cli.ts close ORCA-USDT
```
Manually close a specific position at current price.

### Reset Account
```bash
npx tsx paper-trading-cli.ts reset
```
Reset account back to $1,000 starting balance.

## Monitoring

### Railway Dashboard
View paper trading data at:
```
https://bydfi-bot-production.up.railway.app/api/paper-trading
```

### Console Logs
The bot prints a summary after each cycle:
```
📊 PAPER TRADING ACCOUNT SUMMARY
============================================================
Balance: $960.00
Equity: $975.50
Total P&L: -$24.50 (-2.45%)
Open Positions: 2
Total Trades: 3
Win Rate: 66.7%
Profit Factor: 1.85
============================================================
```

### Position Notifications
When positions open/close:
```
[PAPER] 🔓 Opened SHORT position: ORCA-USDT @ $1.2345
[PAPER]    Position size: $120.00 (3x leverage)
[PAPER]    Stop loss: $1.2962 (5%)

[PAPER] ✅ Closed SHORT position: ORCA-USDT
[PAPER]    Entry: $1.2345 → Exit: $1.1850
[PAPER]    P&L: $12.00 (10.00%)
[PAPER]    Reason: MANUAL
```

## Data Storage

Paper trading data is saved to:
```
paper-trading-account.json
```

This file persists:
- Account balance and equity
- Open positions
- Closed trade history
- Performance metrics

## Strategy Notes

### Bearish Market (Current)
- Focus on SHORT signals
- Look for exhausted pumps (high positive % moves)
- Example: ORCA-USDT at +57% is likely exhausted
- Short when confirmed signal appears

### Position Sizing Example
```
Balance: $1,000
Risk: 4% = $40
Leverage: 3x
Position Size: $40 × 3 = $120

Entry: $1.00
Stop Loss: $1.05 (5% above for SHORT)
Quantity: 120 tokens

If stopped: Loss = $6 (5% of $120)
If profit 10%: Gain = $12 (10% of $120)
```

## Tips

1. **Monitor Win Rate:** Aim for >50% to be profitable
2. **Track Profit Factor:** >1.0 means profitable (wins > losses)
3. **Review Closed Trades:** Learn which signals work best
4. **Adjust Strategy:** If losing, consider changing min score threshold
5. **Market Conditions:** Adapt to bull/bear markets

## Disable/Enable Auto-Trading

To disable auto-trading, edit `src/index.ts`:
```typescript
const PAPER_TRADING_ENABLED = false; // Change to false
```

## Next Steps

1. **Monitor for 1-2 weeks** to collect data
2. **Analyze which signals are most profitable**
3. **Adjust risk parameters** based on results
4. **Consider real trading** once consistently profitable
