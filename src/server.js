import express from 'express';
import { engine } from 'express-handlebars';
import fs from 'fs';
import path from 'path';
import open from 'open';
import chalk from 'chalk';

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;

// Config Handlebars
app.engine('handlebars', engine());
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
    
    const history = trades.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map(t => {
        const amount = parseFloat(t.amount || 0);
        
        // If we have the saved post-trade balance, use it. Otherwise fallback to calc.
        let cash = parseFloat(t.currentBalance);
        if (isNaN(cash)) {
             // Fallback logic if currentBalance wasn't saved (older version)
             // We can't easily recover exact state without full replay, 
             // so we might see artifacts. But for new trades it will work.
             cash = initialBalance; // This is a weak fallback, but better than negative infinity
        }

        if (t.type && t.type.includes('BUY')) {
            runningInvested += amount;
        }
        
        return {
            x: t.timestamp,
            y: (cash + runningInvested).toFixed(2),
            cash: cash.toFixed(2),
            invested: runningInvested.toFixed(2)
        };
    });

    const lastPoint = history.length > 0 ? history[history.length - 1] : { cash: initialBalance, invested: 0, y: initialBalance };
    const currentCash = parseFloat(lastPoint.cash !== undefined ? lastPoint.cash : initialBalance);
    const totalInvested = parseFloat(lastPoint.invested !== undefined ? lastPoint.invested : 0);
    const totalEquity = currentCash + totalInvested;
    
    let pnl = ((totalEquity - initialBalance) / initialBalance * 100).toFixed(2);
    let pnlDisplay = pnl + "%";
    if (pnl === "0.00" && totalInvested > 0) {
        pnlDisplay = "0.00% (All Open)";
    }

    return {
        trades: trades.reverse().slice(0, 50).map(t => ({
            ...t,
            time: new Date(t.timestamp).toLocaleString(),
            isBuyYes: t.type === 'BUY_YES'
        })),
        stats: {
            currentBalance: currentCash.toFixed(2),
            invested: totalInvested.toFixed(2),
            equity: totalEquity.toFixed(2),
            pnl: pnlDisplay,
            isPositive: parseFloat(pnl) >= 0,
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
