import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

export class TrendAnalyzer {
    constructor() {
        this.weatherCache = {};
        this.cacheExpiry = 30 * 60 * 1000; // 30 min cache
    }

    // ========== WEATHER API (wttr.in - free, no key needed) ==========
    async getWeatherForecast(city) {
        const now = Date.now();
        const cached = this.weatherCache[city];
        if (cached && (now - cached.fetchedAt) < this.cacheExpiry) {
            return cached.data;
        }

        try {
            const resp = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
                timeout: 8000,
                headers: { 'User-Agent': 'curl/7.68.0' }
            });

            if (resp.data && resp.data.weather) {
                this.weatherCache[city] = { data: resp.data, fetchedAt: now };
                return resp.data;
            }
        } catch (e) {
            console.log(chalk.red(`  Weather API error for ${city}: ${e.message}`));
        }
        return null;
    }

    // Parse weather market title
    parseWeatherMarket(title) {
        const lower = title.toLowerCase();
        if (!lower.includes('temperature')) return null;

        // Extract city
        const cityMatch = title.match(/temperature in ([A-Za-z\s]+?) (?:be |will )/i) 
            || title.match(/temperature in ([A-Za-z\s]+?) be/i);
        if (!cityMatch) return null;
        const city = cityMatch[1].trim();

        // Determine unit (°C or °F)
        const isFahrenheit = title.includes('°F') || title.includes('F on');
        
        // Parse target temperature and condition
        let condition = 'exact'; // exact, above, below, range
        let targetLow = null;
        let targetHigh = null;

        if (lower.includes('or higher') || lower.includes('or above')) {
            condition = 'above';
            const tempMatch = title.match(/be (\d+)/);
            if (tempMatch) targetLow = parseInt(tempMatch[1]);
        } else if (lower.includes('or below') || lower.includes('or lower')) {
            condition = 'below';
            const tempMatch = title.match(/be (\d+)/);
            if (tempMatch) targetHigh = parseInt(tempMatch[1]);
        } else if (lower.includes('between')) {
            condition = 'range';
            const rangeMatch = title.match(/between (\d+)-(\d+)/);
            if (rangeMatch) {
                targetLow = parseInt(rangeMatch[1]);
                targetHigh = parseInt(rangeMatch[2]);
            }
        } else {
            condition = 'exact';
            const tempMatch = title.match(/be (\d+)/);
            if (tempMatch) targetLow = targetHigh = parseInt(tempMatch[1]);
        }

        if (targetLow === null && targetHigh === null) return null;

        // Parse date
        const dateMatch = title.match(/on (February|March|January|April|May|June|July|August|September|October|November|December) (\d+)/i);
        let targetDate = null;
        if (dateMatch) {
            const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
            const monthIdx = monthNames.indexOf(dateMatch[1].toLowerCase());
            const day = parseInt(dateMatch[2]);
            const year = new Date().getFullYear();
            targetDate = new Date(year, monthIdx, day);
        }

        return { city, condition, targetLow, targetHigh, isFahrenheit, targetDate };
    }

    // Calculate probability from weather forecast
    async analyzeWeatherMarket(polyMarket) {
        const parsed = this.parseWeatherMarket(polyMarket.title);
        if (!parsed) return null;

        const forecast = await this.getWeatherForecast(parsed.city);
        if (!forecast || !forecast.weather) return null;

        // Find the right day in forecast
        let dayForecast = null;
        for (const day of forecast.weather) {
            const forecastDate = new Date(day.date);
            if (parsed.targetDate) {
                if (forecastDate.getDate() === parsed.targetDate.getDate() &&
                    forecastDate.getMonth() === parsed.targetDate.getMonth()) {
                    dayForecast = day;
                    break;
                }
            }
        }

        if (!dayForecast) {
            // Fallback: use the first available future day
            dayForecast = forecast.weather[0];
        }

        // Get max temp in Celsius from forecast
        let forecastMaxC = parseFloat(dayForecast.maxtempC);
        let forecastMinC = parseFloat(dayForecast.mintempC);
        let forecastMaxF = parseFloat(dayForecast.maxtempF);
        let forecastMinF = parseFloat(dayForecast.mintempF);

        // Use the right unit
        let forecastMax, forecastMin;
        if (parsed.isFahrenheit) {
            forecastMax = forecastMaxF;
            forecastMin = forecastMinF;
        } else {
            forecastMax = forecastMaxC;
            forecastMin = forecastMinC;
        }

        // Estimate standard deviation for weather uncertainty (~3 degrees for max temp)
        const stdDev = parsed.isFahrenheit ? 5 : 3;
        const forecastMean = forecastMax; // "highest temperature" = max temp

        // Calculate probability based on condition
        let estimatedProb = 0.5;

        if (parsed.condition === 'exact') {
            // Probability of exact degree: use normal distribution approximation
            const z = Math.abs(parsed.targetLow - forecastMean) / stdDev;
            // P(exact X) ≈ 1/stdDev * normalPDF (roughly)
            // For practical purposes: if within 1 std dev, ~15-25%; 2 std devs, ~5%; 3+ ~1%
            if (z < 0.5) estimatedProb = 0.20;
            else if (z < 1.0) estimatedProb = 0.13;
            else if (z < 1.5) estimatedProb = 0.07;
            else if (z < 2.0) estimatedProb = 0.03;
            else estimatedProb = 0.01;
        } else if (parsed.condition === 'above') {
            const z = (parsed.targetLow - forecastMean) / stdDev;
            estimatedProb = 1 - normalCDF(z);
        } else if (parsed.condition === 'below') {
            const z = (parsed.targetHigh - forecastMean) / stdDev;
            estimatedProb = normalCDF(z);
        } else if (parsed.condition === 'range') {
            const zLow = (parsed.targetLow - forecastMean) / stdDev;
            const zHigh = (parsed.targetHigh - forecastMean) / stdDev;
            estimatedProb = normalCDF(zHigh) - normalCDF(zLow);
        }

        // Clamp probability
        estimatedProb = Math.max(0.01, Math.min(0.99, estimatedProb));

        console.log(chalk.cyan(`  🌡️ Weather: ${parsed.city} forecast max=${forecastMax}° | Target: ${parsed.condition} ${parsed.targetLow || ''}${parsed.targetHigh ? '-'+parsed.targetHigh : ''} | Est.Prob: ${(estimatedProb*100).toFixed(1)}% vs Market: ${(polyMarket.price*100).toFixed(1)}%`));

        const diff = Math.abs(polyMarket.price - estimatedProb);
        
        // Only trade if discrepancy > 20% AND we're confident
        if (diff > 0.20) {
            return {
                source: 'WeatherForecast',
                trendProbability: estimatedProb,
                discrepancy: diff,
                recommendation: polyMarket.price < estimatedProb ? 'BUY_YES' : 'BUY_NO'
            };
        }

        return null;
    }

    // ========== MAIN ANALYZER ==========
    async analyze(polyMarket) {
        const polyPrice = polyMarket.price;
        const title = (polyMarket.title || '').toLowerCase();
        
        // Skip crypto entirely
        const cryptoKeywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol ', 'doge', 'ripple', 'xrp', 'up or down', 'crypto'];
        if (cryptoKeywords.some(key => title.includes(key))) {
            return null; 
        }

        console.log(chalk.blue(`Analyzing: "${polyMarket.title}" (Market: ${(polyPrice * 100).toFixed(1)}%)`));

        // 1. Weather markets — use real forecast data
        if (title.includes('temperature')) {
            return await this.analyzeWeatherMarket(polyMarket);
        }

        // 2. Skip everything else that we can't verify with real data
        // No more blind guessing on sports, tweets, billboard, etc.
        // We only trade what we can VERIFY.

        return null;
    }
}

// ========== MATH HELPERS ==========
function normalCDF(z) {
    // Approximation of the standard normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
}
