import pandas as pd
import numpy as np
import os
import sys

# Add the parent directory to the path so we can import data_loader
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from data_loader import load_options_data, get_atm_strike


def get_banknifty_lot_size(trade_date):
    """
    BankNifty lot size rules:
    - Prior to July 2023: 25
    - July 2023 onwards: 15
    """
    if trade_date >= pd.to_datetime('2023-07-01'):
        return 15
    return 25


def run_bull_call_spread_backtest(data_path):

    print("Initializing BankNifty Bull Call Spread Strategy Backtest...")

    df = load_options_data(data_path)

    if df is None or df.empty:
        print("Data failed to load. Halting backtest.")
        return

    df['YearMonth'] = df['Date'].dt.to_period('M')
    months = df['YearMonth'].unique()

    results = []

    print(f"Running strategy across {len(months)} monthly cycles...")

    for month in months:

        month_data = df[df['YearMonth'] == month]

        entry_date = month_data['Date'].min()
        actual_exit_date = month_data['Date'].max()

        entry_day_data = month_data[
            month_data['Date'] == entry_date
        ]

        expiry_day_data = month_data[
            month_data['Date'] == actual_exit_date
        ]

        if entry_day_data.empty or expiry_day_data.empty:
            continue

        # Approximate spot price
        entry_spot = entry_day_data['Strike'].median()

        atm_strike = get_atm_strike(entry_spot)

        # Bull Call Spread
        buy_call_strike = atm_strike
        sell_call_strike = atm_strike + 100

        buy_call = entry_day_data[
            (entry_day_data['Strike'] == buy_call_strike) &
            (entry_day_data['OptionType'] == 'CE')
        ]

        sell_call = entry_day_data[
            (entry_day_data['Strike'] == sell_call_strike) &
            (entry_day_data['OptionType'] == 'CE')
        ]

        if buy_call.empty or sell_call.empty:
            continue

        buy_call_premium = buy_call['ClosePrice'].values[0]
        sell_call_premium = sell_call['ClosePrice'].values[0]

        # Net premium paid
        net_premium_paid = (
            buy_call_premium -
            sell_call_premium
        )

        exit_spot = expiry_day_data['Strike'].median()

        # Payoff at expiry

        long_call_payoff = max(
            0,
            exit_spot - buy_call_strike
        )

        short_call_payoff = -max(
            0,
            exit_spot - sell_call_strike
        )

        total_payoff = (
            long_call_payoff +
            short_call_payoff
        )

        lot_size = get_banknifty_lot_size(entry_date)

        net_points = (
            total_payoff -
            net_premium_paid
        )

        trade_pnl = (
            net_points *
            lot_size
        )

        results.append({
            'Date': entry_date.strftime('%Y-%m-%d'),
            'Expiry': actual_exit_date.strftime('%Y-%m-%d'),
            'Entry_Spot': round(entry_spot, 2),
            'ATM_Strike': atm_strike,
            'Buy_Call_Strike': buy_call_strike,
            'Sell_Call_Strike': sell_call_strike,
            'Net_Premium_Paid': round(net_premium_paid, 2),
            'Expiry_Spot': round(exit_spot, 2),
            'Spread_Payoff': round(total_payoff, 2),
            'Lot_Size': lot_size,
            'Expiry_PnL': round(trade_pnl, 2)
        })

    results_df = pd.DataFrame(results)

    output_file = os.path.join(
        os.path.dirname(__file__),
        '..',
        'results',
        'bull_call_spread_results.csv'
    )

    results_df.to_csv(output_file, index=False)

    print("\n--- Strategy Execution Complete ---")
    print(f"Total Trades Simulated: {len(results_df)}")
    print(f"Results successfully saved to: {output_file}")

    print("\nFirst 5 Trades Preview:")
    print(results_df.head())


if __name__ == "__main__":

    master_data_path = os.path.join(
        os.path.dirname(__file__),
        '..',
        'data',
        'banknifty_options_master.csv'
    )

    run_bull_call_spread_backtest(master_data_path)