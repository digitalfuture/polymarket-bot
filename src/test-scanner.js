import { MarketScanner } from './services/scanner.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const scanner = new MarketScanner();
    const markets = await scanner.getActiveMarkets();
    console.log('Markets found:', markets.length);
    if (markets.length > 0) {
        console.log('First market:', markets[0].title);
    }
}

run();
