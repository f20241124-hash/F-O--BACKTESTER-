import os
import pandas as pd

from merge_data import merge_raw_nse_files
from add_regime import add_regimes_to_results

from strategies.strategy_covered_call import run_strategy as covered_call
from strategies.strategy_iron_condor import run_strategy as iron_condor
from strategies.strategy_bull_call_spread import run_strategy as bull_call_spread
from strategies.strategy_straddle import run_strategy as straddle

from charts import generate_all_charts

from metrics import (
    total_pnl,
    win_rate,
    max_drawdown,
    sharpe_ratio,
    avg_monthly_return,
    regime_analysis
)


def print_metrics(csv_file, strategy_name):

    print("\n" + "=" * 60)
    print(strategy_name.upper())
    print("=" * 60)

    df = pd.read_csv(csv_file)

    print(f"Total PnL            : {total_pnl(df):,.2f}")
    print(f"Win Rate             : {win_rate(df):.2f}%")
    print(f"Max Drawdown         : {max_drawdown(df):,.2f}")
    print(f"Sharpe Ratio         : {sharpe_ratio(df):.2f}")
    print(f"Average Monthly PnL  : {avg_monthly_return(df):,.2f}")

    if "Regime" in df.columns:
        print("\nRegime Analysis")
        print(regime_analysis(df))


def main():

    print("\nSTEP 1 : Loading / Merging Raw Data")
    merge_raw_nse_files()

    print("\nSTEP 2 : Running Covered Call")
    covered_call()

    print("\nSTEP 3 : Running Iron Condor")
    iron_condor()

    print("\nSTEP 4 : Running Bull Call Spread")
    bull_call_spread()

    print("\nSTEP 5 : Running Long Straddle")
    straddle()

    print("\nSTEP 6 : Adding Market Regimes")
    add_regimes_to_results()

    print("\nSTEP 7 : Generating Charts")
    generate_all_charts()

    print("\nSTEP 8 : Computing Metrics")

    print_metrics(
        "results/covered_call_results_regime.csv",
        "Covered Call"
    )

    print_metrics(
        "results/iron_condor_results_regime.csv",
        "Iron Condor"
    )

    print_metrics(
        "results/bull_call_spread_results_regime.csv",
        "Bull Call Spread"
    )

    print_metrics(
        "results/straddle_results_regime.csv",
        "Long Straddle"
    )

    print("\nPipeline Completed Successfully!")


if __name__ == "__main__":
    main()