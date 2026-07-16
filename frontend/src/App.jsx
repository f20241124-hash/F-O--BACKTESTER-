import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  Layers, 
  Activity, 
  Calendar, 
  Play, 
  Loader2, 
  Compass, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import DashboardOverview from './components/DashboardOverview';
import StrategyDetails from './components/StrategyDetails';
import PredictionsRecommendations from './components/PredictionsRecommendations';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'covered_call', 'iron_condor', 'bull_call_spread', 'straddle', 'predictions'
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [loading, setLoading] = useState(false);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [strategies, setStrategies] = useState([]);
  const [error, setError] = useState(null);

  // Load strategy summary list with current date range
  const loadStrategies = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/strategies?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) {
        throw new Error('Database connection failed. Please ensure SQL Server is running and seeded.');
      }
      const data = await response.ok ? await response.json() : [];
      setStrategies(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStrategies();
  }, [startDate, endDate]);

  const triggerBacktestRerun = async () => {
    setRunningBacktest(true);
    try {
      const response = await fetch('/api/backtest/run', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        alert('Backtesting Rerun Pipeline Completed Successfully! Database has been re-seeded.');
        loadStrategies();
      } else {
        alert('Backtest run failed: ' + data.message);
      }
    } catch (err) {
      alert('Network error triggering backtest run: ' + err.message);
    } finally {
      setRunningBacktest(false);
    }
  };

  // Find portfolio metrics
  const portfolioPnL = strategies.reduce((sum, s) => sum + (s.metrics?.totalPnL || 0), 0);
  const avgWinRate = strategies.length > 0 
    ? strategies.reduce((sum, s) => sum + (s.metrics?.winRate || 0), 0) / strategies.length 
    : 0;

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <TrendingUp size={28} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>F&O Backtester</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Institutional Engine</span>
          </div>
        </div>

        <nav style={{ padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button 
            className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: '100%', justifyContent: 'flex-start', border: activeTab === 'overview' ? 'none' : '1px solid transparent' }}
            onClick={() => setActiveTab('overview')}
          >
            <BarChart3 size={18} /> Overview
          </button>
          
          <div style={{ margin: '1rem 0 0.5rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Strategies
          </div>

          <button 
            className={`btn ${activeTab === 'covered_call' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: '100%', justifyContent: 'flex-start', border: activeTab === 'covered_call' ? 'none' : '1px solid transparent' }}
            onClick={() => setActiveTab('covered_call')}
          >
            <Layers size={16} /> Covered Call
          </button>

          <button 
            className={`btn ${activeTab === 'iron_condor' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: '100%', justifyContent: 'flex-start', border: activeTab === 'iron_condor' ? 'none' : '1px solid transparent' }}
            onClick={() => setActiveTab('iron_condor')}
          >
            <Layers size={16} /> Iron Condor
          </button>

          <button 
            className={`btn ${activeTab === 'bull_call_spread' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: '100%', justifyContent: 'flex-start', border: activeTab === 'bull_call_spread' ? 'none' : '1px solid transparent' }}
            onClick={() => setActiveTab('bull_call_spread')}
          >
            <Layers size={16} /> Bull Call Spread
          </button>

          <button 
            className={`btn ${activeTab === 'straddle' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: '100%', justifyContent: 'flex-start', border: activeTab === 'straddle' ? 'none' : '1px solid transparent' }}
            onClick={() => setActiveTab('straddle')}
          >
            <Layers size={16} /> Long Straddle
          </button>

          <div style={{ margin: '1rem 0 0.5rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Intelligence
          </div>

          <button 
            className={`btn ${activeTab === 'predictions' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: '100%', justifyContent: 'flex-start', border: activeTab === 'predictions' ? 'none' : '1px solid transparent' }}
            onClick={() => setActiveTab('predictions')}
          >
            <Compass size={18} /> Regime Predictor
          </button>
        </nav>

        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', fontSize: '0.85rem' }} 
            onClick={triggerBacktestRerun} 
            disabled={runningBacktest}
          >
            {runningBacktest ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Running...
              </>
            ) : (
              <>
                <Play size={16} fill="white" /> Run Python Simulator
              </>
            )}
          </button>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Uses 1,000,000+ historical rows
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content">
        {/* Top Control Bar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>
              {activeTab === 'overview' && 'Strategy Overview Dashboard'}
              {activeTab === 'covered_call' && 'Covered Call Strategy Analysis'}
              {activeTab === 'iron_condor' && 'Weekly Iron Condor Strategy Analysis'}
              {activeTab === 'bull_call_spread' && 'Bull Call Spread Strategy Analysis'}
              {activeTab === 'straddle' && 'Long Straddle Strategy Analysis'}
              {activeTab === 'predictions' && 'Future Predictions & Regime Guide'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Historical performance data compiled from Jan 2022 to Dec 2024
            </p>
          </div>

          {/* Date Picker Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <Calendar size={18} color="var(--text-secondary)" />
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ margin: 0 }}>From:</label>
              <input 
                type="date" 
                value={startDate} 
                min="2022-01-01"
                max="2024-12-31"
                onChange={(e) => setStartDate(e.target.value)} 
                style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
              />
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ margin: 0 }}>To:</label>
              <input 
                type="date" 
                value={endDate} 
                min="2022-01-01"
                max="2024-12-31"
                onChange={(e) => setEndDate(e.target.value)} 
                style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
              />
            </div>
          </div>
        </header>

        {/* Global Key Stats Cards (Not shown on Predictions tab for spacing) */}
        {activeTab !== 'predictions' && (
          <section className="grid-3 animate-fade-in">
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Combined Portfolio PnL</span>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: portfolioPnL >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {portfolioPnL >= 0 ? '+' : ''}₹{portfolioPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <Activity size={12} /> Combined strategy metrics across range
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Average Win Rate</span>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {avgWinRate.toFixed(2)}%
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <Activity size={12} /> Percentage of profitable periods
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Risk Settings</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--warning)', margin: '0.4rem 0' }}>
                Zero Slippage Baseline
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <HelpCircle size={12} /> Standard broker commission = ₹0 assumptions
              </div>
            </div>
          </section>
        )}

        {/* Database Error Banner */}
        {error && (
          <div className="card" style={{ borderLeft: '4px solid var(--danger)', background: 'var(--danger-glow)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <AlertCircle size={24} color="var(--danger)" />
            <div>
              <h3 style={{ color: 'var(--danger)', fontSize: '1rem', fontWeight: 600 }}>Database Connection Error</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                Could not connect to SQL Server. Make sure your local SQL Server instance is running, the database 'BacktesterDB' exists, and configuration variables are set correctly in the `backend/.env` file.
              </p>
            </div>
          </div>
        )}

        {/* Tab Routing Rendering */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flexDirection: 'column', gap: '1rem' }}>
            <Loader2 size={40} className="animate-spin" color="var(--primary)" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Recalculating SQL queries...</span>
          </div>
        )}

        {!loading && !error && (
          <div className="tab-container animate-fade-in">
            {activeTab === 'overview' && (
              <DashboardOverview 
                strategies={strategies} 
                startDate={startDate} 
                endDate={endDate} 
                setActiveTab={setActiveTab} 
              />
            )}
            
            {activeTab === 'covered_call' && (
              <StrategyDetails strategyId="covered_call" startDate={startDate} endDate={endDate} />
            )}

            {activeTab === 'iron_condor' && (
              <StrategyDetails strategyId="iron_condor" startDate={startDate} endDate={endDate} />
            )}

            {activeTab === 'bull_call_spread' && (
              <StrategyDetails strategyId="bull_call_spread" startDate={startDate} endDate={endDate} />
            )}

            {activeTab === 'straddle' && (
              <StrategyDetails strategyId="straddle" startDate={startDate} endDate={endDate} />
            )}

            {activeTab === 'predictions' && (
              <PredictionsRecommendations strategies={strategies} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
