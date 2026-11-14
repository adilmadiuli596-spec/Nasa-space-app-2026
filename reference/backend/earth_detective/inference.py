import numpy as np

from .errors import ScienceError
from .ols import fit_ols
from .schemas import ConfidenceInterval, HAC_LAGS, Trend


def hac_trend(years, values) -> Trend:
    ols = fit_ols(years, values)
    y = np.asarray(values, dtype=float)
    # Treat numerical roundoff in an otherwise exact fit as a degenerate case.
    tolerance = 64 * np.finfo(float).eps * max(1.0, float(np.max(np.abs(y))))
    common = {"n_years": len(y), "residual_degrees_of_freedom": len(y) - 2,
              "fitted_values": ols.fittedvalues.tolist()}
    if np.ptp(y) <= tolerance:
        return Trend(status="constant_series", slope_per_decade=0.0, standard_error_per_decade=None,
                     p_value_two_sided=None, ci95_per_decade=None, significant=None, r_squared=None, **common)
    if np.max(np.abs(ols.resid)) <= tolerance:
        return Trend(status="zero_residual_variance", slope_per_decade=float(ols.params[1] * 10),
                     standard_error_per_decade=None, p_value_two_sided=None, ci95_per_decade=None,
                     significant=None, r_squared=1.0, **common)
    robust = ols.get_robustcov_results(cov_type="HAC", maxlags=HAC_LAGS,
                                     kernel="bartlett", use_correction=True, use_t=True)
    slope = float(robust.params[1] * 10)
    se = float(robust.bse[1] * 10)
    p = float(robust.pvalues[1])
    lower, upper = map(float, robust.conf_int(alpha=0.05)[1] * 10)
    if not np.isfinite([slope, se, p, lower, upper, robust.rsquared]).all() or se <= 0 or not 0 <= p <= 1:
        raise ScienceError("inference_failed", "HAC inference produced invalid numerical results", 500)
    return Trend(status="estimated", slope_per_decade=slope, standard_error_per_decade=se,
                 p_value_two_sided=p, ci95_per_decade=ConfidenceInterval(lower=lower, upper=upper),
                 significant=p < 0.05, r_squared=float(robust.rsquared), **common)
