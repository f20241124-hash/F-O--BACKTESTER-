import pandas as pd
import glob
import os

def build_regime_map():

    master_file = os.path.join(
        os.path.dirname(__file__),
        "data",
        "banknifty_options_master.csv"
    )

    master = pd.read_csv(master_file)

    master["Date"] = pd.to_datetime(master["Date"])

    # One BankNifty value per day
    daily = (
        master.groupby("Date")["Underlying Value"]
        .first()
        .reset_index()
        .sort_values("Date")
    )

    # Monthly closing values
    monthly = (
        daily.groupby(daily["Date"].dt.to_period("M"))
        .agg({"Underlying Value": "last"})
        .reset_index()
    )
    
    monthly["Underlying Value"] = pd.to_numeric(
        monthly["Underlying Value"],
        errors="coerce"
    )
    
    monthly["Monthly_Return"] = (
        monthly["Underlying Value"].pct_change() * 100
    )

    def classify(ret):
        if pd.isna(ret):
            return "Unknown"
        elif ret > 3:
            return "Trending Up"
        elif ret < -3:
            return "Trending Down"
        else:
            return "Sideways"

    monthly["Regime"] = monthly["Monthly_Return"].apply(classify)

    return dict(
        zip(
            monthly["Date"].astype(str),
            monthly["Regime"]
        )
    )


def add_regimes_to_results():

    regime_map = build_regime_map()

    results_dir = os.path.join(
        os.path.dirname(__file__),
        "results"
    )

    csv_files = glob.glob(
        os.path.join(results_dir, "*_results.csv")
    )

    print(f"Found {len(csv_files)} strategy files")

    for file in csv_files:

        df = pd.read_csv(file)

        df["Date"] = pd.to_datetime(df["Date"])

        df["Regime"] = (
            df["Date"]
            .dt.to_period("M")
            .astype(str)
            .map(regime_map)
        )

        output_file = file.replace(
            "_results.csv",
            "_results_regime.csv"
        )

        df.to_csv(output_file, index=False)

        print(
            f"Created: {os.path.basename(output_file)}"
        )


if __name__ == "__main__":
    add_regimes_to_results()