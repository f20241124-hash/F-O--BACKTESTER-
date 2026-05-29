from __future__ import annotations

import pandas as pd

from strategies.common import (
    StrategyContext,
    base_trade,
    get_option_close,
    get_underlying_for_date,
    monthly_expiries,
    nearest_available_strike,
    previous_trading_date,
)


def simulate_long_straddle(options_df: pd.DataFrame, symbol: str = "NIFTY") -> pd.DataFrame:
    ctx = StrategyContext(options_df=options_df, symbol=symbol)
    symbol_df = ctx.symbol_df
    trades: list[dict] = []

    for expiry in monthly_expiries(symbol_df):
        entry_date = previous_trading_date(symbol_df, expiry)
        if entry_date is None:
            continue
        entry_spot = get_underlying_for_date(symbol_df, entry_date)
        exit_spot = get_underlying_for_date(symbol_df, expiry)
        if entry_spot is None or exit_spot is None:
            continue

        atm = nearest_available_strike(symbol_df, entry_date, expiry, entry_spot, "CE")
        if atm is None:
            continue

        ce_premium = get_option_close(symbol_df, entry_date, expiry, atm, "CE")
        pe_premium = get_option_close(symbol_df, entry_date, expiry, atm, "PE")
        if ce_premium is None or pe_premium is None:
            continue

        entry_cost = ce_premium + pe_premium
        expiry_payoff = abs(exit_spot - atm)
        pnl_points = expiry_payoff - entry_cost

        trade = base_trade(symbol, "LongStraddle", entry_date, expiry)
        trade["Legs"] = f"+CE@{atm:.0f},+PE@{atm:.0f}"
        trade["EntryNifty"] = entry_spot
        trade["ExitNifty"] = exit_spot
        trade["NetPremium"] = -entry_cost
        trade["PnlPoints"] = pnl_points
        trade["PnL"] = pnl_points * trade["LotSize"]
        trades.append(trade)

    return pd.DataFrame(trades)
