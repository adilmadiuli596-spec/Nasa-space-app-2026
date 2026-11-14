from dataclasses import dataclass

import numpy as np

from .errors import ScienceError
from .schemas import Variable


@dataclass(frozen=True)
class VariableSpec:
    name: str
    source_unit: str
    unit: str
    trend_unit: str
    lower: float
    upper: float


VARIABLES = {
    "T2M": VariableSpec("2-meter air temperature", "K", "°C", "°C/decade", 180, 330),
    "QV2M": VariableSpec("2-meter specific humidity", "kg kg-1", "g/kg", "(g/kg)/decade", 0, 0.1),
}


def convert_units(values: np.ndarray, variable: Variable, source_unit: str) -> np.ndarray:
    spec = VARIABLES[variable]
    if source_unit != spec.source_unit:
        raise ScienceError("invalid_units", "Source units do not match the NASA variable")
    raw = np.asarray(values, dtype=float)
    if not np.isfinite(raw).all():
        raise ScienceError("missing_values", "Non-finite or missing monthly values; no imputation is allowed")
    if ((raw < spec.lower) | (raw > spec.upper)).any():
        raise ScienceError("implausible_values", "Monthly values exceed broad physical screening bounds")
    return raw - 273.15 if variable == "T2M" else raw * 1000
