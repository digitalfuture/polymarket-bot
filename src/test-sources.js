import axios from 'axios';
async function test() {
    console.log('--- Testing Price APIs without Proxy ---');
    
    const sources = [
        { name: 'Kraken', url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD' },
        { name: 'OKX', url: 'https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT' },
        { name: 'Bitfinex', url: 'https://api-pub.bitfinex.com/v2/ticker/tBTCUSD' },
        { name: 'CoinGecko', url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd' }
    ];

    for (const s of sources) {
        try {
            const start = Date.now();
            const resp = await axios.get(s.url, { timeout: 5000 });
            console.log(`${s.name}: SUCCESS (${resp.status}) - ${Date.now() - start}ms`);
        } catch (e) {
            console.log(`${s.name}: FAILED - ${e.message}`);
        }
    }
}
test();
