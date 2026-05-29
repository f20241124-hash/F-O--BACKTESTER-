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
    - July 2023 to April 2024: 15
    - April 2024 onwards: 15 (with some contract changes, but keeping 15 as base)
    """
    if trade_date >= pd.to_datetime('2023-07-01'):
        return 15
    return 25

def run_covered_call_backtest(data_path):
    print("Initializing BankNifty Covered Call Strategy Backtest...")
    
    df = load_options_data(data_path)
    if df is None or df.empty:
        print("Data failed to load. Halting backtest.")
        return
        
    # Crucial Fix for Real Data: Convert ClosePrice to numeric, forcing text/typos to NaN
    df['ClosePrice'] = pd.to_numeric(df['ClosePrice'], errors='coerce')
    df = df.dropna(subset=['ClosePrice'])
    df = df[df['ClosePrice'] > 0]
        
    df['YearMonth'] = df['Date'].dt.to_period('M')
    months = df['YearMonth'].unique()
    
    results = []
    
    print(f"Running strategy across {len(months)} monthly cycles...")
    
    for month in months:
        month_data = df[df['YearMonth'] == month]
        
        entry_date = month_data['Date'].min()
        entry_day_data = month_data[month_data['Date'] == entry_date]
        
        # BULLETPROOF FIX: Find the actual last trading date in the dataset, bypassing holidays!
        actual_exit_date = month_data['Date'].max()
        expiry_day_data = month_data[month_data['Date'] == actual_exit_date]
        
        if entry_day_data.empty or expiry_day_data.empty:
            continue
            
        entry_nifty_price = entry_day_data['Strike'].median()
        
        # Real project parameter: ATM + 200
        atm_strike = get_atm_strike(entry_nifty_price)
        target_strike_sold = atm_strike + 200
        
        ce_option = entry_day_data[(entry_day_data['Strike'] == target_strike_sold) & 
                                   (entry_day_data['OptionType'] == 'CE')]
        
        if ce_option.empty:
            continue 
            
        premium_received = ce_option['ClosePrice'].values[0]
        
        exit_nifty_price = expiry_day_data['Strike'].median() 
        call_payout = max(0, exit_nifty_price - target_strike_sold)
        
        lot_size = get_banknifty_lot_size(entry_date)
        
        nifty_movement = exit_nifty_price - entry_nifty_price
        net_points = nifty_movement + premium_received - call_payout
        trade_pnl = net_points * lot_size
        
        results.append({
            'Date': entry_date.strftime('%Y-%m-%d'),
            'Expiry': actual_exit_date.strftime('%Y-%m-%d'),
            'Entry_Spot': entry_nifty_price,
            'Strike_Sold': target_strike_sold,
            'Premium_Received': round(premium_received, 2),
            'Lot_Size': lot_size,
            'Expiry_PnL': round(trade_pnl, 2)
        })

    results_df = pd.DataFrame(results)
    output_file = os.path.join(os.path.dirname(__file__), '..', 'results', 'covered_call_results.csv')
    results_df.to_csv(output_file, index=False)
    
    print("\n--- Strategy Execution Complete ---")
    print(f"Total Trades Simulated: {len(results_df)}")
    print(f"Results successfully saved to: {output_file}")
    
    print("\nFirst 5 Trades Preview:")
    print(results_df.head(5))

if __name__ == "__main__":
    # POINTING DIRECTLY TO YOUR NEW MILLION-ROW MASTER CSV
    master_data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'banknifty_options_master.csv')
    run_covered_call_backtest(master_data_path)