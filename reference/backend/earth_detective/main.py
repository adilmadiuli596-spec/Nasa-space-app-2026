import os
import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .errors import ScienceError
from .result import scientific_result
from .schemas import AnalysisRequest, AnalysisResult, ErrorResponse, MIN_YEARS
from .source import DataSource, LocalReferenceSource, PROJECT_ROOT
from .units import VARIABLES


def create_app(source: DataSource | None = None, *, mode="reference") -> FastAPI:
    # Factory retains explicit offline compatibility for the unchanged 3B tests.
    if source is None:
        if mode == "nasa":
            from .nasa import NasaSource
            source = NasaSource()
        elif mode == "reference":
            source = LocalReferenceSource(Path(os.environ.get("EARTH_REFERENCE_DIR", str(PROJECT_ROOT / ".data-check"))))
        else:
            raise ValueError("EARTH_SOURCE must be nasa or reference")
    dynamic = getattr(source, "is_dynamic", False)
    app = FastAPI(title="Earth Detective — NASA backend", version="0.3.1", docs_url=None, redoc_url=None)

    @app.exception_handler(ScienceError)
    async def science_error(_request: Request, exc: ScienceError):
        return JSONResponse(status_code=exc.status, content={"error": {"code": exc.code, "message": exc.message}})

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, exc: RequestValidationError):
        # Never echo raw input, exception context, credentials or the request body.
        errors = [{"location": list(e["loc"]), "type": e["type"], "message": e["msg"]} for e in exc.errors()[:20]]
        return JSONResponse(status_code=422, content={"error": {"code": "invalid_request", "message": "Invalid analysis request", "details": errors}})

    @app.get("/api/health")
    def health():
        try:
            source.check_ready()
        except ScienceError:
            if dynamic:
                return JSONResponse(status_code=503, content={"status": "degraded", "stage": "3C", "local_cache": "unavailable", "nasa_network": "not_checked", "dynamic_nasa_enabled": True})
            return JSONResponse(status_code=503, content={"status": "degraded", "stage": "3B", "local_reference": "unavailable", "nasa_network": "not_checked"})
        if dynamic:
            return {"status": "ok", "stage": "3C", "local_cache": "ready", "nasa_network": "not_checked", "dynamic_nasa_enabled": True}
        return {"status": "ok", "stage": "3B", "local_reference": "verified", "nasa_network": "not_checked", "dynamic_nasa_enabled": False}

    @app.get("/api/variables")
    def variables():
        return {"variables": [{"id": code, "name": spec.name, "source_unit": spec.source_unit, "unit": spec.unit,
                               "trend_unit": spec.trend_unit} for code, spec in VARIABLES.items()],
                "supported_period": {"start_year": 1991, "end_year": 2025, "minimum_complete_years": MIN_YEARS},
                "source_mode": "nasa_opendap" if dynamic else "local_verified_reference", "dynamic_nasa_enabled": dynamic,
                "available_cells": None if dynamic else [{"latitude": 52.5, "longitude": 76.875}],
                "coverage": "MERRA-2 product grid; availability checked per request" if dynamic else "local_reference_cell",
                "coordinate_policy": "Nearest MERRA-2 cell; ties choose smaller array index; longitude wraps at 180 degrees"}

    @app.post("/api/analysis", response_model=AnalysisResult,
              responses={status: {"model": ErrorResponse} for status in [404, 422, 500, 502, 503, 504]})
    def analysis(body: AnalysisRequest):
        try:
            return scientific_result(body, source.load(body))
        except ScienceError:
            raise
        except Exception as exc:
            # Log only a type, never exception text, file contents or input.
            logging.getLogger(__name__).error("Analysis failed (%s)", type(exc).__name__)
            raise ScienceError("internal_error", "Analysis could not be completed", 500) from None

    return app


app = create_app(mode=os.environ.get("EARTH_SOURCE", "nasa"))
