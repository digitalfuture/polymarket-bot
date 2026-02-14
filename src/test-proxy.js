import axios from 'axios';
import { HttpsProxyAgent } from 'hpagent';
import dotenv from 'dotenv';

dotenv.config();

const PROXY_URL = process.env.PROXY_URL;
console.log('Testing proxy:', PROXY_URL);

const agent = new HttpsProxyAgent({
    proxy: PROXY_URL,
    rejectUnauthorized: false
});

async function test() {
    try {
        console.log('Fetching Google through proxy...');
        const resp1 = await axios.get('https://www.google.com', { httpsAgent: agent, proxy: false, timeout: 5000 });
        console.log('Google status:', resp1.status);

        console.log('Fetching Binance through proxy...');
        const resp2 = await axios.get('https://api.binance.com/api/v3/ping', { httpsAgent: agent, proxy: false, timeout: 5000 });
        console.log('Binance status:', resp2.status);

        console.log('Fetching Polymarket Gamma through proxy...');
        const resp3 = await axios.get('https://gamma-api.polymarket.com/markets?limit=1', { httpsAgent: agent, proxy: false, timeout: 5000 });
        console.log('Gamma status:', resp3.status);
    } catch (e) {
        console.error('Test failed:', e.message);
        if (e.response) {
            console.error('Response data:', e.response.data);
            console.error('Response status:', e.response.status);
        }
    }
}

test();
