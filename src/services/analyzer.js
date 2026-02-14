import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

export class TrendAnalyzer {
    constructor() {
        this.prices = {};
        this.lastFetch = 0;
        this.idMap = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'SOL': 'solana',
            'DOGE': 'dogecoin',
            'XRP': 'ripple'
        };
    }

    async refreshPrices() {
        const now = Date.now();
        if (now - this.lastFetch < 60000) return;

        try {
            const ids = Object.values(this.idMap).join(',');
            const resp = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`, { timeout: 10000 });
            
            for (const [symbol, id] of Object.entries(this.idMap)) {
                if (resp.data[id]) {
                    this.prices[symbol] = {
                        usd: resp.data[id].usd,
                        change24h: resp.data[id].usd_24h_change
                    };
                }
            }
            this.lastFetch = now;
        } catch (e) {
            console.log(chalk.red(`  - CoinGecko Refresh Error: ${e.message}`));
        }
    }

    async getCryptoPrice(symbol) {
        await this.refreshPrices();
        const data = this.prices[symbol.toUpperCase()];
        return data ? data.usd : null;
    }

    async getCryptoChange24h(symbol) {
        await this.refreshPrices();
        const data = this.prices[symbol.toUpperCase()];
        return data ? data.change24h : null;
    }

    async analyze(polyMarket) {
        const polyPrice = polyMarket.price;
        const title = (polyMarket.title || '').toLowerCase();
        
        console.log(chalk.blue(`Analyzing: "${polyMarket.title}" (Poly Probability: ${(polyPrice * 100).toFixed(1)}%)`));

        let symbol = null;
        if (title.includes('bitcoin') || title.includes('btc')) symbol = 'BTC';
        else if (title.includes('ethereum') || title.includes('eth')) symbol = 'ETH';
        else if (title.includes('solana') || title.includes('sol')) symbol = 'SOL';
        else if (title.includes('doge')) symbol = 'DOGE';
        else if (title.includes('ripple') || title.includes('xrp')) symbol = 'XRP';

        if (symbol) {
            const currentPrice = await this.getCryptoPrice(symbol);
            
            if (currentPrice) {
                // 1. Up or Down markets
                if (title.includes('up or down')) {
                    try {
                        const change24h = await this.getCryptoChange24h(symbol);
                        if (change24h !== null) {
                            let trendProb = 0.5;
                            if (change24h > 1.0) trendProb = 0.9;
                            if (change24h < -1.0) trendProb = 0.1;

                            const diff = Math.abs(polyPrice - trendProb);
                            if (diff > 0.08) {
                                return {
                                    source: `${symbol}UpDown`,
                                    trendProbability: trendProb,
                                    discrepancy: diff,
                                    recommendation: polyPrice < trendProb ? 'BUY_YES' : 'BUY_NO'
                                };
                            }
                        }
                    } catch (e) {}
                }

                // 2. Target Price Analysis
                const match = title.match(/\$?(\d{1,3}(,\d{3})*(\.\d+)?k?)/);
                if (match) {
                    let target = parseFloat(match[1].replace(/k/i, '000').replace(/,/g, ''));
                    const distance = (target - currentPrice) / currentPrice;
                    let trendProb = 0.5;

                    if (title.includes('above') || title.includes('higher') || title.includes('up')) {
                        trendProb = currentPrice > target ? 0.99 : 0.01;
                        if (Math.abs(distance) < 0.005) trendProb = 0.5;
                    } else if (title.includes('below') || title.includes('lower') || title.includes('down')) {
                        trendProb = currentPrice < target ? 0.99 : 0.01;
                        if (Math.abs(distance) < 0.005) trendProb = 0.5;
                    }

                    const diff = Math.abs(polyPrice - trendProb);
                    if (diff > 0.08) {
                        return {
                            source: `${symbol}Trend`,
                            trendProbability: trendProb,
                            discrepancy: diff,
                            recommendation: polyPrice < trendProb ? 'BUY_YES' : 'BUY_NO'
                        };
                    }
                }
            }
        }

        // 3. Macro Consensus
        if (title.includes('fed') || title.includes('interest rate')) {
            const consensusProb = 0.95; 
            const diff = Math.abs(polyPrice - consensusProb);
            if (diff > 0.08) {
                return {
                    source: 'MacroConsensus',
                    trendProbability: consensusProb,
                    discrepancy: diff,
                    recommendation: polyPrice < consensusProb ? 'BUY_YES' : 'BUY_NO'
                };
            }
        }

        return null;
    }
}
