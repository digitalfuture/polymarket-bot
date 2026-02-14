import { ClobClient } from '@polymarket/clob-client';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

async function generate() {
    const privateKey = process.env.POLY_PRIVATE_KEY;

    if (!privateKey || privateKey === 'your_private_key') {
        console.log(chalk.red('Error: POLY_PRIVATE_KEY not found in .env file.'));
        console.log(chalk.yellow('Please export your private key from Polymarket (Settings -> Account -> Export Private Key) and paste it into .env first.'));
        process.exit(1);
    }

    try {
        console.log(chalk.blue('Authenticating and deriving L2 API keys...'));
        
        const wallet = new ethers.Wallet(privateKey);
        wallet._signTypedData = async (domain, types, value) => {
            return wallet.signTypedData(domain, types, value);
        };
        
        const host = 'https://clob.polymarket.com';
        const chainId = 137;
        
        let axiosConfig = {};
        if (process.env.PROXY_URL) {
            const { HttpsProxyAgent } = await import('hpagent');
            axiosConfig = {
                httpsAgent: new HttpsProxyAgent({
                    keepAlive: true,
                    proxy: process.env.PROXY_URL
                })
            };
            console.log(chalk.gray(`Using proxy for authentication: ${process.env.PROXY_URL}`));
        }

        const client = new ClobClient(host, chainId, wallet, undefined, axiosConfig);

        // This method will either create a new API key or return existing ones for this wallet
        console.log(chalk.yellow('Polymarket API requires an L2 key derivation. Please wait...'));
        const apiCreds = await client.createOrDeriveApiKey();

        if (apiCreds.apiKey) {
            console.log(chalk.green('\n====================================='));
            console.log(chalk.green('   POLYMARKET API KEYS RETRIEVED!    '));
            console.log(chalk.green('=====================================\n'));
            
            console.log(chalk.bold('Copy these into your .env file:'));
            console.log(chalk.cyan(`POLY_API_KEY=${apiCreds.apiKey}`));
            console.log(chalk.cyan(`POLY_API_SECRET=${apiCreds.secret}`));
            console.log(chalk.cyan(`POLY_API_PASSPHRASE=${apiCreds.passphrase}`));
            
            console.log(chalk.green('\n====================================='));
            console.log(chalk.yellow('Keep these keys secret and never share them!'));
        } else {
            console.log(chalk.red('\nFailed to retrieve API Key.'));
            console.log(chalk.yellow('If you are in Indonesia, you MUST use a VPN/Proxy to run this script.'));
        }
    } catch (error) {
        console.error(chalk.red('\nFailed to generate keys:'), error.message);
        console.log(chalk.yellow('\nTip: Ensure your account is funded with at least 1 USDC and you are not in a restricted region.'));
    }
}

generate();
