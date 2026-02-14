import axios from 'axios';
import chalk from 'chalk';
import { HttpsProxyAgent } from 'hpagent';
import dotenv from 'dotenv';

dotenv.config();

export class MarketScanner {
    constructor() {
        this.gammaApi = 'https://gamma-api.polymarket.com';
    }

    async getActiveMarkets() {
        try {
            console.log(chalk.yellow("Scanning Polymarket for active binary markets..."));
            const response = await axios.get(`${this.gammaApi}/markets`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                params: {
                    active: true,
                    closed: false,
                    limit: 500,
                    order: 'liquidity',
                    ascending: false
                },
                timeout: 10000
            });

            if (!Array.isArray(response.data)) {
                console.log(chalk.red("Gamma API did not return an array."));
                return [];
            }

            return response.data
                .filter(m => m.outcomePrices)
                .map(m => {
                    try {
                        const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
                        if (prices.length !== 2) return null;
                        
                        return {
                            id: m.id,
                            conditionId: m.conditionId,
                            title: m.question,
                            price: parseFloat(prices[0]),
                            tokens: typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : m.clobTokenIds,
                            volume: parseFloat(m.volume || 0),
                            liquidity: parseFloat(m.liquidity || 0),
                            endDate: new Date(m.endDate)
                        };
                    } catch (e) {
                        return null;
                    }
                })
                .filter(m => {
                    if (m === null) return false;
                    
                    // Filter for liquidity
                    if (m.liquidity < 100) return false;

                    // Filter for short-term (ends within 24 hours)
                    const now = new Date();
                    const hoursUntilEnd = (m.endDate - now) / (1000 * 60 * 60);
                    
                    return hoursUntilEnd > 0 && hoursUntilEnd <= 24;
                });
        } catch (error) {
            console.error(chalk.red(`Error scanning markets: ${error.message}`));
            return [];
        }
    }
}
