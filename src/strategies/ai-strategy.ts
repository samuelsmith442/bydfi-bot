import axios from 'axios';
import type { Ticker } from '../models/types.js';

const TRADINGAGENTS_API_URL = process.env.TRADINGAGENTS_API_URL || 'http://localhost:5000';

export interface AIDecision {
  symbol: string;
  decision: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  targetPrice?: number;
  stopLoss?: number;
  positionSize: number;
  riskAssessment: string;
  analystInsights?: any;
  debateSummary?: string;
  timestamp: string;
}

export interface AISignal {
  symbol: string;
  type: 'AI_LONG' | 'AI_SHORT' | 'AI_HOLD';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  reasons: string[];
  aiDecision: AIDecision;
  data: {
    volume24h: string;
    priceChange: string;
    lastPrice: string;
  };
}

// Cache for AI decisions to avoid excessive API calls
const aiDecisionCache = new Map<string, { decision: AIDecision, timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get AI trading decision from TradingAgents service
 */
async function getAIDecision(symbol: string): Promise<AIDecision | null> {
  try {
    // Check cache first
    const cacheKey = symbol;
    const cached = aiDecisionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[AI] Using cached decision for ${symbol}`);
      return cached.decision;
    }
    
    console.log(`[AI] Requesting analysis for ${symbol}...`);
    
    const response = await axios.post(
      `${TRADINGAGENTS_API_URL}/analyze-symbol`,
      { symbol },
      { 
        timeout: 60000, // 60 second timeout for AI analysis
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    const decision = response.data;
    
    // Cache the decision
    aiDecisionCache.set(cacheKey, { decision, timestamp: Date.now() });
    
    console.log(`[AI] ${symbol}: ${decision.decision} (confidence: ${(decision.confidence * 100).toFixed(1)}%)`);
    
    return decision;
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.error(`[AI] TradingAgents API not available at ${TRADINGAGENTS_API_URL}`);
    } else if (error.response?.status === 404) {
      console.error(`[AI] TradingAgents API endpoint not found`);
    } else {
      console.error(`[AI] Error getting decision for ${symbol}:`, error.message);
    }
    return null;
  }
}

/**
 * Detect AI-powered trading signals for top tickers
 */
export async function detectAISignals(
  tickers: Ticker[],
  config = {
    minVolume: 500000,
    minConfidence: 0.6,
    maxSymbols: 5  // Limit to avoid API costs
  }
): Promise<AISignal[]> {
  const signals: AISignal[] = [];
  
  // Filter and sort by volume
  const topTickers = tickers
    .filter(t => parseFloat(t.volume24h) >= config.minVolume)
    .sort((a, b) => parseFloat(b.volume24h) - parseFloat(a.volume24h))
    .slice(0, config.maxSymbols);
  
  console.log(`[AI] Analyzing ${topTickers.length} top tickers with TradingAgents...`);
  
  if (topTickers.length === 0) {
    console.log('[AI] No tickers meet minimum volume requirement');
    return signals;
  }
  
  // Analyze each ticker with AI
  for (const ticker of topTickers) {
    const aiDecision = await getAIDecision(ticker.symbol);
    
    if (!aiDecision) {
      console.log(`[AI] ${ticker.symbol}: No decision received, skipping`);
      continue;
    }
    
    // Skip if confidence too low
    if (aiDecision.confidence < config.minConfidence) {
      console.log(`[AI] ${ticker.symbol}: Low confidence (${(aiDecision.confidence * 100).toFixed(1)}%), skipping`);
      continue;
    }
    
    // Convert AI decision to signal
    if (aiDecision.decision === 'BUY') {
      const confidence = aiDecision.confidence >= 0.8 ? 'HIGH' : 
                        aiDecision.confidence >= 0.65 ? 'MEDIUM' : 'LOW';
      
      signals.push({
        symbol: ticker.symbol,
        type: 'AI_LONG',
        confidence,
        score: Math.round(aiDecision.confidence * 10),
        reasons: [
          `AI Confidence: ${(aiDecision.confidence * 100).toFixed(1)}%`,
          aiDecision.reasoning.substring(0, 100) + '...',
          `Risk: ${aiDecision.riskAssessment.substring(0, 80)}...`
        ],
        aiDecision,
        data: {
          volume24h: ticker.volume24h,
          priceChange: ticker.priceChangePercent,
          lastPrice: ticker.lastPrice
        }
      });
    } else if (aiDecision.decision === 'SELL') {
      const confidence = aiDecision.confidence >= 0.8 ? 'HIGH' : 
                        aiDecision.confidence >= 0.65 ? 'MEDIUM' : 'LOW';
      
      signals.push({
        symbol: ticker.symbol,
        type: 'AI_SHORT',
        confidence,
        score: -Math.round(aiDecision.confidence * 10),
        reasons: [
          `AI Confidence: ${(aiDecision.confidence * 100).toFixed(1)}%`,
          aiDecision.reasoning.substring(0, 100) + '...',
          `Risk: ${aiDecision.riskAssessment.substring(0, 80)}...`
        ],
        aiDecision,
        data: {
          volume24h: ticker.volume24h,
          priceChange: ticker.priceChangePercent,
          lastPrice: ticker.lastPrice
        }
      });
    } else {
      console.log(`[AI] ${ticker.symbol}: HOLD decision, skipping`);
    }
  }
  
  console.log(`[AI] Generated ${signals.length} AI signals`);
  
  return signals;
}

/**
 * Check if TradingAgents API is available
 */
export async function checkAIServiceHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${TRADINGAGENTS_API_URL}/health`, { timeout: 5000 });
    console.log('[AI] TradingAgents API is healthy');
    return response.status === 200;
  } catch (error) {
    console.log('[AI] TradingAgents API is not available');
    return false;
  }
}
