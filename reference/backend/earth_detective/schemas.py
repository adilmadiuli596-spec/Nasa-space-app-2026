from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Variable = Literal["T2M", "QV2M"]
MIN_YEARS = 5  # n > maxlags + 1, and positive OLS residual degrees of freedom.
HAC_LAGS = 3


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)


class ErrorDetail(StrictModel):
    location: list[str | int]
    type: str
    message: str


class ErrorBody(StrictModel):
    code: str
    message: str
    details: list[ErrorDetail] | None = None


class ErrorResponse(StrictModel):
    error: ErrorBody


class AnalysisRequest(StrictModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    variable: Variable
    start_year: int = Field(default=1991, ge=1991, le=2025)
    end_year: int = Field(default=2025, ge=1991, le=2025)

    @model_validator(mode="after")
    def check_period(self):
        if self.end_year < self.start_year:
            raise ValueError("end_year must be >= start_year")
        if self.end_year - self.start_year + 1 < MIN_YEARS:
            raise ValueError("At least 5 complete calendar years are required for HAC lag 3")
        return self


class Cell(StrictModel):
    latitude: float
    longitude: float
    latitude_index: int
    longitude_index: int
    latitude_spacing: float = 0.5
    longitude_spacing: float = 0.625


class MonthlyValue(StrictModel):
    month: str
    value: float


class AnnualValue(StrictModel):
    year: int
    value: float
    months: int = 12
    days: int


class ConfidenceInterval(StrictModel):
    lower: float
    upper: float


class Trend(StrictModel):
    fitted_values: list[float]
    status: Literal["estimated", "constant_series", "zero_residual_variance"]
    slope_per_decade: float
    standard_error_per_decade: float | None
    p_value_two_sided: float | None
    ci95_per_decade: ConfidenceInterval | None
    significant: bool | None
    alpha: float = 0.05
    r_squared: float | None
    n_years: int
    residual_degrees_of_freedom: int
    hac_maxlags: int = HAC_LAGS
    multiple_testing_correction: Literal["none"] = "none"


class Granule(StrictModel):
    month: str
    granule_id: str
    filename: str
    retrieval: str
    sha256: str
    url: str | None = None


class Provenance(StrictModel):
    provider: str = "NASA GES DISC"
    dataset: str = "M2TMNXSLV"
    version: str = "5.12.4"
    doi: str = "10.5067/AP1B0BA5PD2K"
    mode: str
    network_used: bool
    source_id: str
    artifact_sha256: dict[str, str]
    granules: list[Granule]
    cache_used: bool = False
    cache_hits: int = 0
    cache_misses: int = 0
    catalog_cache_hit: bool = False


class AnalysisResult(StrictModel):
    requested: AnalysisRequest
    actual_cell: Cell
    source_unit: str
    unit: str
    trend_unit: str
    monthly_series: list[MonthlyValue]
    annual_series: list[AnnualValue]
    trend: Trend
    method: dict[str, str | int | bool]
    quality: dict[str, int | bool | str]
    provenance: Provenance
    warnings: list[str]
    timings_ms: dict[str, float] = Field(default_factory=dict)
