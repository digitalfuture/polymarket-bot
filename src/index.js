import chalk from 'chalk';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { MarketScanner } from './services/scanner.js';
import { TrendAnalyzer } from './services/analyzer.js';
import { RiskTracker } from './services/riskTracker.js';
import { TradeResolver } from './services/resolver.js';
// import { createPolymarketClient } from './services/polymarket.js';

dotenv.config();

const SIMULATION_MODE = process.env.SIMULATION_MODE !== 'false';
const MIN_DISCREPANCY = parseFloat(process.env.MIN_DISCREPANCY || '0.08');

const scanner = new MarketScanner();
const analyzer = new TrendAnalyzer();
const risk = new RiskTracker(
    parseFloat(process.env.INITIAL_BALANCE || '100'),
    SIMULATION_MODE
);
const resolver = new TradeResolver(risk);
let polyClient = null;

async function runIteration() {
    console.log(chalk.bold.magenta(`\n--- Iteration Started: ${new Date().toLocaleString()} ---`));
    risk.saveHeartbeat();
    
    if (!SIMULATION_MODE && !polyClient) {
        try {
            const { createPolymarketClient } = await import('./services/polymarket.js');
            polyClient = createPolymarketClient();
        } catch (e) {
            console.error(chalk.red("Failed to load Polymarket client:"), e.message);
        }
    }

    if (!polyClient && !SIMULATION_MODE) {
        console.log(chalk.red("Polymarket client not initialized. Pulse check: .env credentials?"));
        return;
    }

    const markets = await scanner.getActiveMarkets();
    console.log(chalk.gray(`Found ${markets.length} liquid binary markets.`));

    for (const market of markets) {
        const result = await analyzer.analyze(market);
        
        if (result && result.discrepancy >= MIN_DISCREPANCY) {
            console.log(chalk.bgGreen.black(` ! DISCREPANCY DETECTED: ${(result.discrepancy * 100).toFixed(1)}% ! `));
            console.log(chalk.green(`Source: ${result.source}, Recommendation: ${result.recommendation}`));

            const maxPct = parseFloat(process.env.MAX_POSITION_SIZE || '0.015');
            const positionSize = risk.balance * maxPct;

            if (risk.canTrade(positionSize, market.id)) {
                if (SIMULATION_MODE) {
                    console.log(chalk.yellow(`[SIMULATION] Executing ${result.recommendation} on "${market.title}" for ${positionSize.toFixed(2)} USDC`));
                    
                    // In simulation, we update the virtual balance immediately to reflect the trade
                    risk.updateBalance(-positionSize);
                    
                    risk.saveTrade({
                        marketId: market.id,
                        title: market.title,
                        type: result.recommendation,
                        amount: positionSize,
                        price: market.price,
                        trendProbability: result.trendProbability,
                        simulation: true,
                        expiresAt: market.endDate
                    });
                } else {
                    try {
                        console.log(chalk.blue(`[LIVE] Executing trade on "${market.title}"...`));
                        
                        // Determine side and price
                        const side = result.recommendation === 'BUY_YES' ? 'BUY' : 'BUY'; // We always buy the token (YES or NO)
                        const tokenId = result.recommendation === 'BUY_YES' ? market.tokens[0] : market.tokens[1];
                        
                        // Place Limit Order at current market price (or slightly better for survival)
                        const order = await polyClient.createOrder({
                            tokenID: tokenId,
                            price: market.price, // Should add slippage protection in real prod
                            side: 'BUY',
                            size: Math.floor(positionSize / market.price),
                            feeRateBps: 0
                        });
                        
                        console.log(chalk.green(`Order placed! ID: ${order.orderID}`));
                        
                        risk.updateBalance(-positionSize);
                        risk.saveTrade({
                            marketId: market.id,
                            title: market.title,
                            type: result.recommendation,
                            amount: positionSize,
                            orderId: order.orderID,
                            simulation: false,
                            expiresAt: market.endDate
                        });
                    } catch (e) {
                        console.error(chalk.red(`Trade execution failed: ${e.message}`));
                    }
                }
            }
        }
    }
    
    // Resolve expired trades
    await resolver.resolveClosedTrades();

    console.log(chalk.gray(`Iteration finished. Sleeping...`));
}

// Startup
console.log(chalk.bold.green("====================================="));
console.log(chalk.bold.green("   POLYMARKET DISCREPANCY BOT v1.0   "));
console.log(chalk.bold.green("====================================="));
console.log(`Mode: ${SIMULATION_MODE ? chalk.yellow("SIMULATION") : chalk.red("LIVE")}`);
console.log(`Min Discrepancy: ${chalk.cyan((MIN_DISCREPANCY * 100).toFixed(1) + "%")}`);
const maxPct = parseFloat(process.env.MAX_POSITION_SIZE || '0.015');
console.log(`Max Position Size: ${chalk.cyan((maxPct * 100).toFixed(1) + "%")}`);
console.log(`Initial Balance: ${chalk.cyan(risk.balance + " USDC")}`);

// Run once immediately
runIteration();

// Schedule every 10 minutes
cron.schedule('*/10 * * * *', runIteration);
