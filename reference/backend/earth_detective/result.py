from importlib.metadata import version
import time

from .aggregation import annual_means
from .errors import ScienceError
from .inference import hac_trend
from .schemas import AnalysisRequest, AnalysisResult, MonthlyValue
from .series import read_monthly_records
from .source import LoadedSeries, nearest_cell
from .units import VARIABLES, convert_units


def scientific_result(request: AnalysisRequest, loaded: LoadedSeries) -> AnalysisResult:
    started = time.perf_counter()
    if loaded.cell != nearest_cell(request.latitude, request.longitude):
        raise ScienceError("coordinate_mismatch", "Source returned a different cell than requested", 503)
    monthly = read_monthly_records(loaded.records, request.start_year, request.end_year, loaded.fill_values)
    monthly[:] = convert_units(monthly.to_numpy(), request.variable, loaded.source_unit)
    annual = annual_means(monthly)
    trend = hac_trend([v.year for v in annual], [v.value for v in annual])
    spec = VARIABLES[request.variable]
    notices = [
        "MERRA-2 grid-cell reanalysis; not a city weather station. No independent station validation.",
        "HAC/t inference is approximate; reanalysis structural uncertainty is not quantified.",
    ]
    if loaded.provenance.mode == "local_verified_reference":
        notices.append("Stage 3B: local verified Pavlodar reference only; no dynamic NASA access.")
    if len(annual) < 20:
        notices.append("Fewer than 20 years: small-sample HAC confidence intervals may be unreliable.")
    if trend.status != "estimated":
        notices.append("Degenerate annual series: p-value, confidence interval and significance are undefined, not zero.")
    result = AnalysisResult(
        requested=request, actual_cell=loaded.cell, source_unit=loaded.source_unit,
        unit=spec.unit, trend_unit=spec.trend_unit,
        monthly_series=[MonthlyValue(month=d.strftime("%Y-%m"), value=float(v)) for d, v in monthly.items()],
        annual_series=annual, trend=trend,
        method={"aggregation": "days-in-month weighted annual mean; 12 finite months required",
                "model": "OLS with intercept and centered calendar year", "covariance": "HAC/Newey-West",
                "kernel": "bartlett", "maxlags": 3, "use_correction": True, "use_t": True,
                "missing_policy": "reject; no imputation or dropping", "calendar": "Gregorian",
                **{name + "_version": version(name) for name in ["numpy", "pandas", "scipy", "statsmodels"]}},
        quality={"expected_months": (request.end_year-request.start_year+1)*12,
                 "actual_months": len(monthly), "missing_months": 0, "missing_values": 0,
                 "complete_years": len(annual), "physical_screening_passed": True},
        provenance=loaded.provenance, warnings=notices)
    result.timings_ms = {**loaded.timings_ms, "statistical_calculation": (time.perf_counter()-started)*1000}
    return result
