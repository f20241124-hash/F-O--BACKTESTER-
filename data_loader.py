import pandas as pd
import os

def load_options_data(file_path):
    """
    Loads raw NSE options CSV data and correctly parses 
    DD-MM-YYYY date strings into true datetime objects.
    """
    if not os.path.exists(file_path):
        print(f"Error: The file {file_path} does not exist.")
        return None
        
    print(f"Loading and parsing data from {file_path}...")
    
   # 1. Load the CSV file
    df = pd.read_csv(file_path)
    
    # Strip any accidental hidden spaces and rename for strategy script compatibility
    df.columns = df.columns.str.strip()
    df = df.rename(columns={'Option Type': 'OptionType'})
    
    # 2. FIX: Safely parse Date strings (DD-MM-YYYY) into true Datetime objects
    df['Date'] = pd.to_datetime(df['Date'], format='%d-%m-%Y', errors='coerce')
    df['Expiry'] = pd.to_datetime(df['Expiry'], format='%d-%m-%Y', errors='coerce')     # 3. Clean data: Remove rows where dates failed to parse or close price is zero 
    df = df.dropna(subset=['Date', 'Expiry'])
    df = df[df['ClosePrice'] > 0] 
    
    # Sort chronologically so your backtest runs in the correct order
    df = df.sort_values(by='Date').reset_index(drop=True)
    
    return df

def get_atm_strike(current_index_price):
    """
    Dynamically calculates the closest Nifty strike price[cite: 42, 49].
    Nifty strikes move in steps of 50.
    """
    return round(current_index_price / 50) * 50

# Quick test execution block
if __name__ == "__main__":
    # Test this with your generated file or downloaded data
    test_path = "data/nifty_options_mock.csv" 
    
    clean_df = load_options_data(test_path)
    if clean_df is not None:
        print("\n--- Data Sample Successfully Parsed ---")
        print(clean_df[['Date', 'Expiry', 'Strike', 'OptionType', 'ClosePrice']].head(5))
        print("\nData column types after parsing:")
        print(clean_df.dtypes)