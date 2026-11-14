"""Source protocol and pinned local reference; dynamic NASA lives in nasa.py."""
from dataclasses import dataclass, field
import hashlib
import json
import math
from pathlib import Path
from typing import Protocol

import numpy as np

from .errors import ScienceError
from .schemas import AnalysisRequest, Cell, Granule, Provenance
from .units import VARIABLES

PROJECT_ROOT = Path(__file__).resolve().parents[2]
REFERENCE_HASHES = {
    "monthly_values.json": "df88b6f8cdffe9794568ddab1bce4e680af41cfd1cf4bff846b4808be0b495ea",
    "monthly_quality.json": "79df3672023cd119b6a2eaaf47d6be8f2cb3e15737e4ee154ced58b9f4f36dfb",
    "manifest.json": "ccd3c432882198d3a275a55355652dea0ef11b3ec9e8843a690e3a9807965b64",
}


def nearest_cell(latitude: float, longitude: float) -> Cell:
    """MERRA-2 regular grid. Ties select the smaller array index; longitude wraps."""
    if (not math.isfinite(latitude) or not math.isfinite(longitude)
            or not -90 <= latitude <= 90 or not -180 <= longitude <= 180):
        raise ScienceError("invalid_coordinates", "Latitude/longitude are outside geographic bounds")
    latitudes = -90 + np.arange(361) * 0.5
    longitudes = -180 + np.arange(576) * 0.625
    i = int(np.argmin(np.abs(latitudes - latitude)))
    distance = np.abs((longitudes - longitude + 180) % 360 - 180)
    j = int(np.argmin(distance))
    return Cell(latitude=float(latitudes[i]), longitude=float(longitudes[j]), latitude_index=i, longitude_index=j)


@dataclass
class LoadedSeries:
    records: list[dict]
    cell: Cell
    source_unit: str
    fill_values: tuple[float, ...]
    provenance: Provenance
    timings_ms: dict[str, float] = field(default_factory=dict)


class DataSource(Protocol):
    def load(self, request: AnalysisRequest) -> LoadedSeries: ...
    def check_ready(self) -> None: ...


class LocalReferenceSource:
    """Pinned, read-only Pavlodar artifact. Other cells are explicitly unavailable."""

    def __init__(self, directory: Path = PROJECT_ROOT / ".data-check"):
        self.directory = directory

    def _read(self) -> dict:
        data = {}
        try:
            for name, digest in REFERENCE_HASHES.items():
                content = (self.directory / name).read_bytes()
                if hashlib.sha256(content).hexdigest() != digest:
                    raise ScienceError("reference_integrity_error", "Verified local reference checksum mismatch", 503)
                data[name] = json.loads(content)
        except (OSError, ValueError):
            raise ScienceError("reference_unavailable", "Verified local reference files are unavailable", 503) from None
        return data

    def check_ready(self) -> None:
        self._read()

    def load(self, request: AnalysisRequest) -> LoadedSeries:
        cell = nearest_cell(request.latitude, request.longitude)
        if (cell.latitude, cell.longitude) != (52.5, 76.875):
            raise ScienceError("data_not_available", "Stage 3B only has verified data for cell 52.5 N, 76.875 E; dynamic NASA access is not enabled", 404)
        data = self._read()
        values, quality, manifest = (data[n] for n in REFERENCE_HASHES)
        start, end = f"{request.start_year}-01", f"{request.end_year}-12"
        selected = [(row, q, m) for row, q, m in zip(values, quality, manifest, strict=True) if start <= row["month"] <= end]
        records, granules, fills = [], [], set()
        spec = VARIABLES[request.variable]
        for row, q, m in selected:
            attrs = q["metadata"][request.variable]["attributes"]
            global_attrs = q["global_attributes"]
            if (row["month"] != q["month"] or row["month"] != m["month"]
                    or row["lat"] != cell.latitude or row["lon"] != cell.longitude
                    or attrs["units"] != spec.source_unit
                    or global_attrs["ShortName"] != "M2TMNXSLV" or global_attrs["VersionID"] != "5.12.4"
                    or global_attrs["identifier_product_doi"] != "10.5067/AP1B0BA5PD2K"):
                raise ScienceError("invalid_reference_metadata", "Reference metadata do not match the selected series", 503)
            for attribute in ["_FillValue", "missing_value"]:
                if attribute in attrs:
                    fills.add(float(attrs[attribute]))
            records.append({"month": row["month"], "value": row[request.variable]})
            granules.append(Granule(month=row["month"], granule_id=m["granule_id"], filename=m["filename"],
                                   retrieval=q["retrieval"], sha256=q["sha256"]))
        return LoadedSeries(records, cell, spec.source_unit, tuple(fills), Provenance(
            mode="local_verified_reference", network_used=False, source_id="pavlodar_1991_2025_v1",
            artifact_sha256=REFERENCE_HASHES.copy(), granules=granules))
