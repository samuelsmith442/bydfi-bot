# TradingAgents API Setup Guide

Quick guide to set up the TradingAgents API service for AI-powered trading.

## Prerequisites

- Python 3.13+
- Conda or virtualenv
- OpenAI API key (or other LLM provider)
- Alpha Vantage API key (free tier available)

## Quick Setup

### 1. Clone TradingAgents

```bash
cd ~/projects  # or your preferred directory
git clone https://github.com/TauricResearch/TradingAgents.git
cd TradingAgents
```

### 2. Create Python Environment

```bash
conda create -n tradingagents python=3.13
conda activate tradingagents
```

### 3. Install Dependencies

```bash
pip install .
pip install flask flask-cors
```

### 4. Create API Wrapper

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

# Initialize TradingAgents
config = DEFAULT_CONFIG.copy()
config["llm_provider"] = os.getenv("LLM_PROVIDER", "openai")
config["deep_think_llm"] = os.getenv("DEEP_THINK_LLM", "gpt-5.4-mini")  # Use mini for cost savings
config["quick_think_llm"] = os.getenv("QUICK_THINK_LLM", "gpt-5.4-mini")
config["max_debate_rounds"] = int(os.getenv("MAX_DEBATE_ROUNDS", "1"))  # Reduce to 1 for cost

ta = TradingAgentsGraph(debug=True, config=config)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "service": "TradingAgents API",
        "llm_provider": config["llm_provider"],
        "model": config["deep_think_llm"]
    })

@app.route('/analyze-symbol', methods=['POST'])
def analyze_symbol():
    try:
        data = request.json
        symbol = data.get('symbol')
        date = data.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        if not symbol:
            return jsonify({"error": "Symbol is required"}), 400
        
        # Convert crypto symbol format (BTCUSDT -> BTC)
        analysis_symbol = symbol.replace('USDT', '').replace('USDC', '').replace('-', '')
        
        print(f"[API] Analyzing {analysis_symbol} for {date}...")
        
        # Run TradingAgents analysis
        _, decision = ta.propagate(analysis_symbol, date)
        
        # Format response
        response = {
            "symbol": symbol,
            "original_symbol": analysis_symbol,
            "date": date,
            "decision": decision.get("action", "HOLD"),
            "confidence": decision.get("confidence", 0.5),
            "reasoning": decision.get("reasoning", "No reasoning provided"),
            "target_price": decision.get("target_price"),
            "stop_loss": decision.get("stop_loss"),
            "position_size": decision.get("position_size", 0.1),
            "risk_assessment": decision.get("risk_assessment", "No risk assessment"),
            "analyst_insights": decision.get("analyst_insights", {}),
            "debate_summary": decision.get("debate_summary", ""),
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"[API] Decision: {response['decision']} (confidence: {response['confidence']:.2f})")
        
        return jsonify(response)
        
    except Exception as e:
        print(f"[API] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f"[API] Starting TradingAgents API on port {port}...")
    print(f"[API] LLM Provider: {config['llm_provider']}")
    print(f"[API] Model: {config['deep_think_llm']}")
    app.run(host='0.0.0.0', port=port, debug=False)
```

### 5. Configure Environment Variables

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# LLM Provider (choose one)
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
# OR
GOOGLE_API_KEY=...

# Market Data
ALPHA_VANTAGE_API_KEY=...

# Configuration
LLM_PROVIDER=openai
DEEP_THINK_LLM=gpt-5.4-mini
QUICK_THINK_LLM=gpt-5.4-mini
MAX_DEBATE_ROUNDS=1
PORT=5000
```

### 6. Test Locally

```bash
# Start the API
python tradingagents_api.py

# In another terminal, test it
curl -X POST http://localhost:5000/analyze-symbol \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT"}'
```

Expected response:
```json
{
  "symbol": "BTCUSDT",
  "decision": "BUY",
  "confidence": 0.75,
  "reasoning": "...",
  "risk_assessment": "..."
}
```

## Deploy to Railway

### 1. Create Deployment Files

Create `Procfile`:
```
web: python tradingagents_api.py
```

Create `requirements.txt`:
```bash
pip freeze > requirements.txt
```

### 2. Initialize Git

```bash
git init
git add .
git commit -m "TradingAgents API service"
```

### 3. Deploy to Railway

1. Go to Railway dashboard
2. Create new project
3. Deploy from GitHub repo or local
4. Add environment variables:
   - `OPENAI_API_KEY`
   - `ALPHA_VANTAGE_API_KEY`
   - `LLM_PROVIDER=openai`
   - `DEEP_THINK_LLM=gpt-5.4-mini`
   - `QUICK_THINK_LLM=gpt-5.4-mini`
   - `MAX_DEBATE_ROUNDS=1`

5. Railway will auto-deploy

### 4. Get API URL

Copy the Railway-provided URL (e.g., `https://tradingagents-production.railway.app`)

### 5. Update bydfi-bot

In bydfi-bot Railway environment:

```env
ENABLE_AI_STRATEGY=true
TRADINGAGENTS_API_URL=https://tradingagents-production.railway.app
```

## Cost Optimization

### Use GPT-5.4-mini (Recommended)

```env
DEEP_THINK_LLM=gpt-5.4-mini
QUICK_THINK_LLM=gpt-5.4-mini
```

**Cost:** ~$0.005 per analysis (vs $0.05 for GPT-5.4)

### Reduce Debate Rounds

```env
MAX_DEBATE_ROUNDS=1
```

**Saves:** ~50% on LLM calls

### Limit Symbols in bydfi-bot

In `src/strategies/ai-strategy.ts`:
```typescript
maxSymbols: 2  // Analyze only top 2 tickers
```

### Enable Caching

Cache is already enabled (1 hour TTL) in `ai-strategy.ts`

## Monitoring

### Check API Health

```bash
curl https://your-api.railway.app/health
```

### Check Railway Logs

Watch for:
- `[API] Analyzing BTC...`
- `[API] Decision: BUY (confidence: 0.85)`
- Any errors or timeouts

### Monitor Costs

- OpenAI dashboard: https://platform.openai.com/usage
- Track API calls per day
- Adjust `maxSymbols` if costs too high

## Troubleshooting

### "Module not found" errors

```bash
pip install -r requirements.txt
```

### "API key not found"

Check `.env` file has correct keys

### Timeout errors

Increase timeout in bydfi-bot `ai-strategy.ts`:
```typescript
timeout: 120000  // 2 minutes
```

### High costs

- Use `gpt-5.4-mini`
- Reduce `MAX_DEBATE_ROUNDS` to 1
- Limit `maxSymbols` to 1-2
- Increase cache TTL to 2-4 hours

## Next Steps

1. ✅ Deploy TradingAgents API to Railway
2. ✅ Update bydfi-bot environment variables
3. ✅ Monitor AI signals in bydfi-bot logs
4. ✅ Track paper trading performance
5. ✅ Optimize based on results

## Support

- TradingAgents: https://github.com/TauricResearch/TradingAgents
- Railway: https://railway.app/help
- OpenAI: https://platform.openai.com/docs
