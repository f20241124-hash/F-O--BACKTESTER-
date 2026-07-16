const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const { getConnection, initializeDatabase, seedDatabase, sql } = require('./db');
const { getRegimePrediction } = require('./prediction_engine');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Helper function to calculate metrics from trades array
function calculatePerformanceMetrics(trades) {
  if (!trades || trades.length === 0) {
    return {
      totalPnL: 0,
      winRate: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      avgMonthlyReturn: 0,
      totalTrades: 0
    };
  }

  // 1. Total PnL & Total Trades
  const totalTrades = trades.length;
  let totalPnL = 0;
  let winTrades = 0;

  trades.forEach(t => {
    totalPnL += t.expiry_pnl;
    if (t.expiry_pnl > 0) {
      winTrades++;
    }
  });

  const winRate = (winTrades / totalTrades) * 100;

  // 2. Max Drawdown
  // Standard cumulative sum calculation
  let cumPnL = 0;
  let maxPeak = 0;
  let maxDD = 0;

  // Sort trades chronologically to compute drawdown correctly
  const sortedTrades = [...trades].sort((a, b) => a.date.localeCompare(b.date));

  sortedTrades.forEach(t => {
    cumPnL += t.expiry_pnl;
    if (cumPnL > maxPeak) {
      maxPeak = cumPnL;
    }
    const drawdown = cumPnL - maxPeak;
    if (drawdown < maxDD) {
      maxDD = drawdown;
    }
  });

  // 3. Sharpe Ratio (Matching metrics.py)
  let sharpeRatio = 0;
  if (totalTrades >= 2) {
    const pnls = trades.map(t => t.expiry_pnl);
    const meanReturn = pnls.reduce((a, b) => a + b, 0) / totalTrades;

    // Sample standard deviation
    const variance = pnls.reduce((sum, val) => sum + Math.pow(val - meanReturn, 2), 0) / (totalTrades - 1);
    const stdReturn = Math.sqrt(variance);

    const riskFree = 0.065; // 6.5% standard in metrics.py
    if (stdReturn > 0) {
      const excessReturn = meanReturn - riskFree;
      const monthlySharpe = excessReturn / stdReturn;
      // Annualised Sharpe (multiplied by sqrt(12))
      sharpeRatio = monthlySharpe * Math.sqrt(12);
    }
  }

  // 4. Average Monthly Return
  // Group P&L by YYYY-MM
  const monthlySums = {};
  trades.forEach(t => {
    const month = t.date.substring(0, 7); // YYYY-MM
    monthlySums[month] = (monthlySums[month] || 0) + t.expiry_pnl;
  });

  const months = Object.keys(monthlySums);
  const avgMonthlyReturn = months.length > 0
    ? (months.reduce((sum, m) => sum + monthlySums[m], 0) / months.length)
    : 0;

  return {
    totalPnL: parseFloat(totalPnL.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(2)),
    maxDrawdown: parseFloat(maxDD.toFixed(2)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    avgMonthlyReturn: parseFloat(avgMonthlyReturn.toFixed(2)),
    totalTrades
  };
}

// API Routes

// 1. Get all strategies and their dynamically calculated metrics
app.get('/api/strategies', async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const pool = await getConnection();

    // Fetch all strategies
    const stratsResult = await pool.request().query('SELECT * FROM strategies');
    const strategies = stratsResult.recordset;

    // Query trades filtered by date if provided
    let query = 'SELECT strategy_id, date, expiry_pnl FROM trades';
    const request = pool.request();

    if (startDate && endDate) {
      query += ' WHERE date >= @startDate AND date <= @endDate';
      request.input('startDate', sql.VarChar, startDate);
      request.input('endDate', sql.VarChar, endDate);
    }

    const tradesResult = await request.query(query);
    const allTrades = tradesResult.recordset;

    // Map metrics to each strategy
    const responseData = strategies.map(strat => {
      const stratTrades = allTrades.filter(t => t.strategy_id === strat.id);
      const metrics = calculatePerformanceMetrics(stratTrades);
      return {
        ...strat,
        metrics
      };
    });

    res.json(responseData);
  } catch (err) {
    res.status(500).json({ error: 'Database query failure', details: err.message });
  }
});

// 2. Get specific strategy details and dynamic metrics
app.get('/api/strategies/:id', async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  try {
    const pool = await getConnection();
    const stratResult = await pool.request()
      .input('id', sql.VarChar, id)
      .query('SELECT * FROM strategies WHERE id = @id');

    if (stratResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    const strategy = stratResult.recordset[0];

    // Fetch trades
    let query = 'SELECT * FROM trades WHERE strategy_id = @id';
    const request = pool.request().input('id', sql.VarChar, id);

    if (startDate && endDate) {
      query += ' AND date >= @startDate AND date <= @endDate';
      request.input('startDate', sql.VarChar, startDate);
      request.input('endDate', sql.VarChar, endDate);
    }

    query += ' ORDER BY date ASC';
    const tradesResult = await request.query(query);
    const trades = tradesResult.recordset;

    const metrics = calculatePerformanceMetrics(trades);

    res.json({
      ...strategy,
      metrics,
      trades // Returns sorted trades for drawing lines & bar charts
    });
  } catch (err) {
    res.status(500).json({ error: 'Database query failure', details: err.message });
  }
});

// 3. Get Paginated/Filtered trade log for a strategy
app.get('/api/strategies/:id/trades', async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate, regime, page = 1, limit = 15 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const pool = await getConnection();

    let baseQuery = 'FROM trades WHERE strategy_id = @id';
    const request = pool.request().input('id', sql.VarChar, id);

    if (startDate && endDate) {
      baseQuery += ' AND date >= @startDate AND date <= @endDate';
      request.input('startDate', sql.VarChar, startDate);
      request.input('endDate', sql.VarChar, endDate);
    }

    if (regime && regime !== 'All') {
      baseQuery += ' AND regime = @regime';
      request.input('regime', sql.VarChar, regime);
    }

    // Get total count for pagination
    const countResult = await request.query(`SELECT COUNT(*) as count ${baseQuery}`);
    const totalCount = countResult.recordset[0].count;

    // Get paginated trades
    const tradesResult = await request.query(`
      SELECT * ${baseQuery}
      ORDER BY date DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `);

    res.json({
      trades: tradesResult.recordset,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Database query failure', details: err.message });
  }
});

// 4. Get market regime forecasts and predictions
app.get('/api/predictions', async (req, res) => {
  try {
    const prediction = await getRegimePrediction();
    res.json(prediction);
  } catch (err) {
    res.status(500).json({ error: 'Forecasting failure', details: err.message });
  }
});

// 5. Re-run Backtesting scripts and refresh SQL database
app.post('/api/backtest/run', async (req, res) => {
  console.log('Triggering Python backtest run pipeline...');
  const pythonMainPath = path.join(__dirname, '..', 'Python Code', 'main.py');
  const pythonWorkingDir = path.join(__dirname, '..', 'Python Code');

  exec('python main.py', { cwd: pythonWorkingDir }, async (error, stdout, stderr) => {
    if (error) {
      console.error('Python Script execution failed:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Underlying backtesting pipeline failed.',
        error: error.message,
        stderr
      });
    }

    console.log('Python strategy rerun complete. Output:', stdout);

    // Database refresh
    try {
      console.log('Re-seeding database with updated results...');
      // Clear trades table before seeding updated values
      const pool = await getConnection();
      await pool.request().query('DELETE FROM trades');

      const seedSuccess = await seedDatabase();
      if (seedSuccess) {
        res.json({
          success: true,
          message: 'Backtesting simulation run and SQL database synchronized successfully!',
          output: stdout
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Simulation completed but database seeding failed.'
        });
      }
    } catch (dbErr) {
      res.status(500).json({
        success: false,
        message: 'Failed to synchronize SQL database.',
        error: dbErr.message
      });
    }
  });
});

// Start Express server and initialize database tables and seed
async function startServer() {
  console.log('Bootstrapping server environment...');

  const initSuccess = await initializeDatabase();
  if (initSuccess) {
    await seedDatabase();
  }

  app.listen(PORT, () => {
    console.log(`Backend server successfully listening at http://localhost:${PORT}`);
  });
}

startServer();
