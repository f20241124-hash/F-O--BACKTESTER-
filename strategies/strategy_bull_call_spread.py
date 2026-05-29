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


def simulate_bull_call_spread(options_df: pd.DataFrame, symbol: str = "NIFTY", short_offset: int = 100) -> pd.DataFrame:
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

        long_strike = nearest_available_strike(symbol_df, entry_date, expiry, entry_spot, "CE")
        if long_strike is None:
            continue
        short_strike = nearest_available_strike(symbol_df, entry_date, expiry, long_strike + short_offset, "CE")
        if short_strike is None:
            continue

        long_premium = get_option_close(symbol_df, entry_date, expiry, long_strike, "CE")
        short_premium = get_option_close(symbol_df, entry_date, expiry, short_strike, "CE")
        if long_premium is None or short_premium is None:
            continue

        entry_cost = long_premium - short_premium
        expiry_payoff = max(exit_spot - long_strike, 0.0) - max(exit_spot - short_strike, 0.0)
        pnl_points = expiry_payoff - entry_cost

        trade = base_trade(symbol, "BullCallSpread", entry_date, expiry)
        trade["Legs"] = f"+CE@{long_strike:.0f},-CE@{short_strike:.0f}"
        trade["EntryNifty"] = entry_spot
        trade["ExitNifty"] = exit_spot
        trade["NetPremium"] = -entry_cost
        trade["PnlPoints"] = pnl_points
        trade["PnL"] = pnl_points * trade["LotSize"]
        trades.append(trade)

    return pd.DataFrame(trades)
