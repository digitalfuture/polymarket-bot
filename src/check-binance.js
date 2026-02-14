import axios from 'axios';
async function test() {
    try {
        console.log('Fetching Binance without proxy...');
        const resp = await axios.get('https://api.binance.com/api/v3/ping', { timeout: 5000 });
        console.log('Status:', resp.status);
    } catch (e) {
        console.log('Binance failed without proxy:', e.message);
    }
}
test();
