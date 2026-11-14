import numpy as np
import statsmodels.api as sm

from .errors import ScienceError
from .schemas import MIN_YEARS


def fit_ols(years, values):
    years, values = np.asarray(years, dtype=float), np.asarray(values, dtype=float)
    if (years.ndim != 1 or values.ndim != 1 or len(years) != len(values)
            or len(years) < MIN_YEARS or not np.isfinite(years).all() or not np.isfinite(values).all()):
        raise ScienceError("insufficient_years", "At least 5 finite consecutive annual observations are required")
    if not np.all(years == np.floor(years)) or not np.all(np.diff(years) == 1):
        raise ScienceError("nonconsecutive_years", "HAC lags require consecutive integer calendar years")
    design = sm.add_constant(years - years.mean())
    return sm.OLS(values, design, missing="raise").fit()
