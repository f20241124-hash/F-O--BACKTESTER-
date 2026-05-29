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


def run_iron_condor_backtest(data_path):

    print("Initializing BankNifty Weekly Iron Condor Backtest...")

    df = load_options_data(data_path)

    if df is None or df.empty:
        print("Data failed to load. Halting backtest.")
        return

    # Create week identifier
    df['YearWeek'] = (
        df['Date'].dt.year.astype(str)
        + "-"
        + df['Date'].dt.isocalendar().week.astype(str)
    )

    weeks = df['YearWeek'].unique()

    results = []

    print(f"Running strategy across {len(weeks)} weekly cycles...")

    for week in weeks:

        week_data = df[df['YearWeek'] == week]

        monday_data = week_data[
            week_data['Date'].dt.weekday == 0
        ]

        thursday_data = week_data[
            week_data['Date'].dt.weekday == 3
        ]

        if monday_data.empty or thursday_data.empty:
            continue

        entry_date = monday_data['Date'].min()
        exit_date = thursday_data['Date'].max()

        entry_day_data = week_data[
            week_data['Date'] == entry_date
        ]

        exit_day_data = week_data[
            week_data['Date'] == exit_date
        ]

        if entry_day_data.empty or exit_day_data.empty:
            continue

        # Approximate spot price
        entry_spot = entry_day_data['Strike'].median()

        atm_strike = get_atm_strike(entry_spot)

        # Iron Condor strikes
        sell_ce_strike = atm_strike + 100
        buy_ce_strike = atm_strike + 200

        sell_pe_strike = atm_strike - 100
        buy_pe_strike = atm_strike - 200

        try:

            sell_ce_entry = entry_day_data[
                (entry_day_data['Strike'] == sell_ce_strike) &
                (entry_day_data['OptionType'] == 'CE')
            ]['ClosePrice'].values[0]

            buy_ce_entry = entry_day_data[
                (entry_day_data['Strike'] == buy_ce_strike) &
                (entry_day_data['OptionType'] == 'CE')
            ]['ClosePrice'].values[0]

            sell_pe_entry = entry_day_data[
                (entry_day_data['Strike'] == sell_pe_strike) &
                (entry_day_data['OptionType'] == 'PE')
            ]['ClosePrice'].values[0]

            buy_pe_entry = entry_day_data[
                (entry_day_data['Strike'] == buy_pe_strike) &
                (entry_day_data['OptionType'] == 'PE')
            ]['ClosePrice'].values[0]

            sell_ce_exit = exit_day_data[
                (exit_day_data['Strike'] == sell_ce_strike) &
                (exit_day_data['OptionType'] == 'CE')
            ]['ClosePrice'].values[0]

            buy_ce_exit = exit_day_data[
                (exit_day_data['Strike'] == buy_ce_strike) &
                (exit_day_data['OptionType'] == 'CE')
            ]['ClosePrice'].values[0]

            sell_pe_exit = exit_day_data[
                (exit_day_data['Strike'] == sell_pe_strike) &
                (exit_day_data['OptionType'] == 'PE')
            ]['ClosePrice'].values[0]

            buy_pe_exit = exit_day_data[
                (exit_day_data['Strike'] == buy_pe_strike) &
                (exit_day_data['OptionType'] == 'PE')
            ]['ClosePrice'].values[0]

        except IndexError:
            continue

        # Net premium received
        total_credit = (
            sell_ce_entry
            + sell_pe_entry
            - buy_ce_entry
            - buy_pe_entry
        )

        # Cost to close
        total_debit = (
            sell_ce_exit
            + sell_pe_exit
            - buy_ce_exit
            - buy_pe_exit
        )

        # Net points earned
        net_points = total_credit - total_debit

        lot_size = get_banknifty_lot_size(entry_date)

        trade_pnl = net_points * lot_size

        results.append({
            'Entry_Date': entry_date.strftime('%Y-%m-%d'),
            'Exit_Date': exit_date.strftime('%Y-%m-%d'),
            'Entry_Spot': round(entry_spot, 2),
            'ATM_Strike': atm_strike,
            #'Sell_CE': sell_ce_strike,
            #'Buy_CE': buy_ce_strike,
            #'Sell_PE': sell_pe_strike,
            #'Buy_PE': buy_pe_strike,
            'Premium_Received': round(total_credit, 2),
            'Premium_Paid_To_Close': round(total_debit, 2),
            #'Net_Points': round(net_points, 2),
            'Lot_Size': lot_size,
            'Expiry_PnL': round(trade_pnl, 2)
        })

    results_df = pd.DataFrame(results)

    output_file = os.path.join(
        os.path.dirname(__file__),
        '..',
        'results',
        'iron_condor_results.csv'
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

    run_iron_condor_backtest(master_data_path)