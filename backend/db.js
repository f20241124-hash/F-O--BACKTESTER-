const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

// Configuration for connecting to SQL Server master database first (to ensure database exists)
const getMasterConfig = () => ({
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: 'master',
  options: {
    encrypt: false, // Set to true for Azure
    trustServerCertificate: true, // Change to true for local dev
  },
  instanceName: process.env.DB_INSTANCE_NAME || undefined
});

// Configuration for target backtester database
const getDbConfig = () => ({
  ...getMasterConfig(),
  database: process.env.DB_DATABASE || 'BacktesterDB'
});

let poolPromise = null;

async function getConnection() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(getDbConfig())
      .connect()
      .then(pool => {
        console.log('Connected to MS SQL Server successfully.');
        return pool;
      })
      .catch(err => {
        console.error('Database Connection Failed! Bad Config: ', err.message);
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

// Check database existence and create tables
async function initializeDatabase() {
  const masterConfig = getMasterConfig();
  const dbName = process.env.DB_DATABASE || 'BacktesterDB';
  
  console.log(`Checking if database '${dbName}' exists on SQL Server...`);
  
  let masterPool;
  try {
    masterPool = await new sql.ConnectionPool(masterConfig).connect();
    
    // Check if database exists
    const dbCheckResult = await masterPool.request()
      .query(`SELECT database_id FROM sys.databases WHERE name = '${dbName}'`);
      
    if (dbCheckResult.recordset.length === 0) {
      console.log(`Database '${dbName}' not found. Creating database...`);
      await masterPool.request().query(`CREATE DATABASE ${dbName}`);
      console.log(`Database '${dbName}' created successfully.`);
    } else {
      console.log(`Database '${dbName}' already exists.`);
    }
  } catch (err) {
    console.error('Failed to verify/create database in SQL Server:', err.message);
    console.log('Please ensure SQL Server is running, and TCP/IP is enabled on port 1433.');
    if (masterPool) await masterPool.close();
    return false;
  } finally {
    if (masterPool) await masterPool.close();
  }

  // Connect to target database and create tables
  try {
    const pool = await getConnection();
    
    console.log('Checking and creating tables...');
    
    // Create strategies table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'strategies')
      BEGIN
        CREATE TABLE strategies (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description VARCHAR(MAX) NOT NULL,
          frequency VARCHAR(20) NOT NULL
        );
      END
    `);
    console.log('Checked/Created strategies table.');

    // Create trades table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'trades')
      BEGIN
        CREATE TABLE trades (
          id INT IDENTITY(1,1) PRIMARY KEY,
          strategy_id VARCHAR(50) NOT NULL,
          date VARCHAR(20) NOT NULL,
          expiry VARCHAR(20) NOT NULL,
          entry_spot FLOAT NOT NULL,
          strike FLOAT NOT NULL,
          premium_received FLOAT DEFAULT 0.0,
          premium_paid FLOAT DEFAULT 0.0,
          lot_size INT NOT NULL,
          expiry_pnl FLOAT NOT NULL,
          regime VARCHAR(50) NOT NULL,
          FOREIGN KEY(strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
        );
      END
    `);
    console.log('Checked/Created trades table.');

    // Create daily_index table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'daily_index')
      BEGIN
        CREATE TABLE daily_index (
          date VARCHAR(20) PRIMARY KEY,
          underlying_value FLOAT NOT NULL
        );
      END
    `);
    console.log('Checked/Created daily_index table.');

    console.log('Database initialization complete.');
    return true;
  } catch (err) {
    console.error('Error creating database tables:', err.message);
    return false;
  }
}

// Function to seed database from CSV files
async function seedDatabase() {
  try {
    const pool = await getConnection();
    
    // 1. Seed strategies description if empty
    const stratCountResult = await pool.request().query('SELECT COUNT(*) as count FROM strategies');
    if (stratCountResult.recordset[0].count === 0) {
      console.log('Seeding strategies metadata...');
      const strategies = [
        {
          id: 'covered_call',
          name: 'Covered Call',
          description: 'You hold BankNifty futures (or underlying) and SELL an Out-Of-The-Money (OTM) call option above the current price. Earns premium income. Limits upside but generates steady cash flow in sideways or moderately rising markets.',
          frequency: 'Monthly'
        },
        {
          id: 'iron_condor',
          name: 'Iron Condor',
          description: 'A market-neutral strategy that profits when the index price stays within a tight trading range. Constructed by selling an OTM Call Spread and an OTM Put Spread simultaneously. Best in low-volatility environments.',
          frequency: 'Weekly'
        },
        {
          id: 'bull_call_spread',
          name: 'Bull Call Spread',
          description: 'A bullish strategy with defined risk and limited reward. Constructed by buying a lower-strike Call option and selling a higher-strike Call option. Used when you expect moderate index gains.',
          frequency: 'Monthly'
        },
        {
          id: 'straddle',
          name: 'Long Straddle',
          description: 'A high-volatility strategy that profits when the index moves sharply in either direction (up or down). Constructed by buying an At-The-Money (ATM) Call and ATM Put simultaneously. Typically used before high-volatility events like earnings, elections, or budget releases.',
          frequency: 'Monthly'
        }
      ];

      for (const strat of strategies) {
        await pool.request()
          .input('id', sql.VarChar, strat.id)
          .input('name', sql.VarChar, strat.name)
          .input('description', sql.VarChar, strat.description)
          .input('frequency', sql.VarChar, strat.frequency)
          .query('INSERT INTO strategies (id, name, description, frequency) VALUES (@id, @name, @description, @frequency)');
      }
      console.log('Strategies metadata seeded.');
    }

    // 2. Seed daily index prices from banknifty_options_master.csv if empty
    const indexCountResult = await pool.request().query('SELECT COUNT(*) as count FROM daily_index');
    if (indexCountResult.recordset[0].count === 0) {
      console.log('Extracting daily spot price records from BankNifty options master (117MB)... This may take a moment.');
      const masterPath = path.join(__dirname, '..', 'Python Code', 'data', 'banknifty_options_master.csv');
      
      if (fs.existsSync(masterPath)) {
        const dailySpotMap = new Map();
        
        await new Promise((resolve, reject) => {
          fs.createReadStream(masterPath)
            .pipe(csv())
            .on('data', (row) => {
              const dateStr = row['Date'] || row['date'];
              const spotStr = row['Underlying Value'] || row['underlying_value'] || row['Close'] || row['close'];
              if (dateStr && spotStr) {
                // Parse date to standard format (YYYY-MM-DD)
                const parsedDate = new Date(dateStr);
                if (!isNaN(parsedDate.getTime())) {
                  const formattedDate = parsedDate.toISOString().split('T')[0];
                  const spotVal = parseFloat(spotStr);
                  if (!isNaN(spotVal) && !dailySpotMap.has(formattedDate)) {
                    dailySpotMap.set(formattedDate, spotVal);
                  }
                }
              }
            })
            .on('end', () => {
              console.log(`Finished scanning Master CSV. Extracted ${dailySpotMap.size} unique days.`);
              resolve();
            })
            .on('error', (err) => reject(err));
        });

        // Insert daily index values in batches to SQL Server
        console.log('Inserting daily spot prices to SQL database...');
        const sortedDates = Array.from(dailySpotMap.keys()).sort();
        
        // We do dynamic batching to speed it up
        let queryValList = [];
        let batchSize = 100;
        for (let i = 0; i < sortedDates.length; i++) {
          const date = sortedDates[i];
          const val = dailySpotMap.get(date);
          queryValList.push(`('${date}', ${val})`);

          if (queryValList.length >= batchSize || i === sortedDates.length - 1) {
            await pool.request().query(`
              INSERT INTO daily_index (date, underlying_value) 
              VALUES ${queryValList.join(',')}
            `);
            queryValList = [];
          }
        }
        console.log('Daily spot index values loaded to SQL database.');
      } else {
        console.warn('BankNifty Options Master file not found at:', masterPath);
      }
    }

    // 3. Seed Trade results if empty
    const tradesCountResult = await pool.request().query('SELECT COUNT(*) as count FROM trades');
    if (tradesCountResult.recordset[0].count === 0) {
      console.log('Seeding strategy trades from result CSVs...');
      const resultsDir = path.join(__dirname, '..', 'Python Code', 'results');
      
      const fileMappings = [
        { file: 'covered_call_results_regime.csv', strategyId: 'covered_call' },
        { file: 'iron_condor_results_regime.csv', strategyId: 'iron_condor' },
        { file: 'bull_call_spread_results_regime.csv', strategyId: 'bull_call_spread' },
        { file: 'straddle_results_regime.csv', strategyId: 'straddle' }
      ];

      for (const mapping of fileMappings) {
        const filePath = path.join(resultsDir, mapping.file);
        if (!fs.existsSync(filePath)) {
          console.warn(`Result file not found: ${mapping.file}`);
          continue;
        }

        console.log(`Parsing and loading ${mapping.file}...`);
        const trades = [];
        
        await new Promise((resolve, reject) => {
          fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
              trades.push(row);
            })
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
        });

        for (const trade of trades) {
          // Parse values safely based on column names (different strategies have slight variations)
          const date = trade['Date'];
          const expiry = trade['Expiry'];
          const entrySpot = parseFloat(trade['Entry_Spot'] || trade['Entry Spot'] || 0);
          
          let strike = parseFloat(trade['Strike_Sold'] || trade['Strike'] || trade['ATM_Strike'] || 0);
          
          // Premium Received vs Premium Paid mapping
          let premiumReceived = 0;
          let premiumPaid = 0;
          
          if (mapping.strategyId === 'covered_call') {
            premiumReceived = parseFloat(trade['Premium_Received'] || 0);
          } else if (mapping.strategyId === 'iron_condor') {
            premiumReceived = parseFloat(trade['Premium_Received'] || 0);
            premiumPaid = parseFloat(trade['Premium_Paid_To_Close'] || 0);
          } else if (mapping.strategyId === 'bull_call_spread') {
            premiumPaid = parseFloat(trade['Net_Premium_Paid'] || 0);
          } else if (mapping.strategyId === 'straddle') {
            premiumPaid = parseFloat(trade['Total_Premium_Paid'] || 0);
          }

          const lotSize = parseInt(trade['Lot_Size'] || 15);
          const expiryPnl = parseFloat(trade['Expiry_PnL'] || trade['Expiry PnL'] || 0);
          const regime = trade['Regime'] || 'Unknown';

          if (date && expiry) {
            await pool.request()
              .input('strategy_id', sql.VarChar, mapping.strategyId)
              .input('date', sql.VarChar, date)
              .input('expiry', sql.VarChar, expiry)
              .input('entry_spot', sql.Float, entrySpot)
              .input('strike', sql.Float, strike)
              .input('premium_received', sql.Float, premiumReceived)
              .input('premium_paid', sql.Float, premiumPaid)
              .input('lot_size', sql.Int, lotSize)
              .input('expiry_pnl', sql.Float, expiryPnl)
              .input('regime', sql.VarChar, regime)
              .query(`
                INSERT INTO trades (
                  strategy_id, date, expiry, entry_spot, strike, 
                  premium_received, premium_paid, lot_size, expiry_pnl, regime
                ) VALUES (
                  @strategy_id, @date, @expiry, @entry_spot, @strike, 
                  @premium_received, @premium_paid, @lot_size, @expiry_pnl, @regime
                )
              `);
          }
        }
        console.log(`Seeded trades for: ${mapping.strategyId}`);
      }
    }
    
    console.log('Database Seeding Successful.');
    return true;
  } catch (err) {
    console.error('Error during database seeding:', err.message);
    return false;
  }
}

module.exports = {
  getConnection,
  initializeDatabase,
  seedDatabase,
  sql
};
