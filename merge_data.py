import pandas as pd
import glob
import os

def merge_raw_nse_files():
    """
    Finds all 50 individual BankNifty CSV files, standardizes column names, 
    merges them chronologically, and exports a single master dataset.
    """
    print("Initializing Master Data Merger...")
    
    # Locate our data folder
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    
    # Grab all CSV files starting with 'OPTIDX' that Krishna uploaded
    file_pattern = os.path.join(data_dir, "OPTIDX_BANKNIFTY_*.csv")
    all_files = glob.glob(file_pattern)
    
    if not all_files:
        print("Error: No raw BankNifty CSV files found in the /data directory!")
        print("Make sure files are in the right folder and start with 'OPTIDX_BANKNIFTY_'")
        return

    print(f"Found {len(all_files)} raw data files. Beginning merge...")
    
    combined_list = []
    
    for file in all_files:
        try:
            df = pd.read_csv(file)
            
            # 1. Clean up column whitespace typos immediately
            df.columns = df.columns.str.strip()
            
            # 2. Standardize column names from raw NSE format to match your loader
            # This ensures your old strategy files won't break when looking for columns!
            rename_mappings = {
                'Expiry Date': 'Expiry',
                'Option Type': 'OptionType',
                'Close Price': 'ClosePrice',
                'Open Interest': 'OpenInterest'
            }
            
            # Check which columns exist in the raw file and rename them safely
            existing_renames = {k: v for k, v in rename_mappings.items() if k in df.columns}
            df = df.rename(columns=existing_renames)
            
            combined_list.append(df)
            
        except Exception as e:
            print(f"Skipping file {os.path.basename(file)} due to an error: {e}")

    if not combined_list:
        print("No valid data frames could be loaded. Merging halted.")
        return

    # 3. Combine all files into a single master dataset
    master_df = pd.concat(combined_list, ignore_index=True)
    
    # Save it cleanly back into your data folder
    output_path = os.path.join(data_dir, "banknifty_options_master.csv")
    master_df.to_csv(output_path, index=False)
    
    print("\n--- Merger Complete ---")
    print(f"Successfully compiled {len(all_files)} files!")
    print(f"Master file saved at: {output_path}")
    print(f"Total Rows Processed: {len(master_df)}")

if __name__ == "__main__":
    merge_raw_nse_files()