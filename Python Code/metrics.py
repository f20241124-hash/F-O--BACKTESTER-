import pandas as pd
import numpy as np


def total_pnl(trades_df):
    """
    Returns total profit/loss across all trades.
    """
    return trades_df['Expiry_PnL'].sum()


def win_rate(trades_df):
    """
    Percentage of profitable trades.
    """
    total_trades = len(trades_df)

    if total_trades == 0:
        return 0

    winning_trades = len(
        trades_df[trades_df['Expiry_PnL'] > 0]
    )

    return (winning_trades / total_trades) * 100


def max_drawdown(trades_df):
    """
    Maximum drawdown based on cumulative P&L.

    Steps:
    1. Create running cumulative P&L
    2. Track highest value reached so far
    3. Measure drop from peak
    4. Return largest drop
    """

    cumulative_pnl = trades_df['Expiry_PnL'].cumsum()

    running_peak = cumulative_pnl.cummax()

    drawdown = cumulative_pnl - running_peak

    return drawdown.min()


def sharpe_ratio(trades_df, risk_free=0.065):
    """
    Annualised Sharpe Ratio.

    risk_free = 6.5% by default
    """

    if len(trades_df) < 2:
        return 0

    returns = trades_df['Expiry_PnL']

    mean_return = returns.mean()

    std_return = returns.std()

    if std_return == 0:
        return 0

    excess_return = mean_return - risk_free

    sharpe = excess_return / std_return

    annualised_sharpe = sharpe * np.sqrt(12)

    return annualised_sharpe


def avg_monthly_return(trades_df):
    """
    Average monthly profit/loss.
    """

    if len(trades_df) == 0:
        return 0

    if 'Date' not in trades_df.columns:
        return trades_df['Expiry_PnL'].mean()

    trades_df = trades_df.copy()

    trades_df['Date'] = pd.to_datetime(
        trades_df['Date']
    )

    trades_df['Month'] = (
        trades_df['Date']
        .dt.to_period('M')
    )

    monthly_returns = (
        trades_df
        .groupby('Month')['Expiry_PnL']
        .sum()
    )

    return monthly_returns.mean()

def regime_analysis(trades_df):
    """
    Calculate performance separately for each market regime.

    Returns:
        DataFrame with:
        - Number of trades
        - Total PnL
        - Average PnL
        - Win Rate
    """

    if 'Regime' not in trades_df.columns:
        raise ValueError(
            "Regime column not found. "
            "Run add_regime.py first."
        )

    analysis = (
        trades_df
        .groupby('Regime')
        .agg(
            Trades=('Expiry_PnL', 'count'),
            Total_PnL=('Expiry_PnL', 'sum'),
            Avg_PnL=('Expiry_PnL', 'mean')
        )
    )

    win_rates = (
        trades_df
        .groupby('Regime')['Expiry_PnL']
        .apply(lambda x: (x > 0).mean() * 100)
    )

    analysis['Win_Rate'] = win_rates

    return analysis.round(2)

if __name__ == "__main__":

    results = pd.read_csv(
        "results/covered_call_results_regime.csv"
    )

    print("Total PnL:", total_pnl(results))
    print("Win Rate:", win_rate(results))
    print("Max Drawdown:", max_drawdown(results))
    print("Sharpe Ratio:", sharpe_ratio(results))
    print("Average Monthly Return:", avg_monthly_return(results))

    print("\n=== Regime Analysis ===")
    print(regime_analysis(results))