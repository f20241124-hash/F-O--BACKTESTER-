from __future__ import annotations

import pandas as pd

from strategies.common import (
    StrategyContext,
    base_trade,
    get_option_close,
    get_underlying_for_date,
    monthly_expiries,
    nearest_available_strike,
    trade_entry_date,
)


def simulate_covered_call(options_df: pd.DataFrame, symbol: str = "NIFTY", call_otm_offset: int = 200) -> pd.DataFrame:
    ctx = StrategyContext(options_df=options_df, symbol=symbol)
    symbol_df = ctx.symbol_df
    trades: list[dict] = []

    for expiry in monthly_expiries(symbol_df):
        entry_date = trade_entry_date(symbol_df, expiry)
        if entry_date is None:
            continue

        entry_spot = get_underlying_for_date(symbol_df, entry_date)
        exit_spot = get_underlying_for_date(symbol_df, expiry)
        if entry_spot is None or exit_spot is None:
            continue

        short_target = entry_spot + call_otm_offset
        short_strike = nearest_available_strike(symbol_df, entry_date, expiry, short_target, "CE")
        if short_strike is None:
            continue

        premium = get_option_close(symbol_df, entry_date, expiry, short_strike, "CE")
        if premium is None:
            continue

        call_payoff = max(exit_spot - short_strike, 0.0)
        pnl_points = (exit_spot - entry_spot) + premium - call_payoff

        trade = base_trade(symbol, "CoveredCall", entry_date, expiry)
        trade["Legs"] = f"+FUT,-CE@{short_strike:.0f}"
        trade["EntryNifty"] = entry_spot
        trade["ExitNifty"] = exit_spot
        trade["NetPremium"] = premium
        trade["PnlPoints"] = pnl_points
        trade["PnL"] = pnl_points * trade["LotSize"]
        trades.append(trade)

    return pd.DataFrame(trades)
