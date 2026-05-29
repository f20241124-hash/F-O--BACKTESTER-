from __future__ import annotations

import pandas as pd

from strategies.common import (
    StrategyContext,
    base_trade,
    get_option_close,
    get_underlying_for_date,
    nearest_available_strike,
    weekly_expiries,
)


def _monday_entries(symbol_df: pd.DataFrame) -> pd.Series:
    dates = symbol_df["Date"].drop_duplicates().sort_values()
    return dates[dates.dt.weekday == 0]


def simulate_iron_condor(
    options_df: pd.DataFrame,
    symbol: str = "NIFTY",
    short_offset: int = 100,
    hedge_offset: int = 200,
) -> pd.DataFrame:
    ctx = StrategyContext(options_df=options_df, symbol=symbol)
    symbol_df = ctx.symbol_df
    all_expiries = weekly_expiries(symbol_df)
    trades: list[dict] = []

    for entry_date in _monday_entries(symbol_df):
        expiry_candidates = all_expiries[(all_expiries >= entry_date) & (all_expiries <= entry_date + pd.Timedelta(days=7))]
        if expiry_candidates.empty:
            continue
        expiry = expiry_candidates.min()

        entry_spot = get_underlying_for_date(symbol_df, entry_date)
        exit_spot = get_underlying_for_date(symbol_df, expiry)
        if entry_spot is None or exit_spot is None:
            continue

        short_call = nearest_available_strike(symbol_df, entry_date, expiry, entry_spot + short_offset, "CE")
        long_call = nearest_available_strike(symbol_df, entry_date, expiry, entry_spot + hedge_offset, "CE")
        short_put = nearest_available_strike(symbol_df, entry_date, expiry, entry_spot - short_offset, "PE")
        long_put = nearest_available_strike(symbol_df, entry_date, expiry, entry_spot - hedge_offset, "PE")
        if any(x is None for x in [short_call, long_call, short_put, long_put]):
            continue

        sc = get_option_close(symbol_df, entry_date, expiry, short_call, "CE")
        lc = get_option_close(symbol_df, entry_date, expiry, long_call, "CE")
        sp = get_option_close(symbol_df, entry_date, expiry, short_put, "PE")
        lp = get_option_close(symbol_df, entry_date, expiry, long_put, "PE")
        if any(x is None for x in [sc, lc, sp, lp]):
            continue

        net_credit = sc + sp - lc - lp
        expiry_payoff = (
            -max(exit_spot - short_call, 0.0)
            - max(short_put - exit_spot, 0.0)
            + max(exit_spot - long_call, 0.0)
            + max(long_put - exit_spot, 0.0)
        )
        pnl_points = net_credit + expiry_payoff

        trade = base_trade(symbol, "IronCondor", entry_date, expiry)
        trade["Legs"] = f"-CE@{short_call:.0f},+CE@{long_call:.0f},-PE@{short_put:.0f},+PE@{long_put:.0f}"
        trade["EntryNifty"] = entry_spot
        trade["ExitNifty"] = exit_spot
        trade["NetPremium"] = net_credit
        trade["PnlPoints"] = pnl_points
        trade["PnL"] = pnl_points * trade["LotSize"]
        trades.append(trade)

    return pd.DataFrame(trades)
