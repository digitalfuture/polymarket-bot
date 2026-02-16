import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

export class TrendAnalyzer {
    constructor() {
        this.macroSources = {
            'fed': 0.95, 
            'interest rate': 0.95,
            'gdp': 0.52, 
            'inflation': 0.45,
            'unemployment': 0.10
        };
        
        // Probabilities for common scenario types
        this.eventHeuristics = {
             'will win': 0.60,      // Sports favorites baseline
             'win on': 0.55,        // Match winner baseline
             'billboard': 0.90,     // Top artists usually stay top
             'tweets': 0.40,        // High-count tweet ranges are usually less likely than people think
             'temperature': 0.30    // Specific weather ranges are hard to hit
        };
    }

    async analyze(polyMarket) {
        const polyPrice = polyMarket.price;
        const title = (polyMarket.title || '').toLowerCase();
        
        // Skip crypto
        const cryptoKeywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol ', 'doge', 'ripple', 'xrp', 'up or down'];
        if (cryptoKeywords.some(key => title.includes(key))) {
            return null; 
        }

        console.log(chalk.blue(`Analyzing Event: "${polyMarket.title}" (Poly Probability: ${(polyPrice * 100).toFixed(1)}%)`));

        // 1. Check Macro Sources first
        for (const [key, consensusProb] of Object.entries(this.macroSources)) {
            if (title.includes(key)) {
                const diff = Math.abs(polyPrice - consensusProb);
                if (diff > 0.10) { 
                    return {
                        source: 'MacroAnalysis',
                        trendProbability: consensusProb,
                        discrepancy: diff,
                        recommendation: polyPrice < consensusProb ? 'BUY_YES' : 'BUY_NO'
                    };
                }
            }
        }

        // 2. Check Event Heuristics (Sports/Celebrity)
        for (const [key, baseProb] of Object.entries(this.eventHeuristics)) {
            if (title.includes(key)) {
                // If it's a sports bet and Poly shows a clear favorite but with a high discrepancy
                const diff = Math.abs(polyPrice - baseProb);
                if (diff > 0.12) { 
                    return {
                        source: 'EventLogic',
                        trendProbability: baseProb,
                        discrepancy: diff,
                        recommendation: polyPrice < baseProb ? 'BUY_YES' : 'BUY_NO'
                    };
                }
            }
        }

        // 3. extreme outliers (Underpriced "Long Shots")
        if (polyPrice < 0.02 && title.includes('will') && !title.includes('win')) {
            // High reward, low risk "tail" bets
            return {
                source: 'TailBet',
                trendProbability: 0.05,
                discrepancy: 0.03,
                recommendation: 'BUY_YES'
            };
        }

        return null;
    }
}
