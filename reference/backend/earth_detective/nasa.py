"""CMR discovery and Cloud OPeNDAP single-cell extraction. No global-file fallback."""
import calendar
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import re
import threading
import time
from urllib.parse import urlsplit

import netCDF4
import numpy as np
from pydantic import field_validator, model_validator

from .cache import FileCache, canonical
from .errors import ScienceError
from .nasa_config import NasaConfig
from .nasa_http import NasaHTTP
from .schemas import AnalysisRequest, Granule, Provenance, StrictModel
from .source import LoadedSeries, nearest_cell
from .units import VARIABLES, convert_units

CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"
DATASET, VERSION, DOI = "M2TMNXSLV", "5.12.4", "10.5067/AP1B0BA5PD2K"
_netcdf_lock = threading.Lock()  # libnetcdf/HDF5 reads are not thread-safe.


class CatalogGranule(StrictModel):
    month: str
    granule_id: str
    filename: str
    opendap: str
    updated: str

    @model_validator(mode="after")
    def check(self):
        month = self.month.replace("-", "")
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", self.month): raise ValueError("month")
        if not re.fullmatch(r"G\d+-GES_DISC", self.granule_id): raise ValueError("granule")
        if not re.fullmatch(r"MERRA2_\d{3}\.tavgM_2d_slv_Nx\." + month + r"\.nc4", self.filename): raise ValueError("filename")
        url = urlsplit(self.opendap)
        if (url.scheme != "https" or url.hostname != "opendap.earthdata.nasa.gov" or url.port is not None
                or url.username or url.password or url.query or url.fragment or not url.path.startswith("/collections/")):
            raise ValueError("opendap endpoint")
        if not re.fullmatch(r"[0-9T:.Z+\-]+", self.updated): raise ValueError("updated")
        return self


class SubsetRecord(StrictModel):
    month: str
    latitude: float
    longitude: float
    latitude_index: int
    longitude_index: int
    values: dict[str, float]
    units: dict[str, str]
    time_label: str
    response_sha256: str
    granule_id: str
    filename: str
    updated: str
    dataset: str = DATASET
    version: str = VERSION
    doi: str = DOI

    @model_validator(mode="after")
    def check(self):
        if self.dataset != DATASET or self.version != VERSION or self.doi != DOI: raise ValueError("product")
        if set(self.values) != set(VARIABLES) or set(self.units) != set(VARIABLES): raise ValueError("variables")
        if self.time_label[:7] != self.month: raise ValueError("date")
        if not re.fullmatch(r"[0-9a-f]{64}", self.response_sha256): raise ValueError("response hash")
        for name in VARIABLES:
            convert_units(np.array([self.values[name]]), name, self.units[name])
        return self


def decode_subset(content: bytes, entry: CatalogGranule, cell) -> dict:
    if not content.startswith((b"\x89HDF", b"CDF")):
        raise ScienceError("nasa_invalid_format", "NASA subset is not a NetCDF response", 502)
    try:
        with _netcdf_lock, netCDF4.Dataset("subset", memory=content) as ds:
            if (ds.ShortName != DATASET or ds.VersionID != VERSION or ds.identifier_product_doi != DOI):
                raise ValueError("product metadata")
            year, month = map(int, entry.month.split("-"))
            if ds.RangeBeginningDate != entry.month + "-01" or ds.RangeEndingDate != f"{entry.month}-{calendar.monthrange(year, month)[1]:02}":
                raise ValueError("monthly range")
            for name, expected in [("lat", cell.latitude), ("lon", cell.longitude)]:
                coordinate = ds[name]
                coordinate.set_auto_maskandscale(False)
                if coordinate.size != 1 or float(coordinate[:].reshape(-1)[0]) != expected:
                    raise ValueError("single-cell coordinates")
            t = ds["time"]; t.set_auto_maskandscale(False)
            if t.size != 1: raise ValueError("time size")
            date = netCDF4.num2date(t[:], t.units, calendar=getattr(t, "calendar", "standard"))[0]
            if (date.year, date.month, date.day) != (year, month, 1): raise ValueError("time date")
            values, units = {}, {}
            for name, spec in VARIABLES.items():
                v = ds[name]; v.set_auto_maskandscale(False)
                if v.shape != (1, 1, 1) or v.dimensions != ("time", "lat", "lon") or v.units != spec.source_unit:
                    raise ValueError("shape or units")
                raw = float(v[0, 0, 0])
                if not np.isfinite(raw) or any(raw == float(v.getncattr(a)) for a in ["_FillValue", "missing_value"] if a in v.ncattrs()):
                    raise ScienceError("nasa_missing_data", "NASA cell contains missing/fill observations; no imputation is performed", 502)
                if "valid_range" in v.ncattrs():
                    lo, hi = v.valid_range
                    if not lo <= raw <= hi: raise ValueError("valid range")
                values[name] = raw * float(getattr(v, "scale_factor", 1)) + float(getattr(v, "add_offset", 0))
                units[name] = v.units
                convert_units(np.array([values[name]]), name, units[name])
            return SubsetRecord(month=entry.month, latitude=cell.latitude, longitude=cell.longitude,
                                latitude_index=cell.latitude_index, longitude_index=cell.longitude_index,
                                values=values, units=units, time_label=str(date), response_sha256=hashlib.sha256(content).hexdigest(),
                                granule_id=entry.granule_id, filename=entry.filename, updated=entry.updated).model_dump()
    except ScienceError as exc:
        if exc.code == "nasa_missing_data": raise
        raise ScienceError("nasa_invalid_data", "NASA subset failed scientific validation", 502) from None
    except (OSError, ValueError, KeyError, AttributeError, IndexError, RuntimeError):
        raise ScienceError("nasa_invalid_format", "NASA subset metadata, calendar, units or coordinates are invalid", 502) from None


class NasaSource:
    is_dynamic = True

    def __init__(self, config=None, http=None, progress=None):
        self.config = config or NasaConfig.from_env()
        self.cache = FileCache(self.config.cache_dir, self.config.cache_max_bytes, self.config.lock_timeout)
        self.http = http or NasaHTTP(self.config)
        self.progress = progress

    def check_ready(self):
        self.cache.prepare()  # Does not claim NASA or authentication is healthy.

    def _catalog(self, request, deadline):
        months = [f"{y}-{m:02}" for y in range(request.start_year, request.end_year+1) for m in range(1, 13)]
        identity = {"kind": "cmr", "dataset": DATASET, "version": VERSION, "start_year": request.start_year, "end_year": request.end_year}
        def validate(payload):
            if not isinstance(payload, list): raise ValueError("catalog")
            entries = [CatalogGranule.model_validate(e) for e in payload]
            if [e.month for e in entries] != months:
                raise ScienceError("nasa_incomplete_series", "NASA CMR does not contain exactly one granule for every requested month", 502)
            return [e.model_dump() for e in entries]
        def produce():
            content = self.http.get(CMR, {"short_name": DATASET, "version": VERSION,
                         "temporal": f"{request.start_year}-01-01T00:00:00Z,{request.end_year}-12-31T23:59:59Z",
                         "page_size": 500, "sort_key": "start_date"}, authenticated=False, deadline=deadline)
            try:
                raw = json.loads(content)["feed"]["entry"]
                out = []
                for e in raw:
                    if e["data_center"] != "GES_DISC" or not e["title"].startswith(DATASET+"."+VERSION+":"):
                        raise ValueError("collection")
                    link = next(l["href"] for l in e["links"] if not l.get("inherited") and l.get("title", "").startswith("OPeNDAP"))
                    out.append(CatalogGranule(month=e["time_start"][:7], granule_id=e["id"], filename=e["producer_granule_id"],
                                              opendap=link, updated=e["updated"]).model_dump())
                return validate(out)
            except ScienceError: raise
            except (ValueError, KeyError, TypeError, StopIteration):
                raise ScienceError("nasa_invalid_catalog", "NASA CMR returned an invalid catalog response", 502) from None
        entries, hit = self.cache.get_or_create(identity, produce, validate, ttl=self.config.catalog_ttl)
        return [CatalogGranule.model_validate(e) for e in entries], hit

    def _month(self, entry, cell, deadline):
        identity = {"kind": "cell_month", "source": "NASA_GES_DISC_OPENDAP", "dataset": DATASET, "version": VERSION,
                    "variables": sorted(VARIABLES), "latitude_index": cell.latitude_index, "longitude_index": cell.longitude_index,
                    "month": entry.month, "granule_id": entry.granule_id, "updated": entry.updated}
        def validate(payload):
            row = SubsetRecord.model_validate(payload)
            if (row.month != entry.month or row.granule_id != entry.granule_id or row.filename != entry.filename
                    or row.updated != entry.updated or row.latitude != cell.latitude or row.longitude != cell.longitude
                    or row.latitude_index != cell.latitude_index or row.longitude_index != cell.longitude_index):
                raise ValueError("cached cell/granule mismatch")
            return row.model_dump()
        def produce():
            ce = ";".join(f"/{v}[0:1:0][{cell.latitude_index}:1:{cell.latitude_index}][{cell.longitude_index}:1:{cell.longitude_index}]" for v in VARIABLES)
            ce += f";/lat[{cell.latitude_index}:1:{cell.latitude_index}];/lon[{cell.longitude_index}:1:{cell.longitude_index}];/time[0:1:0]"
            content = self.http.get(entry.opendap + ".dap.nc4", {"dap4.ce": ce}, authenticated=True, deadline=deadline)
            return decode_subset(content, entry, cell)
        payload, hit = self.cache.get_or_create(identity, produce, validate)
        return payload, hit, entry

    def load(self, request: AnalysisRequest) -> LoadedSeries:
        started = time.monotonic(); deadline = started + self.config.analysis_timeout
        cell = nearest_cell(request.latitude, request.longitude)
        entries, catalog_hit = self._catalog(request, deadline)
        catalog_ms = (time.monotonic()-started)*1000
        with ThreadPoolExecutor(max_workers=self.config.workers, thread_name_prefix="nasa") as pool:
            futures = [pool.submit(self._month, e, cell, deadline) for e in entries]
            rows = []
            try:
                for future in futures:
                    if time.monotonic() > deadline:
                        raise ScienceError("nasa_timeout", "NASA analysis deadline exceeded; validated months are cached", 504)
                    rows.append(future.result())
                    if self.progress: self.progress(completed=len(rows), total=len(entries), last_month=rows[-1][0]["month"],
                                                    cache_hits=sum(hit for _, hit, _ in rows),
                                                    cache_misses=sum(not hit for _, hit, _ in rows))
            except BaseException:
                for future in futures: future.cancel()
                raise
        hits = sum(hit for _, hit, _ in rows)
        records = [{"month": row["month"], "value": row["values"][request.variable]} for row, _, _ in rows]
        granules = [Granule(month=row["month"], granule_id=row["granule_id"], filename=row["filename"], sha256=row["response_sha256"],
                           retrieval="file_cache" if hit else "opendap_subset", url=entry.opendap) for row, hit, entry in rows]
        provenance = Provenance(mode="nasa_opendap", network_used=not catalog_hit or hits != len(rows), source_id=DATASET+"."+VERSION,
                                artifact_sha256={"cmr_manifest": hashlib.sha256(canonical([e.model_dump() for e in entries])).hexdigest(),
                                                 "normalized_series": hashlib.sha256(canonical(records)).hexdigest()},
                                granules=granules, cache_used=catalog_hit or hits > 0, cache_hits=hits, cache_misses=len(rows)-hits,
                                catalog_cache_hit=catalog_hit)
        return LoadedSeries(records, cell, VARIABLES[request.variable].source_unit, (), provenance,
                            timings_ms={"catalog": catalog_ms, "source_total": (time.monotonic()-started)*1000})
