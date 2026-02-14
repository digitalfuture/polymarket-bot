import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        console.log('Fetching Gamma without proxy...');
        const resp = await axios.get('https://gamma-api.polymarket.com/markets?limit=1', { timeout: 5000 });
        console.log('Status:', resp.status);
    } catch (e) {
        console.log('Failed without proxy:', e.message);
    }
}
test();
