from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from data_loader import get_atm_strike, get_lot_size


@dataclass
class StrategyContext:
    options_df: pd.DataFrame
    symbol: str

    @property
    def symbol_df(self) -> pd.DataFrame:
        return self.options_df[self.options_df["Symbol"].str.upper() == self.symbol.upper()].copy()


def monthly_expiries(symbol_df: pd.DataFrame) -> pd.Series:
    temp = symbol_df.copy()
    temp["YearMonth"] = temp["Expiry"].dt.to_period("M")
    return temp.groupby("YearMonth")["Expiry"].max().sort_values()


def weekly_expiries(symbol_df: pd.DataFrame) -> pd.Series:
    return symbol_df["Expiry"].drop_duplicates().sort_values()


def trade_entry_date(symbol_df: pd.DataFrame, expiry: pd.Timestamp) -> pd.Timestamp | None:
    month_rows = symbol_df[(symbol_df["Date"].dt.month == expiry.month) & (symbol_df["Date"].dt.year == expiry.year)]
    if month_rows.empty:
        return None
    return month_rows["Date"].min()


def previous_trading_date(symbol_df: pd.DataFrame, date_value: pd.Timestamp) -> pd.Timestamp | None:
    candidates = symbol_df[symbol_df["Date"] < date_value]["Date"].drop_duplicates().sort_values()
    return candidates.max() if not candidates.empty else None


def get_underlying_for_date(symbol_df: pd.DataFrame, date_value: pd.Timestamp) -> float | None:
    row = symbol_df[symbol_df["Date"] == date_value]
    if row.empty:
        return None
    return float(row["Underlying"].median())


def get_option_close(symbol_df: pd.DataFrame, date_value: pd.Timestamp, expiry: pd.Timestamp, strike: float, option_type: str) -> float | None:
    rows = symbol_df[
        (symbol_df["Date"] == date_value)
        & (symbol_df["Expiry"] == expiry)
        & (symbol_df["OptionType"] == option_type)
        & (symbol_df["Strike"] == strike)
    ]
    if rows.empty:
        return None
    return float(rows["ClosePrice"].iloc[0])


def nearest_available_strike(symbol_df: pd.DataFrame, date_value: pd.Timestamp, expiry: pd.Timestamp, target: float, option_type: str) -> float | None:
    strikes = symbol_df[
        (symbol_df["Date"] == date_value) & (symbol_df["Expiry"] == expiry) & (symbol_df["OptionType"] == option_type)
    ]["Strike"]
    if strikes.empty:
        return None
    return get_atm_strike(target, strikes)


def base_trade(symbol: str, strategy_name: str, entry_date: pd.Timestamp, expiry_date: pd.Timestamp) -> dict:
    return {
        "EntryDate": entry_date,
        "ExpiryDate": expiry_date,
        "Underlying": symbol,
        "Strategy": strategy_name,
        "Legs": "",
        "EntryNifty": 0.0,
        "ExitNifty": 0.0,
        "NetPremium": 0.0,
        "PnlPoints": 0.0,
        "LotSize": get_lot_size(symbol, entry_date),
        "PnL": 0.0,
    }
