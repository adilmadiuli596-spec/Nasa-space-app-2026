import re

import pandas as pd

from .errors import ScienceError
from .missing import reject_missing


def read_monthly_records(records: list[dict], start_year: int, end_year: int, fill_values=()) -> pd.Series:
    """Validate a single variable in raw units; input order is part of validity."""
    if not records:
        raise ScienceError("missing_months", "No monthly observations are available")
    try:
        months = [row["month"] for row in records]
        if not all(isinstance(m, str) and re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", m) for m in months):
            raise ScienceError("invalid_month", "Monthly dates must use YYYY-MM")
        dates = pd.to_datetime(months, format="%Y-%m", errors="raise")
        values = reject_missing([row["value"] for row in records], fill_values)
    except (KeyError, TypeError, ValueError, OverflowError):
        raise ScienceError("invalid_series", "Malformed monthly observations") from None
    if dates.has_duplicates:
        raise ScienceError("duplicate_months", "Duplicate monthly observations are not allowed")
    if not dates.is_monotonic_increasing:
        raise ScienceError("unordered_months", "Monthly observations must be ordered")
    expected = pd.date_range(f"{start_year}-01-01", f"{end_year}-12-01", freq="MS")
    if not dates.equals(expected):
        raise ScienceError("missing_months", "The period requires exactly 12 valid months per calendar year")
    return pd.Series(values, index=dates, name="value")
