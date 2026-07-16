import React, { useState, useEffect } from 'react';
import { Compass, HelpCircle, AlertCircle, ArrowUpRight, TrendingUp, BarChart2, ShieldCheck, Loader2 } from 'lucide-react';

export default function PredictionsRecommendations({ strategies }) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSimRegime, setSelectedSimRegime] = useState(''); // Simulated regime override

  const fetchPrediction = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/predictions');
      const json = await response.json();
      setPrediction(json);
      if (json.success && json.predictedRegime) {
        setSelectedSimRegime(json.predictedRegime);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column', gap: '1rem' }}>
        <Loader2 size={36} className="animate-spin" color="var(--primary)" />
        <span style={{ color: 'var(--text-secondary)' }}>Running Markov Forecasting Models...</span>
      </div>
    );
  }

  if (!prediction || !prediction.success) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
        Failed to fetch prediction metrics. Make sure the database is seeded.
      </div>
    );
  }

  const { probabilities, recentMomentum, currentMonthRegime, predictedRegime, recommendations } = prediction;

  // Determine color theme based on regime
  const getRegimeColor = (reg) => {
    if (reg === 'Trending Up') return 'var(--success)';
    if (reg === 'Trending Down') return 'var(--danger)';
    return 'var(--warning)';
  };

  // Logic to calculate simulation recommendations based on user's manual override
  // Sort strategies based on their win rate or avg PnL in the simulated regime
  const simulatedRecommendations = [...recommendations].map(rec => {
    // Look up historical stats from the strategies list if available
    const strat = strategies.find(s => s.id === rec.id) || {};
    // Calculate expected performance for selectedSimRegime (mock/derived from historical logs)
    let simWinRate = rec.winRate;
    let simAvgPnL = rec.avgPnL;
    let simRankScore = 0;

    if (rec.id === 'covered_call') {
      if (selectedSimRegime === 'Trending Up') { simWinRate = 92; simAvgPnL = 48500; simRankScore = 1; }
      else if (selectedSimRegime === 'Trending Down') { simWinRate = 45; simAvgPnL = -12000; simRankScore = 4; }
      else { simWinRate = 86; simAvgPnL = 29000; simRankScore = 2; }
    } else if (rec.id === 'iron_condor') {
      if (selectedSimRegime === 'Trending Up') { simWinRate = 60; simAvgPnL = 12000; simRankScore = 3; }
      else if (selectedSimRegime === 'Trending Down') { simWinRate = 50; simAvgPnL = -5000; simRankScore = 3; }
      else { simWinRate = 82; simAvgPnL = 41000; simRankScore = 1; }
    } else if (rec.id === 'bull_call_spread') {
      if (selectedSimRegime === 'Trending Up') { simWinRate = 85; simAvgPnL = 35000; simRankScore = 2; }
      else if (selectedSimRegime === 'Trending Down') { simWinRate = 35; simAvgPnL = -8000; simRankScore = 2; }
      else { simWinRate = 72; simAvgPnL = 18000; simRankScore = 3; }
    } else if (rec.id === 'straddle') {
      if (selectedSimRegime === 'Trending Up') { simWinRate = 40; simAvgPnL = -15000; simRankScore = 4; }
      else if (selectedSimRegime === 'Trending Down') { simWinRate = 80; simAvgPnL = 52000; simRankScore = 1; }
      else { simWinRate = 30; simAvgPnL = -28000; simRankScore = 4; }
    }

    return {
      ...rec,
      winRate: simWinRate,
      avgPnL: simAvgPnL,
      simRankScore
    };
  }).sort((a, b) => b.avgPnL - a.avgPnL);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Overview Prediction Panel */}
      <section className="grid-2 animate-fade-in">
        
        {/* Next Month Forecast Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Compass size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.1rem' }}>Forecasting Model Result</h2>
          </div>

          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Forecasted Next Month Regime</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginTop: '0.3rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: getRegimeColor(predictedRegime) }}>
                {predictedRegime}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                ({probabilities[predictedRegime]}% Confidence)
              </span>
            </div>
          </div>

          {/* Probability Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {Object.keys(probabilities).map(reg => (
              <div key={reg}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                  <span>{reg}</span>
                  <span style={{ fontWeight: 600 }}>{probabilities[reg]}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${probabilities[reg]}%`, 
                    height: '100%', 
                    background: getRegimeColor(reg),
                    borderRadius: '3px'
                  }}></div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem' }}>
            <AlertCircle size={14} /> Forecast computed via historical Markov Transition Frequencies of BankNifty monthly closes.
          </div>
        </div>

        {/* Technical Momentum Factors */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.1rem' }}>Technical Momentum Indicators</h2>
          </div>

          <div className="grid-2" style={{ gap: '1rem' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>20-DAY VS 50-DAY SMA</span>
              <h4 style={{ fontSize: '1.2rem', marginTop: '0.2rem', color: recentMomentum.bullish ? 'var(--success)' : 'var(--danger)' }}>
                {recentMomentum.bullish ? 'Golden Cross 🐂' : 'Death Cross 🐻'}
              </h4>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                SMA20: {recentMomentum.sma20.toLocaleString()} | SMA50: {recentMomentum.sma50.toLocaleString()}
              </p>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>15-DAY RETURN TREND</span>
              <h4 style={{ fontSize: '1.2rem', marginTop: '0.2rem', color: recentMomentum.fifteenDayReturnPercent >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {recentMomentum.fifteenDayReturnPercent >= 0 ? '+' : ''}{recentMomentum.fifteenDayReturnPercent}%
              </h4>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                Short-term underlying momentum
              </p>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CURRENT MONTH REGIME</span>
              <h4 style={{ fontSize: '1.2rem', marginTop: '0.2rem', color: getRegimeColor(currentMonthRegime) }}>
                {currentMonthRegime}
              </h4>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                Transition starting state
              </p>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PREDICTIVE STRATEGY FIT</span>
              <h4 style={{ fontSize: '1.2rem', marginTop: '0.2rem', color: 'var(--primary)' }}>
                {recommendations[0]?.name || 'Covered Call'}
              </h4>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                Probability weighted choice
              </p>
            </div>
          </div>
        </div>

      </section>

      {/* Strategy Recommendation Simulation Widget */}
      <section className="card animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>Strategy Recommendation Rankings</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.1rem' }}>
              Simulate strategy rankings based on your own forecasted regime.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Simulate Regime:</span>
            <select 
              value={selectedSimRegime}
              onChange={(e) => setSelectedSimRegime(e.target.value)}
              style={{ padding: '0.4rem 0.8rem', background: 'var(--bg-secondary)' }}
            >
              <option value="Trending Up">Trending Up (&gt;3%)</option>
              <option value="Trending Down">Trending Down (&lt;-3%)</option>
              <option value="Sideways">Sideways (-3% to 3%)</option>
            </select>
          </div>
        </div>

        {/* List of strategies, order dynamically based on sim PnL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {simulatedRecommendations.map((rec, index) => {
            const isTop = index === 0;
            return (
              <div 
                key={rec.id}
                className="card"
                style={{ 
                  background: isTop ? 'rgba(99, 102, 241, 0.04)' : 'var(--glass-bg)',
                  borderColor: isTop ? 'rgba(99, 102, 241, 0.25)' : 'var(--glass-border)',
                  display: 'flex', 
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.2rem',
                  gap: '1.5rem',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', minWidth: '240px' }}>
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    background: isTop ? 'var(--primary)' : 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: 'white'
                  }}>
                    {index + 1}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {rec.name}
                      {isTop && (
                        <span className="badge badge-success" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}>
                          <ShieldCheck size={10} style={{ marginRight: '2px' }} /> Recommended
                        </span>
                      )}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem', maxWidth: '580px' }}>
                      {rec.reason}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Simulated Win Rate</span>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.1rem' }}>{rec.winRate}%</h4>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '130px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Expected P&L / Trade</span>
                    <h4 style={{ 
                      fontSize: '1.2rem', 
                      fontWeight: 700, 
                      marginTop: '0.1rem',
                      color: rec.avgPnL >= 0 ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {rec.avgPnL >= 0 ? '+' : ''}₹{rec.avgPnL.toLocaleString('en-IN')}
                    </h4>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
