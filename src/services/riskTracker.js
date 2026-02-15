import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export class RiskTracker {
    constructor(initialBalance = 100, simulationMode = true) {
        this.balance = initialBalance;
        this.initialBalance = initialBalance;
        this.simulationMode = simulationMode;
        this.positions = [];
        this.logPath = path.resolve('src/data/trades.json');
        this.csvPath = path.resolve('src/data/equity.csv');
        
        // if (this.simulationMode) {
        //     this.clearStats();
        // }
        
        this.initLog();
    }

    clearStats() {
        if (fs.existsSync(this.logPath)) fs.unlinkSync(this.logPath);
        if (fs.existsSync(this.csvPath)) fs.unlinkSync(this.csvPath);
        console.log(chalk.yellow("Simulation mode: Previous stats cleared. Starting fresh."));
    }

    initLog() {
        if (!fs.existsSync(path.dirname(this.logPath))) {
            fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
        }
        if (!fs.existsSync(this.logPath)) {
            fs.writeFileSync(this.logPath, JSON.stringify([], null, 2));
        }
        if (!fs.existsSync(this.csvPath)) {
            fs.writeFileSync(this.csvPath, 'timestamp,balance,change,type\n');
            this.logToCsv(0, 'INITIAL');
        } else {
            // Recover balance from the last line of CSV for both LIVE and SIM modes
            try {
                const data = fs.readFileSync(this.csvPath, 'utf8').trim().split('\n');
                if (data.length > 1) {
                    const lastLine = data[data.length - 1];
                    const parts = lastLine.split(',');
                    const savedBalance = parseFloat(parts[1]);
                    if (!isNaN(savedBalance)) {
                        this.balance = savedBalance;
                        console.log(chalk.cyan(`${this.simulationMode ? 'Simulation' : 'Live'} mode: Recovered balance ${this.balance.toFixed(2)} USDC from history.`));
                    }
                }
            } catch (e) {
                console.log(chalk.red("Failed to recover balance from history. Using default."));
            }
        }
    }

    logToCsv(change, type = 'TRADE') {
        const line = `${new Date().toISOString()},${this.balance.toFixed(4)},${change.toFixed(4)},${type}\n`;
        fs.appendFileSync(this.csvPath, line);
    }

    saveTrade(trade) {
        const trades = JSON.parse(fs.readFileSync(this.logPath));
        const updatedTrade = {
            timestamp: new Date().toISOString(),
            ...trade,
            currentBalance: this.balance
        };
        trades.push(updatedTrade);
        fs.writeFileSync(this.logPath, JSON.stringify(trades, null, 2));
        
        // Log to CSV on trade
        this.logToCsv(-trade.amount, trade.simulation ? 'SIM_TRADE' : 'LIVE_TRADE');
    }

    canTrade(amount, marketId = null) {
        // 1. Prevent multiple positions on the same market
        if (marketId && this.hasPosition(marketId)) {
            console.log(chalk.gray(`  - Already have a position in market ${marketId}. Skipping.`));
            return false;
        }

        // 2. "Survival" check: Never spend more than configured % of remaining balance (default 10%)
        const maxPct = parseFloat(process.env.MAX_POSITION_SIZE || '0.1');
        const maxSpend = this.balance * maxPct;
        if (amount > maxSpend) {
            console.log(chalk.red(`Trade risk too high: ${amount.toFixed(2)} > ${maxSpend.toFixed(2)} (MAX_POSITION_SIZE)`));
            return false;
        }
        if (amount > this.balance) {
            console.log(chalk.red("Insufficient balance for trade."));
            return false;
        }
        return true;
    }

    hasPosition(marketId) {
        if (!fs.existsSync(this.logPath)) return false;
        try {
            const trades = JSON.parse(fs.readFileSync(this.logPath, 'utf8'));
            return trades.some(t => String(t.marketId) === String(marketId));
        } catch (e) {
            return false;
        }
    }

    updateBalance(amount) {
        this.balance += amount;
        console.log(chalk.green(`New Balance: ${this.balance.toFixed(2)} USDC`));
        this.logToCsv(amount, 'ADJUSTMENT');
        
        if (this.balance < this.initialBalance * 0.5) {
            console.log(chalk.bgRed("CRITICAL: 50% loss detected. Stopping all activity."));
            process.exit(1);
        }
    }

    saveHeartbeat() {
        const heartbeatPath = path.resolve('src/data/heartbeat.json');
        try {
            fs.writeFileSync(heartbeatPath, JSON.stringify({
                lastScan: new Date().toISOString()
            }, null, 2));
        } catch (e) {
            console.error("Failed to save heartbeat:", e.message);
        }
    }
}
