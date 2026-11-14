import numpy as np
import pandas as pd
import pytest
from scipy.stats import t

from earth_detective.aggregation import annual_means
from earth_detective.errors import ScienceError
from earth_detective.inference import hac_trend
from earth_detective.ols import fit_ols
from earth_detective.series import read_monthly_records
from earth_detective.units import convert_units


def records(year=2000):
    return [{"month": f"{year}-{m:02}", "value": 280.0} for m in range(1, 13)]


@pytest.mark.parametrize("variable,unit,value,expected", [("T2M", "K", 273.15, 0.0), ("T2M", "K", 300.0, 26.85), ("QV2M", "kg kg-1", 0.005, 5.0)])
def test_conversion(variable, unit, value, expected):
    assert convert_units(np.array([value]), variable, unit)[0] == pytest.approx(expected, abs=1e-12)


@pytest.mark.parametrize("variable,unit", [("T2M", "°C"), ("QV2M", "%"), ("QV2M", "g/kg")])
def test_source_unit_mismatch(variable, unit):
    with pytest.raises(ScienceError, match="units"):
        convert_units(np.array([280.0]), variable, unit)


@pytest.mark.parametrize("variable,value", [("T2M", 999.0), ("QV2M", -0.1), ("QV2M", 0.2)])
def test_physical_screening(variable, value):
    unit = "K" if variable == "T2M" else "kg kg-1"
    with pytest.raises(ScienceError) as error:
        convert_units(np.array([value]), variable, unit)
    assert error.value.code == "implausible_values"


@pytest.mark.parametrize("value", [None, np.nan, np.inf, -np.inf])
def test_missing_values_rejected(value):
    rows = records(); rows[5]["value"] = value
    with pytest.raises(ScienceError) as error:
        read_monthly_records(rows, 2000, 2000)
    assert error.value.code == "missing_values"


def test_fill_value_rejected():
    rows = records(); rows[0]["value"] = 1e15
    with pytest.raises(ScienceError) as error:
        read_monthly_records(rows, 2000, 2000, (1e15,))
    assert error.value.code == "fill_values"


@pytest.mark.parametrize("value", ["280", True, {"value": 280}])
def test_non_numeric_observation(value):
    rows = records(); rows[0]["value"] = value
    with pytest.raises(ScienceError):
        read_monthly_records(rows, 2000, 2000)


@pytest.mark.parametrize("case,code", [("missing", "missing_months"), ("duplicate", "duplicate_months"), ("unordered", "unordered_months"), ("format", "invalid_month"), ("extra", "missing_months"), ("empty", "missing_months")])
def test_calendar_validation(case, code):
    rows = records()
    if case == "missing": rows.pop(4)
    if case == "duplicate": rows[1] = rows[0].copy()
    if case == "unordered": rows[0], rows[1] = rows[1], rows[0]
    if case == "format": rows[0]["month"] = "2000-13"
    if case == "extra": rows.append({"month": "2001-01", "value": 280.0})
    if case == "empty": rows = []
    with pytest.raises(ScienceError) as error:
        read_monthly_records(rows, 2000, 2000)
    assert error.value.code == code


def test_leap_year_day_weighting():
    rows = records(2000)
    for row in rows: row["value"] = 0.0
    rows[1]["value"] = 1.0
    result = annual_means(read_monthly_records(rows, 2000, 2000))[0]
    assert result.days == 366
    assert result.value == pytest.approx(29 / 366, abs=1e-15)


@pytest.mark.parametrize("case", ["missing", "duplicate", "nonfinite", "wrong_day"])
def test_annual_aggregation_rejects_incomplete_year(case):
    series = pd.Series(np.ones(12), index=pd.date_range("2001-01-01", periods=12, freq="MS"))
    if case == "missing": series = series.iloc[1:]
    if case == "duplicate": series.index = [series.index[0]] + list(series.index[:-1])
    if case == "nonfinite": series.iloc[0] = np.nan
    if case == "wrong_day": series.index = series.index + pd.Timedelta(days=1)
    with pytest.raises(ScienceError):
        annual_means(series)


def test_constant_series_has_no_fabricated_significance():
    result = hac_trend(np.arange(1991, 2026), np.full(35, 3.0))
    assert result.status == "constant_series"
    assert result.slope_per_decade == 0
    assert result.p_value_two_sided is None and result.ci95_per_decade is None
    assert result.significant is None
    assert "NaN" not in result.model_dump_json()


def test_exact_linear_series_marks_undefined_inference():
    years = np.arange(2000, 2020)
    result = hac_trend(years, 3 + 0.25 * (years-2000))
    assert result.slope_per_decade == pytest.approx(2.5, abs=1e-12)
    assert result.status == "zero_residual_variance"
    assert result.p_value_two_sided is None and result.ci95_per_decade is None


def test_regression_and_hac_against_independent_matrix_calculation():
    years = np.arange(1990, 2010)
    y = 2 + (years - 1990) * 0.2 + np.array([0.2, -0.3, 0.1, 0.4, -0.2] * 4)
    x = np.column_stack([np.ones(20), years-years.mean()])
    bread = np.linalg.inv(x.T@x)
    beta = bread @ x.T @ y
    residuals = y-x@beta
    z = x*residuals[:, None]
    meat = z.T@z
    for lag in range(1, 4):
        cross = z[lag:].T@z[:-lag]
        meat += (1-lag/4)*(cross+cross.T)
    se = np.sqrt(((20/18)*bread@meat@bread)[1, 1])*10
    slope = beta[1]*10
    p = 2*t.sf(abs(slope/se), 18)
    result = hac_trend(years, y)
    assert fit_ols(years, y).params == pytest.approx(beta, abs=1e-12)
    assert result.slope_per_decade == pytest.approx(slope, abs=1e-12)
    assert result.standard_error_per_decade == pytest.approx(se, abs=1e-12)
    assert result.p_value_two_sided == pytest.approx(p, abs=1e-12)
    assert result.ci95_per_decade.lower == pytest.approx(slope-t.ppf(.975, 18)*se, abs=1e-12)
    assert result.ci95_per_decade.upper == pytest.approx(slope+t.ppf(.975, 18)*se, abs=1e-12)


@pytest.mark.parametrize("years,values", [(list(range(4)), [1.0]*4), ([2000, 2001, 2003, 2004, 2005], [1.0]*5), ([2000.5+x for x in range(5)], [1.0]*5), (list(range(5)), [np.inf]*5)])
def test_invalid_regression_input(years, values):
    with pytest.raises(ScienceError):
        hac_trend(years, values)
