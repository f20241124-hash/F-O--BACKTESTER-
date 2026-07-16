import pandas as pd
import matplotlib.pyplot as plt
import os


def create_charts(results_file):

    if not os.path.exists(results_file):
        print(f"File not found: {results_file}")
        return

    df = pd.read_csv(results_file)

    if df.empty:
        print("Results file is empty.")
        return

    os.makedirs("charts", exist_ok=True)

    strategy_name = os.path.basename(
        results_file
    ).replace("_results.csv", "")

    df['Date'] = pd.to_datetime(df['Date'])

    df = df.sort_values('Date')

    # ==================================================
    # CUMULATIVE P&L CHART
    # ==================================================

    df['Cumulative_PnL'] = (
        df['Expiry_PnL']
        .cumsum()
    )

    plt.figure(figsize=(12, 6))

    plt.plot(
        df['Date'],
        df['Cumulative_PnL'],
        linewidth=2
    )

    plt.title(
        f"{strategy_name} - Cumulative P&L"
    )

    plt.xlabel("Date")
    plt.ylabel("Running P&L")

    plt.grid(True)

    plt.tight_layout()

    plt.savefig(
        os.path.join(
            "charts",
            f"{strategy_name}_cumulative_pnl.png"
        )
    )

    plt.close()

    # ==================================================
    # MONTHLY P&L BAR CHART
    # ==================================================

    df['Month'] = (
        df['Date']
        .dt.to_period('M')
    )

    monthly_pnl = (
        df.groupby('Month')['Expiry_PnL']
        .sum()
    )

    colors = [
        'green' if pnl >= 0 else 'red'
        for pnl in monthly_pnl
    ]

    plt.figure(figsize=(12, 6))

    plt.bar(
        monthly_pnl.index.astype(str),
        monthly_pnl.values,
        color=colors
    )

    plt.title(
        f"{strategy_name} - Monthly P&L"
    )

    plt.xlabel("Month")
    plt.ylabel("Profit / Loss")

    plt.xticks(rotation=45)

    plt.tight_layout()

    plt.savefig(
        os.path.join(
            "charts",
            f"{strategy_name}_monthly_pnl.png"
        )
    )

    plt.close()

    # ==================================================
    # DRAWDOWN CHART
    # ==================================================

    cumulative_pnl = (
        df['Expiry_PnL']
        .cumsum()
    )

    running_peak = (
        cumulative_pnl
        .cummax()
    )

    drawdown = (
        cumulative_pnl -
        running_peak
    )

    plt.figure(figsize=(12, 6))

    plt.plot(
        df['Date'],
        drawdown,
        linewidth=2
    )

    plt.title(
        f"{strategy_name} - Drawdown"
    )

    plt.xlabel("Date")
    plt.ylabel("Drawdown")

    plt.grid(True)

    plt.tight_layout()

    plt.savefig(
        os.path.join(
            "charts",
            f"{strategy_name}_drawdown.png"
        )
    )

    plt.close()

    print(
        f"Charts generated successfully for {strategy_name}"
    )


if __name__ == "__main__":

    create_charts(
        "results/bull_call_spread_results.csv"
    )
    
    create_charts(
        "results/covered_call_results.csv"
    )    

    create_charts(
        "results/iron_condor_results.csv"
    )

    create_charts(
        "results/straddle_results.csv"
    )