const { getConnection } = require('./db');

async function test() {
  const pool = await getConnection();
  const result = await pool.request().query(`
    SELECT 
      strategy_id, 
      regime, 
      COUNT(*) as total_trades,
      SUM(CASE WHEN expiry_pnl > 0 THEN 1 ELSE 0 END) as win_trades,
      AVG(expiry_pnl) as avg_pnl,
      SUM(expiry_pnl) as total_pnl
    FROM trades
    GROUP BY strategy_id, regime
  `);
  console.log(result.recordset);
  process.exit(0);
}

test();
