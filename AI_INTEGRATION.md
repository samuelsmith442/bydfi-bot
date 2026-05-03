# AI Trading Strategy Integration

This bot now supports AI-powered trading decisions using the [TradingAgents](https://github.com/TauricResearch/TradingAgents) multi-agent LLM framework.

## Overview

The AI strategy uses multiple specialized agents to analyze markets:
- **Fundamentals Analyst** - Company financials and performance
- **Sentiment Analyst** - Social media and public sentiment
- **News Analyst** - Global news and macroeconomic indicators
- **Technical Analyst** - Technical indicators (MACD, RSI, etc.)
- **Researcher Team** - Bullish/Bearish debate system
- **Trader Agent** - Final trading decisions
- **Risk Management** - Portfolio risk assessment

## Architecture

```
TradingAgents API (Python) → bydfi-bot (TypeScript) → ByDFi Exchange
```

The AI service runs separately and provides trading decisions via REST API. The bydfi-bot calls the API and executes trades based on AI recommendations.

## Setup

### Option 1: Use Pre-deployed TradingAgents API

If you have access to a deployed TradingAgents API:

1. Set environment variables in Railway:
```env
ENABLE_AI_STRATEGY=true
TRADINGAGENTS_API_URL=https://your-tradingagents-api.railway.app
```

2. Deploy bydfi-bot and it will automatically use AI signals

### Option 2: Deploy Your Own TradingAgents API

#### Step 1: Clone TradingAgents

```bash
git clone https://github.com/TauricResearch/TradingAgents.git
cd TradingAgents
```

#### Step 2: Install Dependencies

```bash
# Create Python environment
conda create -n tradingagents python=3.13
conda activate tradingagents

# Install
pip install .
pip install flask flask-cors
```

#### Step 3: Configure API Keys

Create `.env` file:

```env
# Choose your LLM provider
OPENAI_API_KEY=sk-...           # For GPT models (recommended)
# OR
ANTHROPIC_API_KEY=sk-ant-...    # For Claude
# OR
GOOGLE_API_KEY=...              # For Gemini

# Market data (required)
ALPHA_VANTAGE_API_KEY=...       # Free tier available at alphavantage.co

# Optional
LLM_PROVIDER=openai
DEEP_THINK_LLM=gpt-5.4
QUICK_THINK_LLM=gpt-5.4-mini
MAX_DEBATE_ROUNDS=2
```

#### Step 4: Create API Wrapper

Create `tradingagents_api.py` in the TradingAgents directory:

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

config = DEFAULT_CONFIG.copy()
config["llm_provider"] = os.getenv("LLM_PROVIDER", "openai")
config["deep_think_llm"] = os.getenv("DEEP_THINK_LLM", "gpt-5.4")
config["quick_think_llm"] = os.getenv("QUICK_THINK_LLM", "gpt-5.4-mini")
config["max_debate_rounds"] = int(os.getenv("MAX_DEBATE_ROUNDS", "2"))

ta = TradingAgentsGraph(debug=True, config=config)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "TradingAgents API"})

@app.route('/analyze-symbol', methods=['POST'])
def analyze_symbol():
    try:
        data = request.json
        symbol = data.get('symbol')
        date = data.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        if not symbol:
            return jsonify({"error": "Symbol is required"}), 400
        
        # Convert crypto symbol format (BTCUSDT -> BTC)
        analysis_symbol = symbol.replace('USDT', '').replace('-', '')
        
        print(f"[API] Analyzing {analysis_symbol}...")
        _, decision = ta.propagate(analysis_symbol, date)
        
        response = {
            "symbol": symbol,
            "date": date,
            "decision": decision.get("action", "HOLD"),
            "confidence": decision.get("confidence", 0.5),
            "reasoning": decision.get("reasoning", ""),
            "target_price": decision.get("target_price"),
            "stop_loss": decision.get("stop_loss"),
            "position_size": decision.get("position_size", 0.1),
            "risk_assessment": decision.get("risk_assessment", ""),
            "timestamp": datetime.now().isoformat()
        }
        
        return jsonify(response)
        
    except Exception as e:
        print(f"[API] Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
```

#### Step 5: Test Locally

```bash
# Start API
python tradingagents_api.py

# Test in another terminal
curl -X POST http://localhost:5000/analyze-symbol \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT"}'
```

#### Step 6: Deploy to Railway

1. Create `Procfile`:
```
web: python tradingagents_api.py
```

2. Create `requirements.txt`:
```bash
pip freeze > requirements.txt
```

3. Push to Railway:
```bash
git init
git add .
git commit -m "TradingAgents API service"
# Deploy via Railway dashboard
```

4. Add environment variables in Railway dashboard

## Configuration

### bydfi-bot Environment Variables

```env
# Enable/disable AI strategy
ENABLE_AI_STRATEGY=true

# TradingAgents API URL
TRADINGAGENTS_API_URL=https://your-api.railway.app
```

### AI Strategy Parameters

In `src/strategies/ai-strategy.ts`:

```typescript
{
  minVolume: 500000,      // Only analyze high-volume pairs
  minConfidence: 0.6,     // Minimum AI confidence (60%)
  maxSymbols: 3           // Max symbols per cycle (cost control)
}
```

## Cost Estimates

### LLM API Costs (per analysis)

**GPT-5.4:**
- Analyst Team: ~$0.01
- Researcher Debate: ~$0.02
- Trader Decision: ~$0.01
- Risk Management: ~$0.01
- **Total: ~$0.05 per symbol**

**GPT-5.4-mini (recommended):**
- **Total: ~$0.005 per symbol**

### Monthly Costs

**Conservative (3 symbols, 12 cycles/day, GPT-5.4-mini):**
- 3 × 12 × 30 = 1,080 analyses
- 1,080 × $0.005 = **$5.40/month**

**Moderate (5 symbols, 24 cycles/day, GPT-5.4-mini):**
- 5 × 24 × 30 = 3,600 analyses
- 3,600 × $0.005 = **$18/month**

**With Caching (1-hour cache):**
- Reduce by 50-80%
- **$2.70 - $9/month**

## How It Works

1. **Signal Generation:**
   - Bot fetches top tickers by volume
   - Sends top 3-5 to TradingAgents API
   - AI analyzes each symbol with multi-agent system

2. **AI Decision:**
   - Fundamentals, sentiment, news, technical analysis
   - Bullish/bearish debate
   - Risk assessment
   - Final BUY/SELL/HOLD decision with confidence

3. **Execution:**
   - Bot receives AI decision
   - Filters by confidence threshold (60%+)
   - Converts to trading signal
   - Executes via paper trading

4. **Monitoring:**
   - AI signals tracked separately
   - Win rate and profit factor calculated
   - Compare AI vs technical strategies

## Monitoring

### Check AI Signal Generation

```bash
# Watch logs for AI activity
[AI] Analyzing 3 top tickers with TradingAgents...
[AI] BTCUSDT: BUY (confidence: 85.0%)
[AI] ETHUSDT: HOLD (confidence: 55.0%)
[AI] Generated 1 AI signals
[STRATEGY] Momentum: 211 | Mean Reversion: 2 | AI: 1 | Early: 2
```

### Check Paper Trading Performance

```bash
npx tsx paper-trading-cli.ts status
```

Look for trades with AI strategy tag.

## Troubleshooting

### AI signals not appearing

1. Check `ENABLE_AI_STRATEGY=true` in environment
2. Verify TradingAgents API is running: `curl https://your-api.railway.app/health`
3. Check Railway logs for errors

### API timeout errors

- Increase timeout in `ai-strategy.ts` (default 60s)
- Reduce `max_debate_rounds` in TradingAgents config
- Use faster LLM model (gpt-5.4-mini)

### High costs

- Reduce `maxSymbols` to 1-2
- Increase cache TTL to 2-4 hours
- Use GPT-5.4-mini instead of GPT-5.4
- Only run during high-volume periods

## Performance Expectations

### Week 1-2 (Testing)
- 1-5 AI signals per cycle
- Higher confidence = better performance
- Lower win rate but higher profit per trade

### Week 3-4 (Optimization)
- Adjust confidence thresholds
- Fine-tune LLM models
- Optimize debate rounds

### Month 2+ (Production)
- AI complements technical strategies
- Target: 60%+ win rate
- Target: 2.0+ profit factor

## Disabling AI Strategy

Set in Railway environment:

```env
ENABLE_AI_STRATEGY=false
```

Bot will continue with technical strategies only.

## Future Enhancements

- [ ] Batch analysis API endpoint
- [ ] Strategy-specific AI models
- [ ] Real-time news integration
- [ ] Custom agent configurations
- [ ] A/B testing framework
- [ ] Cost optimization algorithms

## Support

For TradingAgents issues: https://github.com/TauricResearch/TradingAgents/issues
For bydfi-bot issues: Check your repository issues
