import axios from 'axios';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export class TradeResolver {
    constructor(riskTracker) {
        this.risk = riskTracker;
        this.logPath = path.resolve('src/data/trades.json');
        this.gammaApi = 'https://gamma-api.polymarket.com';
    }

    async resolveClosedTrades() {
        if (!fs.existsSync(this.logPath)) return;

        console.log(chalk.cyan("\n--- Checking for closed trades to resolve ---"));
        
        let trades = [];
        try {
            trades = JSON.parse(fs.readFileSync(this.logPath, 'utf8'));
        } catch (e) {
            return;
        }

        let updated = false;
        const now = new Date();

        for (let trade of trades) {
            // Only resolve trades that have expired and are not yet resolved
            if (trade.expiresAt && !trade.resolved && new Date(trade.expiresAt) < now) {
                console.log(chalk.yellow(`Resolving trade: "${trade.title}"`));
                
                try {
                    const result = await this.fetchMarketResult(trade.marketId);
                    if (result !== null) {
                        const win = (trade.type === 'BUY_YES' && result === 0) || 
                                    (trade.type === 'BUY_NO' && result === 1);
                        
                        if (win) {
                            // In Poly, winner gets $1 per share. 
                            // Shares bought = amount / price_at_buy
                            const shares = trade.amount / trade.price;
                            const payout = shares; 
                            const profit = payout - trade.amount;
                            
                            console.log(chalk.bgGreen.black(` WIN! Payout: ${payout.toFixed(2)} USDC (Profit: +${profit.toFixed(2)}) `));
                            this.risk.updateBalance(payout);
                        } else {
                            console.log(chalk.bgRed.white(` LOSS. Amount: -${trade.amount.toFixed(2)} USDC `));
                            // In simulation, we already deducted the 'amount' from balance at BUY.
                            // So we just don't add anything back.
                        }
                        
                        trade.resolved = true;
                        trade.result = win ? 'WIN' : 'LOSS';
                        trade.finalPayout = win ? trade.amount / trade.price : 0;
                        updated = true;
                    }
                } catch (e) {
                    console.error(chalk.red(`Failed to resolve ${trade.marketId}: ${e.message}`));
                }
            }
        }

        if (updated) {
            fs.writeFileSync(this.logPath, JSON.stringify(trades, null, 2));
            console.log(chalk.green("Trades history updated with results."));
        } else {
            console.log(chalk.gray("No new trades to resolve."));
        }
    }

    async fetchMarketResult(marketId) {
        try {
            const resp = await axios.get(`${this.gammaApi}/markets/${marketId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            // Poly Gamma API returns 'resolved': true and 'finalOutcome' (0 or 1)
            if (resp.data && resp.data.closed) {
                // If it's a binary market, finalOutcome is usually '0' (Yes) or '1' (No)
                return parseInt(resp.data.consensusOutcome);
            }
            return null;
        } catch (e) {
            return null;
        }
    }
}
