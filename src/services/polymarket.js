import { ClobClient } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

export const createPolymarketClient = () => {
    const {
        POLY_PRIVATE_KEY,
        POLY_API_KEY,
        POLY_API_SECRET,
        POLY_API_PASSPHRASE
    } = process.env;

    if (!POLY_PRIVATE_KEY || !POLY_API_KEY || !POLY_API_SECRET || !POLY_API_PASSPHRASE) {
        console.error("Missing Polymarket credentials in .env");
        return null;
    }

    const wallet = new ethers.Wallet(POLY_PRIVATE_KEY);
    
    // Default to Polygon Mainnet for live usage
    const host = 'https://clob.polymarket.com'; 
    const chainId = 137; // Polygon
    const proxyUrl = process.env.PROXY_URL;

    return new ClobClient(
        host,
        chainId,
        wallet,
        {
            apiKey: POLY_API_KEY,
            secret: POLY_API_SECRET,
            passphrase: POLY_API_PASSPHRASE,
            proxy: proxyUrl // The CLOB SDK supports a proxy string
        }
    );
};
