import numpy as np
import pandas as pd

from .errors import ScienceError


def reject_missing(values, fill_values=()) -> np.ndarray:
    """Strict completeness: never interpolate, silently drop or replace data."""
    if any(isinstance(v, (str, bool)) for v in values):
        raise ScienceError("invalid_values", "Monthly values must be real numbers")
    try:
        array = np.array([np.nan if pd.isna(v) else v for v in values], dtype=float)
    except (TypeError, ValueError):
        raise ScienceError("invalid_values", "Monthly values must be real numbers") from None
    if array.ndim != 1 or not np.isfinite(array).all():
        raise ScienceError("missing_values", "Missing or non-finite monthly values; no imputation is allowed")
    if any(np.any(array == fill) for fill in fill_values):
        raise ScienceError("fill_values", "NASA fill values are not observations")
    return array
