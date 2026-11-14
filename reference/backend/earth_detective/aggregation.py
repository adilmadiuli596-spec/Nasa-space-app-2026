import numpy as np
import pandas as pd

from .errors import ScienceError
from .schemas import AnnualValue


def annual_means(monthly: pd.Series) -> list[AnnualValue]:
    """Annual means with Gregorian calendar weights, including leap days."""
    if not isinstance(monthly.index, pd.DatetimeIndex) or monthly.empty:
        raise ScienceError("invalid_series", "A nonempty monthly DatetimeIndex is required")
    if not monthly.index.is_unique or not monthly.index.is_monotonic_increasing:
        raise ScienceError("invalid_series", "Monthly timestamps must be unique and ordered")
    result = []
    for year, group in monthly.groupby(monthly.index.year):
        expected = pd.date_range(f"{year}-01-01", periods=12, freq="MS")
        if not group.index.equals(expected) or not np.isfinite(group.to_numpy(dtype=float)).all():
            raise ScienceError("incomplete_year", "Annual aggregation requires all 12 finite calendar months")
        weights = group.index.days_in_month
        result.append(AnnualValue(year=int(year), value=float(np.average(group, weights=weights)), days=int(np.sum(weights.to_numpy()))))
    return result
