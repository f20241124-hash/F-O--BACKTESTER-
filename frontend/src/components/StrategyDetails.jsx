import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Filter, 
  Calendar,
  AlertTriangle,
  Info
} from 'lucide-react';

export default function StrategyDetails({ strategyId, startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Trade logs pagination and filter state
  const [trades, setTrades] = useState([]);
  const [regimeFilter, setRegimeFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [tradesLoading, setTradesLoading] = useState(false);

  const limit = 10;

  // Load strategy summary (including sorted trades for plotting charts)
  const fetchStrategySummary = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/strategies/${strategyId}?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) throw new Error('Failed to fetch strategy metrics');
      const json = await response.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load paginated & filtered trade logs for the table
  const fetchStrategyTrades = async () => {
    setTradesLoading(true);
    try {
      const response = await fetch(
        `/api/strategies/${strategyId}/trades?startDate=${startDate}&endDate=${endDate}&regime=${regimeFilter}&page=${currentPage}&limit=${limit}`
      );
      if (!response.ok) throw new Error('Failed to fetch trades');
      const json = await response.json();
      setTrades(json.trades);
      setTotalPages(json.pagination.pages);
      setTotalCount(json.pagination.total);
    } catch (err) {
      console.error(err);
    } finally {
      setTradesLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategySummary();
    setCurrentPage(1); // Reset page on date or strategy change
  }, [strategyId, startDate, endDate]);

  useEffect(() => {
    fetchStrategyTrades();
  }, [strategyId, startDate, endDate, regimeFilter, currentPage]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        Loading strategy profile...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
        Failed to load details: {error || 'Unknown Error'}
      </div>
    );
  }

  // Pre-process chart data
  // Generate cumulative equity curves and drawdown curves
  let cumPnL = 0;
  let runningPeak = 0;
  
  const chartData = (data.trades || []).map((t, idx) => {
    cumPnL += t.expiry_pnl;
    if (cumPnL > runningPeak) {
      runningPeak = cumPnL;
    }
    const drawdown = cumPnL - runningPeak;

    return {
      index: idx + 1,
      date: t.date,
      pnl: t.expiry_pnl,
      cumulative: parseFloat(cumPnL.toFixed(2)),
      drawdown: parseFloat(drawdown.toFixed(2))
    };
  });

  const metrics = data.metrics || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Strategy Description Banner */}
      <section className="card animate-fade-in" style={{ display: 'flex', gap: '1.2rem', alignItems: 'flex-start', background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))' }}>
        <div style={{ background: 'var(--primary-glow)', padding: '0.8rem', borderRadius: 'var(--radius-md)', color: 'var(--primary)', marginTop: '0.2rem' }}>
          <Info size={24} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>Strategy Overview</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            {data.description}
          </p>
          <div style={{ marginTop: '0.8rem', display: 'flex', gap: '1.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Execution cadence: <strong style={{ color: 'var(--text-primary)' }}>{data.frequency}</strong>
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Target Asset: <strong style={{ color: 'var(--text-primary)' }}>BankNifty Options</strong>
            </span>
          </div>
        </div>
      </section>

      {/* Dynamic Key Stats for the Selected Strategy & Date Range */}
      <section className="grid-4 animate-fade-in">
        <div className="card">
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>STRATEGY PNL</span>
          <h3 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.2rem 0', color: metrics.totalPnL >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            ₹{(metrics.totalPnL || 0).toLocaleString('en-IN')}
          </h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Accumulated return</span>
        </div>
        <div className="card">
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>WIN RATE</span>
          <h3 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.2rem 0' }}>
            {metrics.winRate || 0}%
          </h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{metrics.totalTrades} total trades simulated</span>
        </div>
        <div className="card">
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>MAX DRAWDOWN</span>
          <h3 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.2rem 0', color: 'var(--danger)' }}>
            ₹{(metrics.maxDrawdown || 0).toLocaleString('en-IN')}
          </h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Largest Peak-to-Trough drop</span>
        </div>
        <div className="card">
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>SHARPE RATIO</span>
          <h3 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.2rem 0', color: 'var(--warning)' }}>
            {metrics.sharpeRatio || '0.00'}
          </h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Annualised (Risk-Free: 6.5%)</span>
        </div>
      </section>

      {/* Grid containing Charts */}
      <section className="grid-2 animate-fade-in">
        
        {/* Cumulative Equity Curve Chart */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem' }}>Cumulative Equity Growth Curve</h3>
          <div style={{ width: '100%', height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                <YAxis 
                  stroke="var(--text-muted)" 
                  fontSize={10} 
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'Cumulative P&L']}
                />
                <Area type="monotone" dataKey="cumulative" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorCum)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Drawdown Curve (Red gradient area chart) */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem' }}>Drawdown Profile</h3>
          <div style={{ width: '100%', height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorDD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                <YAxis 
                  stroke="var(--text-muted)" 
                  fontSize={10} 
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'Drawdown']}
                />
                <Area type="monotone" dataKey="drawdown" stroke="var(--danger)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorDD)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Return Breakdown Bar Chart */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem' }}>Monthly Performance Breakdown</h3>
          <div style={{ width: '100%', height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                <YAxis 
                  stroke="var(--text-muted)" 
                  fontSize={10} 
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'PnL']}
                />
                <Bar dataKey="pnl">
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.pnl >= 0 ? 'var(--success)' : 'var(--danger)'} 
                      fillOpacity={0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Trade Log table */}
      <section className="card animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} color="var(--primary)" />
            <h2 style={{ fontSize: '1.2rem' }}>Trade Logs Database</h2>
          </div>

          {/* Regime Filtering Options */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Filter size={14} /> Filter Regime:
            </span>
            <select 
              value={regimeFilter} 
              onChange={(e) => { setRegimeFilter(e.target.value); setCurrentPage(1); }}
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
            >
              <option value="All">All Regimes</option>
              <option value="Trending Up">Trending Up</option>
              <option value="Trending Down">Trending Down</option>
              <option value="Sideways">Sideways</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>
        </div>

        {tradesLoading ? (
          <div style={{ height: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)' }}>
            Retrieving SQL records...
          </div>
        ) : trades.length === 0 ? (
          <div style={{ height: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            No trades match the selected date or regime filters.
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Entry Date</th>
                    <th>Expiry Date</th>
                    <th>Spot Price</th>
                    <th>Strike Price</th>
                    <th>Prem. Received</th>
                    <th>Prem. Paid</th>
                    <th>Lot Size</th>
                    <th>Net P&L</th>
                    <th>Regime</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.id}>
                      <td>{trade.date}</td>
                      <td>{trade.expiry}</td>
                      <td>₹{trade.entry_spot.toLocaleString('en-IN')}</td>
                      <td>{trade.strike.toLocaleString('en-IN')}</td>
                      <td>{trade.premium_received > 0 ? `₹${trade.premium_received}` : '-'}</td>
                      <td>{trade.premium_paid > 0 ? `₹${trade.premium_paid}` : '-'}</td>
                      <td>{trade.lot_size}</td>
                      <td style={{ color: trade.expiry_pnl >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {trade.expiry_pnl >= 0 ? '+' : ''}₹{trade.expiry_pnl.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className={`badge ${
                          trade.regime === 'Trending Up' ? 'badge-success' : 
                          trade.regime === 'Trending Down' ? 'badge-danger' : 
                          trade.regime === 'Sideways' ? 'badge-warning' : 'badge-secondary'
                        }`} style={trade.regime === 'Unknown' ? {background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)'} : {}}>
                          {trade.regime}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.2rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Showing page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalCount} trades found)
                </span>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem' }}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem' }}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

    </div>
  );
}
