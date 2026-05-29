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
    - April 2024 onwards: 15
    """
    if trade_date >= pd.to_datetime('2023-07-01'):
        return 15
    return 25

def run_straddle_backtest(data_path):
    print("Initializing BankNifty Long Straddle Strategy Backtest...")
    
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
        entry_day_data = month_data[month_data['Date'] == entry_date]
        
        # Safely find actual exit date
        actual_exit_date = month_data['Date'].max()
        expiry_day_data = month_data[month_data['Date'] == actual_exit_date]
        
        if entry_day_data.empty or expiry_day_data.empty:
            continue
            
        entry_nifty_price = entry_day_data['Strike'].median()
        atm_strike = get_atm_strike(entry_nifty_price)
        
        # STRADDLE LOGIC: Buy ATM Call AND Buy ATM Put
        ce_option = entry_day_data[(entry_day_data['Strike'] == atm_strike) & 
                                   (entry_day_data['OptionType'] == 'CE')]
        pe_option = entry_day_data[(entry_day_data['Strike'] == atm_strike) & 
                                   (entry_day_data['OptionType'] == 'PE')]
        
        if ce_option.empty or pe_option.empty:
            continue 
            
        # Calculate total cost to enter the trade
        ce_premium_paid = ce_option['ClosePrice'].values[0]
        pe_premium_paid = pe_option['ClosePrice'].values[0]
        total_premium_paid = ce_premium_paid + pe_premium_paid
        
        exit_nifty_price = expiry_day_data['Strike'].median() 
        
        # Payoffs at expiry
        ce_payout = max(0, exit_nifty_price - atm_strike)
        pe_payout = max(0, atm_strike - exit_nifty_price)
        total_payout = ce_payout + pe_payout
        
        lot_size = get_banknifty_lot_size(entry_date)
        
        # Net profit/loss formula
        net_points = total_payout - total_premium_paid
        trade_pnl = net_points * lot_size
        
        results.append({
            'Date': entry_date.strftime('%Y-%m-%d'),
            'Expiry': actual_exit_date.strftime('%Y-%m-%d'),
            'Entry_Spot': entry_nifty_price,
            'Strike': atm_strike,
            'Total_Premium_Paid': round(total_premium_paid, 2),
            'Lot_Size': lot_size,
            'Expiry_PnL': round(trade_pnl, 2)
        })

    results_df = pd.DataFrame(results)
    
    # Save to a new results file!
    output_file = os.path.join(os.path.dirname(__file__), '..', 'results', 'straddle_results.csv')
    results_df.to_csv(output_file, index=False)
    
    print("\n--- Strategy Execution Complete ---")
    print(f"Total Trades Simulated: {len(results_df)}")
    print(f"Results successfully saved to: {output_file}")
    
    print("\nFirst 5 Trades Preview:")
    print(results_df.head(5))

if __name__ == "__main__":
    # Point directly to your master dataset
    master_data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'banknifty_options_master.csv')
    run_straddle_backtest(master_data_path)