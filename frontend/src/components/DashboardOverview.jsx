import React, { useEffect, useState } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { LayoutGrid, TrendingUp, ShieldAlert, Award } from 'lucide-react';

export default function DashboardOverview({ strategies, startDate, endDate, setActiveTab }) {
  const [chartData, setChartData] = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    const fetchAllTrades = async () => {
      setLoadingChart(true);
      try {
        const ids = ['covered_call', 'iron_condor', 'bull_call_spread', 'straddle'];
        const fetches = ids.map(id => 
          fetch(`/api/strategies/${id}?startDate=${startDate}&endDate=${endDate}`).then(r => r.json())
        );
        
        const results = await Promise.all(fetches);
        
        // Merge all trade dates chronologically
        const dateMap = {}; // date -> { covered_call: PnL, ... }
        
        results.forEach((stratData, idx) => {
          const stratId = ids[idx];
          if (stratData && stratData.trades) {
            stratData.trades.forEach(trade => {
              const date = trade.date;
              if (!dateMap[date]) {
                dateMap[date] = { date };
              }
              dateMap[date][stratId] = trade.expiry_pnl;
            });
          }
        });

        // Sort dates chronologically
        const sortedDates = Object.keys(dateMap).sort();
        
        // Compute running cumulative PnLs
        const cumPnL = {
          covered_call: 0,
          iron_condor: 0,
          bull_call_spread: 0,
          straddle: 0
        };

        const cumulativeChartData = sortedDates.map(date => {
          const point = dateMap[date];
          
          cumPnL.covered_call += (point.covered_call || 0);
          cumPnL.iron_condor += (point.iron_condor || 0);
          cumPnL.bull_call_spread += (point.bull_call_spread || 0);
          cumPnL.straddle += (point.straddle || 0);

          return {
            date,
            'Covered Call': parseFloat(cumPnL.covered_call.toFixed(2)),
            'Iron Condor': parseFloat(cumPnL.iron_condor.toFixed(2)),
            'Bull Call Spread': parseFloat(cumPnL.bull_call_spread.toFixed(2)),
            'Long Straddle': parseFloat(cumPnL.straddle.toFixed(2))
          };
        });

        setChartData(cumulativeChartData);
      } catch (err) {
        console.error('Error fetching dynamic chart data:', err);
      } finally {
        setLoadingChart(false);
      }
    };

    if (strategies.length > 0) {
      fetchAllTrades();
    }
  }, [strategies, startDate, endDate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Dynamic Performance Matrix Table */}
      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.2rem' }}>
          <LayoutGrid size={20} color="var(--primary)" />
          <h2 style={{ fontSize: '1.2rem' }}>Strategy Performance Matrix</h2>
        </div>
        
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Strategy Name</th>
                <th>Frequency</th>
                <th>Total Return (PnL)</th>
                <th>Win Rate</th>
                <th>Max Drawdown</th>
                <th>Sharpe Ratio</th>
                <th>Avg. Monthly PnL</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((strat) => {
                const metrics = strat.metrics || {};
                const pnl = metrics.totalPnL || 0;
                const dd = metrics.maxDrawdown || 0;
                
                return (
                  <tr key={strat.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{strat.name}</div>
                    </td>
                    <td>
                      <span className="badge badge-warning" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                        {strat.frequency}
                      </span>
                    </td>
                    <td style={{ color: pnl >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                      ₹{pnl.toLocaleString('en-IN')}
                    </td>
                    <td>{metrics.winRate || 0}%</td>
                    <td style={{ color: 'var(--danger)' }}>
                      ₹{dd.toLocaleString('en-IN')}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {metrics.sharpeRatio || '0.00'}
                    </td>
                    <td>₹{(metrics.avgMonthlyReturn || 0).toLocaleString('en-IN')}</td>
                    <td>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                        onClick={() => setActiveTab(strat.id)}
                      >
                        Analyze Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Multi-Equity Curve Comparison Chart */}
      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <TrendingUp size={20} color="var(--primary)" />
          <h2 style={{ fontSize: '1.2rem' }}>Cumulative Portfolio Equity Curves</h2>
        </div>

        {loadingChart ? (
          <div style={{ height: '350px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)' }}>
            Processing logs...
          </div>
        ) : (
          <div style={{ width: '100%', height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis 
                  dataKey="date" 
                  stroke="var(--text-muted)" 
                  fontSize={11}
                  tickLine={false} 
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} 
                />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600 }}
                  formatter={(val) => [`₹${val.toLocaleString('en-IN')}`]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Line type="monotone" dataKey="Covered Call" stroke="#6366f1" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Iron Condor" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Bull Call Spread" stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Long Straddle" stroke="#ef4444" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Quantitative Insights / Methodology Summary */}
      <section className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Award size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.1rem' }}>Core Volatility Insights</h3>
          </div>
          <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <li>
              🔹 <strong style={{ color: 'var(--text-primary)' }}>The Volatility Premium:</strong> Strategies harvesting time decay (Theta) and selling implied volatility (such as the <strong style={{ color: '#6366f1' }}>Covered Call</strong>) consistently outperform, showing high win rates (~86%) and a high Sharpe Ratio (~3.17).
            </li>
            <li>
              🔹 <strong style={{ color: 'var(--text-primary)' }}>Frictional Drag of straddles:</strong> Buying unhedged long volatility (<strong style={{ color: '#ef4444' }}>Long Straddle</strong>) causes significant capital erosion under flat or sideways regimes due to structural Theta decay.
            </li>
            <li>
              🔹 <strong style={{ color: 'var(--text-primary)' }}>Range Bound Buffers:</strong> The <strong style={{ color: '#10b981' }}>Iron Condor</strong> manages sideways conditions safely but suffers during sharp trending moves.
            </li>
          </ul>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <ShieldAlert size={20} color="var(--warning)" />
            <h3 style={{ fontSize: '1.1rem' }}>Baseline Trade Assumptions</h3>
          </div>
          <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <li>
              🔸 <strong style={{ color: 'var(--text-primary)' }}>Zero-Slippage cleared:</strong> Transactions execute strictly at historical daily closing prices. Slippage penalty adjustments (0.5% - 1%) should be factored in real deployment.
            </li>
            <li>
              🔸 <strong style={{ color: 'var(--text-primary)' }}>Dynamic Lot Sizing:</strong> Programmatically scales lot sizes based on historical regulations (25 units per BankNifty lot before July 2023; 15 units post-July 2023).
            </li>
            <li>
              🔸 <strong style={{ color: 'var(--text-primary)' }}>Zero Brokerage:</strong> Statutory government levies and flat fee brokerage structures are excluded from the main execution loops.
            </li>
          </ul>
        </div>
      </section>

    </div>
  );
}
