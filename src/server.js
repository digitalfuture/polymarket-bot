import express from 'express';
import { engine } from 'express-handlebars';
import fs from 'fs';
import path from 'path';
import open from 'open';
import chalk from 'chalk';

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;

// Config Handlebars
app.engine('handlebars', engine({
    helpers: {
        eq: (a, b) => a === b
    }
}));
app.set('view engine', 'handlebars');
app.set('views', path.resolve('src/views'));

const getStats = () => {
    const tradesPath = path.resolve('src/data/trades.json');
    let trades = [];
    if (fs.existsSync(tradesPath)) {
        try {
            const content = fs.readFileSync(tradesPath, 'utf8');
            trades = JSON.parse(content || '[]');
        } catch (e) {
            trades = [];
        }
    }

    const initialBalance = parseFloat(process.env.INITIAL_BALANCE || '100');
    
    // Calculate Equity History
    let runningInvested = 0;
    
    // Sort trades by timestamp to process history chronologically
    const sortedTrades = [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    const history = sortedTrades.map(t => {
        const amount = parseFloat(t.amount || 0);
        let cash = parseFloat(t.currentBalance);
        
        if (isNaN(cash)) {
             cash = initialBalance;
        }

        // Only add to invested if the position is still open
        if (t.type && t.type.includes('BUY') && !t.resolved) {
            runningInvested += amount;
        }
        
        return {
            x: t.timestamp,
            y: (cash + runningInvested).toFixed(2),
            cash: cash.toFixed(2),
            invested: runningInvested.toFixed(2),
            result: t.result || null
        };
    });

    const lastPoint = history.length > 0 ? history[history.length - 1] : { cash: initialBalance, invested: 0, y: initialBalance };
    const currentCash = parseFloat(lastPoint.cash);
    const totalInvested = parseFloat(lastPoint.invested);
    const totalEquity = currentCash + totalInvested;
    
    const pnlValue = totalEquity - initialBalance;
    const pnlPercent = (pnlValue / initialBalance * 100).toFixed(2);
    
    const openTrades = trades.filter(t => !t.resolved).length;
    const closedTrades = trades.filter(t => t.resolved).length;
    
    let pnlDisplay = (pnlValue >= 0 ? "+" : "") + pnlValue.toFixed(2) + " USDC (" + pnlPercent + "%)";
    
    if (pnlPercent === "0.00" && totalInvested > 0) {
        pnlDisplay = "0.00% (All Open)";
    }

    return {
        trades: trades.reverse().slice(0, 50).map(t => {
            const expDate = t.expiresAt ? new Date(t.expiresAt) : null;
            let remaining = '';
            if (expDate) {
                const diff = expDate - new Date();
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                remaining = diff > 0 ? `${hours}h ${mins}m` : 'Closed';
            }

            return {
                ...t,
                time: new Date(t.timestamp).toLocaleString(),
                expires: expDate ? expDate.toLocaleString() : 'N/A',
                remaining: remaining,
                isBuyYes: t.type === 'BUY_YES'
            };
        }),
        stats: {
            currentBalance: currentCash.toFixed(2),
            invested: totalInvested.toFixed(2),
            equity: totalEquity.toFixed(2),
            pnl: pnlDisplay,
            openTrades,
            closedTrades,
            isPositive: pnlValue >= 0,
            totalTrades: trades.length,
            avgTrade: trades.length > 0 ? (trades.reduce((sum, t) => sum + (t.amount || 0), 0) / trades.length).toFixed(2) : "0.00"
        },
        history
    };
};

app.get('/api/stats', (req, res) => {
    console.log("API Request: /api/stats");
    res.json(getStats());
});

app.get('/', (req, res) => {
    const data = getStats();
    console.log("Rendering Dashboard with stats:", data.stats);
    res.render('index', { 
        trades: data.trades,
        stats: data.stats
    });
});

app.listen(PORT, () => {
    console.log(chalk.bold.green(`\n=====================================`));
    console.log(chalk.bold.green(`   DASHBOARD STARTED ON PORT ${PORT}  `));
    console.log(chalk.bold.green(`=====================================\n`));
    console.log(`Open in browser: http://localhost:${PORT}`);
    
    // Automatically open browser on start
    open(`http://localhost:${PORT}`);
});
