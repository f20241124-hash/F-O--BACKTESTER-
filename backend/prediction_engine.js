const { getConnection } = require('./db');

/**
 * Predicts the market regime for the next month based on historical spot index data.
 * Computes:
 * 1. Historical monthly returns and their classification.
 * 2. Markov Chain transition probability matrix (regime t -> regime t+1).
 * 3. Recent price momentum (SMA crossover & short-term trend).
 * 4. Forecasted regime probabilities and strategy recommendations.
 */
async function getRegimePrediction() {
  try {
    const pool = await getConnection();
    
    // Fetch daily index history
    const indexResult = await pool.request().query(`
      SELECT date, underlying_value 
      FROM daily_index 
      ORDER BY date ASC
    `);
    
    const rawDaily = indexResult.recordset;
    if (rawDaily.length < 30) {
      return {
        success: false,
        message: 'Insufficient historical spot index data to run prediction models. Needs at least 30 trading days.'
      };
    }

    // 1. Group daily index values to monthly close
    const monthlyCloses = [];
    const groupedByMonth = {};
    
    rawDaily.forEach(row => {
      const monthStr = row.date.substring(0, 7); // YYYY-MM
      if (!groupedByMonth[monthStr]) {
        groupedByMonth[monthStr] = [];
      }
      groupedByMonth[monthStr].push(row);
    });

    const sortedMonths = Object.keys(groupedByMonth).sort();
    sortedMonths.forEach(month => {
      const monthRows = groupedByMonth[month];
      // Get the last day of the month as the close price
      const lastRow = monthRows[monthRows.length - 1];
      monthlyCloses.push({
        month,
        close: lastRow.underlying_value,
        date: lastRow.date
      });
    });

    // Calculate monthly returns and classify regimes
    const historicalRegimes = [];
    for (let i = 1; i < monthlyCloses.length; i++) {
      const prevClose = monthlyCloses[i - 1].close;
      const currClose = monthlyCloses[i].close;
      const monthlyReturn = ((currClose - prevClose) / prevClose) * 100;
      
      let regime = 'Sideways';
      if (monthlyReturn > 3) {
        regime = 'Trending Up';
      } else if (monthlyReturn < -3) {
        regime = 'Trending Down';
      }

      historicalRegimes.push({
        month: monthlyCloses[i].month,
        return: monthlyReturn,
        regime
      });
    }

    // 2. Build Markov Chain Transition Matrix
    // States: 0 = Trending Down, 1 = Sideways, 2 = Trending Up
    const stateMap = {
      'Trending Down': 0,
      'Sideways': 1,
      'Trending Up': 2
    };
    const states = ['Trending Down', 'Sideways', 'Trending Up'];
    
    const transitionCounts = [
      [0, 0, 0], // from Trending Down to [Down, Sideways, Up]
      [0, 0, 0], // from Sideways to [Down, Sideways, Up]
      [0, 0, 0]  // from Trending Up to [Down, Sideways, Up]
    ];

    for (let i = 0; i < historicalRegimes.length - 1; i++) {
      const currentRegime = historicalRegimes[i].regime;
      const nextRegime = historicalRegimes[i + 1].regime;
      
      const fromIdx = stateMap[currentRegime];
      const toIdx = stateMap[nextRegime];
      
      if (fromIdx !== undefined && toIdx !== undefined) {
        transitionCounts[fromIdx][toIdx]++;
      }
    }

    // Convert counts to probabilities
    const transitionMatrix = transitionCounts.map(row => {
      const rowSum = row.reduce((a, b) => a + b, 0);
      if (rowSum === 0) return [1/3, 1/3, 1/3]; // Default fallback if no observations
      return row.map(count => count / rowSum);
    });

    // 3. Estimate current state and recent momentum
    const lastHistoricalMonth = historicalRegimes[historicalRegimes.length - 1];
    const currentRegime = lastHistoricalMonth ? lastHistoricalMonth.regime : 'Sideways';
    const currentRegimeIdx = stateMap[currentRegime];

    // Get transition probabilities starting from current state
    const markovProbabilities = transitionMatrix[currentRegimeIdx];

    // Compute simple moving average crossover as momentum filter
    // 20-day SMA vs 50-day SMA
    const prices = rawDaily.map(r => r.underlying_value);
    const getSMA = (period) => {
      const slice = prices.slice(-period);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    };
    
    const sma20 = getSMA(20);
    const sma50 = getSMA(50);
    const momentumBulish = sma20 > sma50;
    const priceChangeRecent = ((prices[prices.length - 1] - prices[prices.length - 15]) / prices[prices.length - 15]) * 100;

    // 4. Combine Markov Matrix and Momentum into Final Probability Forecast
    // Bullish momentum boosts Trending Up probability, bearish boosts Trending Down
    let pDown = markovProbabilities[0];
    let pSideways = markovProbabilities[1];
    let pUp = markovProbabilities[2];

    if (momentumBulish) {
      pUp += 0.10;
      pDown -= 0.05;
      pSideways -= 0.05;
    } else {
      pDown += 0.10;
      pUp -= 0.05;
      pSideways -= 0.05;
    }

    // Re-normalize probabilities
    const sum = pDown + pSideways + pUp;
    pDown = Math.max(0.05, pDown / sum);
    pSideways = Math.max(0.05, pSideways / sum);
    pUp = Math.max(0.05, pUp / sum);

    const probabilities = {
      'Trending Down': Math.round(pDown * 100),
      'Sideways': Math.round(pSideways * 100),
      'Trending Up': Math.round(pUp * 100)
    };

    // Determine predicted state (highest probability)
    let predictedRegime = 'Sideways';
    let maxProb = probabilities['Sideways'];
    
    if (probabilities['Trending Up'] > maxProb) {
      predictedRegime = 'Trending Up';
      maxProb = probabilities['Trending Up'];
    }
    if (probabilities['Trending Down'] > maxProb) {
      predictedRegime = 'Trending Down';
      maxProb = probabilities['Trending Down'];
    }

    // 5. Query Strategy Historical Stats by Regime
    // Pull win rate and average returns under each regime to rank strategies
    const statsResult = await pool.request().query(`
      SELECT 
        strategy_id, 
        regime, 
        COUNT(*) as total_trades,
        SUM(CASE WHEN expiry_pnl > 0 THEN 1 ELSE 0 END) as win_trades,
        AVG(expiry_pnl) as avg_pnl,
        SUM(expiry_pnl) as total_pnl
      FROM trades
      WHERE regime != 'Unknown'
      GROUP BY strategy_id, regime
    `);

    const regimeStats = statsResult.recordset;
    
    // Structure stats
    const strategyScores = {
      covered_call: { name: 'Covered Call', score: 0, winRate: 0, avgPnL: 0, reason: '' },
      iron_condor: { name: 'Iron Condor', score: 0, winRate: 0, avgPnL: 0, reason: '' },
      bull_call_spread: { name: 'Bull Call Spread', score: 0, winRate: 0, avgPnL: 0, reason: '' },
      straddle: { name: 'Long Straddle', score: 0, winRate: 0, avgPnL: 0, reason: '' }
    };

    // Score based on expected return = P(Up)*E[R|Up] + P(Down)*E[R|Down] + P(Side)*E[R|Side]
    Object.keys(strategyScores).forEach(stratId => {
      let expectedReturn = 0;
      
      const upStats = regimeStats.find(s => s.strategy_id === stratId && s.regime === 'Trending Up');
      const downStats = regimeStats.find(s => s.strategy_id === stratId && s.regime === 'Trending Down');
      const sideStats = regimeStats.find(s => s.strategy_id === stratId && s.regime === 'Sideways');

      const rUp = upStats ? upStats.avg_pnl : 0;
      const rDown = downStats ? downStats.avg_pnl : 0;
      const rSide = sideStats ? sideStats.avg_pnl : 0;

      // Expected PnL mathematically weighted by forecasted regime probabilities
      expectedReturn = (pUp * rUp) + (pDown * rDown) + (pSideways * rSide);
      strategyScores[stratId].expectedPnL = expectedReturn;

      // Extract details for the predicted regime
      const predStats = regimeStats.find(s => s.strategy_id === stratId && s.regime === predictedRegime);
      if (predStats) {
        strategyScores[stratId].winRate = Math.round((predStats.win_trades / predStats.total_trades) * 100);
        strategyScores[stratId].avgPnL = Math.round(predStats.avg_pnl);
      }
    });

    // Rank strategy scores
    const recommendations = Object.keys(strategyScores).map(id => ({
      id,
      ...strategyScores[id]
    })).sort((a, b) => b.expectedPnL - a.expectedPnL);

    // Formulate qualitative rationales
    recommendations.forEach((rec, idx) => {
      if (rec.id === 'covered_call') {
        rec.reason = `Yields optimal results under '${predictedRegime}' due to premium collection (theta decay) and mild upward spot movement. Win rate is ${rec.winRate}% in this state.`;
      } else if (rec.id === 'iron_condor') {
        rec.reason = `Perfect for capturing premium when spot moves within range. Best in sideways markets, carrying ${rec.winRate}% historical win rate.`;
      } else if (rec.id === 'bull_call_spread') {
        rec.reason = `Limits downside while participating in market rises. Suitable for directional bullish bets, yielding average P&L of ₹${rec.avgPnL.toLocaleString()} in '${predictedRegime}'.`;
      } else if (rec.id === 'straddle') {
        rec.reason = `Profits from strong breakout moves. Recommended only if high event risk is expected, otherwise theta decay erodes performance (Avg P&L ₹${rec.avgPnL.toLocaleString()} under '${predictedRegime}').`;
      }
    });

    return {
      success: true,
      currentMonthRegime: currentRegime,
      predictedRegime,
      probabilities,
      recentMomentum: {
        sma20: Math.round(sma20),
        sma50: Math.round(sma50),
        bullish: momentumBulish,
        fifteenDayReturnPercent: parseFloat(priceChangeRecent.toFixed(2))
      },
      recommendations,
      lastUpdated: new Date().toISOString()
    };
    
  } catch (err) {
    console.error('Error in prediction engine:', err.message);
    return {
      success: false,
      message: 'Failed to run prediction analysis due to database errors.'
    };
  }
}

module.exports = {
  getRegimePrediction
};
