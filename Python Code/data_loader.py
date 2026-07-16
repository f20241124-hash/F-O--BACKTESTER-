import pandas as pd
import numpy as np
import os

def load_options_data(file_path):
    if not os.path.exists(file_path):
        print(f"Error: The file {file_path} does not exist.")
        return None
        
    print(f"Loading and parsing data from {file_path}...")
    
    # 1. Load the CSV file
    df = pd.read_csv(file_path)
    
    # Strip any accidental hidden spaces from column headers
    df.columns = df.columns.str.strip()
    
    # 2. TRANSLATION MATRIX: Map raw NSE headers to the backtester standardized keys
    rename_dict = {}
    
    if 'Strike Price' in df.columns:
        rename_dict['Strike Price'] = 'Strike'
    elif 'Strike' in df.columns:
        rename_dict['Strike'] = 'Strike'
        
    if 'Option type' in df.columns:
        rename_dict['Option type'] = 'OptionType'
    elif 'Option Type' in df.columns:
        rename_dict['Option Type'] = 'OptionType'
        
    if 'Close' in df.columns:
        rename_dict['Close'] = 'ClosePrice'
    elif 'Close Price' in df.columns:
        rename_dict['Close Price'] = 'ClosePrice'
        
    df = df.rename(columns=rename_dict)
    
    # NEW LINE: Destroy invisible trailing spaces and force uppercase!
    df['OptionType'] = df['OptionType'].astype(str).str.strip().str.upper()
    
    # 3. Clean and convert numeric columns safely
    
    # 3. Clean and convert numeric columns safely
    df['ClosePrice'] = pd.to_numeric(df['ClosePrice'], errors='coerce')
    df['Strike'] = pd.to_numeric(df['Strike'], errors='coerce')
    
    df = df.dropna(subset=['ClosePrice', 'Strike'])
    df = df[df['ClosePrice'] > 0]
    
    # 4. Parse dates accurately
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
    df['Expiry'] = pd.to_datetime(df['Expiry'], errors='coerce')
    
    df = df.dropna(subset=['Date', 'Expiry'])
    
    # Sort chronologically
    df = df.sort_values(by='Date').reset_index(drop=True)
    
    return df

def get_atm_strike(current_index_price, step=100):
    """
    Finds the nearest strike price. 
    BankNifty uses increments of 100 points.
    """
    return int(round(current_index_price / step) * step)