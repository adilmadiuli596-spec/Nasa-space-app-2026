"""Opt-in real NASA integration checks. Run only via the local authenticated launcher."""
import json
from pathlib import Path
import socket
import threading
import time
import urllib.error
import urllib.request

from filelock import FileLock
import numpy as np
import requests
import uvicorn

from .errors import ScienceError
from .main import create_app
from .nasa import NasaSource
from .nasa_config import NasaConfig
from .nasa_http import NasaHTTP
from .source import PROJECT_ROOT


def run(status):
    with FileLock(str(PROJECT_ROOT / "backend/.cache/3c-verification.lock"), timeout=1):
        _run(status)


def run_cold_benchmark(status):
    with FileLock(str(PROJECT_ROOT / "backend/.cache/3c-verification.lock"), timeout=1):
        _run_cold_benchmark(status)


def _run_cold_benchmark(status):
    """Measure one genuinely cold, full 420-month API request in an isolated cache."""
    from fastapi.testclient import TestClient

    from .schemas import AnalysisRequest

    root = PROJECT_ROOT / "backend/.cache/cold-benchmark-berlin"
    if any(root.glob("*.json")):
        raise ScienceError("cold_cache_not_empty", "Cold benchmark cache already contains JSON entries; use a new isolated run", 409)
    config = NasaConfig(cache_dir=root)
    def progress(**details):
        if details["completed"] % 10 == 0 or details["completed"] == details["total"]:
            status("cold_benchmark_downloading", check="berlin_T2M_420_months", **details)
    source = NasaSource(config, progress=progress)
    payload = {"latitude": 52.52, "longitude": 13.405, "variable": "T2M", "start_year": 1991, "end_year": 2025}
    request = AnalysisRequest.model_validate(payload)
    report = {"stage": "3C", "cell_name": "Berlin", "initial_month_entries": 0,
              "period": "1991-2025", "expected_months": 420,
              "transport": "FastAPI ASGI endpoint to NASA CMR and authenticated GES DISC OPeNDAP"}
    status("cold_benchmark_started", check="berlin_T2M_420_months")
    try:
        with TestClient(create_app(source)) as client:
            cold_start = time.perf_counter()
            cold_response = client.post("/api/analysis", json=payload)
            cold_ms = (time.perf_counter() - cold_start) * 1000
            if cold_response.status_code != 200:
                error = cold_response.json().get("error", {})
                raise ScienceError(error.get("code", "cold_benchmark_failed"), error.get("message", "Cold NASA request failed"), cold_response.status_code)
            cold = cold_response.json()
            assert len(cold["monthly_series"]) == 420
            assert cold["provenance"]["cache_misses"] == 420 and cold["provenance"]["cache_hits"] == 0
            assert cold["provenance"]["network_used"] is True
            assert cold["actual_cell"]["latitude"] == 52.5 and cold["actual_cell"]["longitude"] == 13.125
            report["cold_request"] = {"http_status": cold_response.status_code, "total_ms": cold_ms,
                "timings_ms": cold["timings_ms"], "cache_hits": 0, "cache_misses": 420,
                "network_used": True, "cell": cold["actual_cell"], "trend": cold["trend"]}
            status("cold_benchmark_fetched", check="berlin_T2M_420_months", milliseconds=round(cold_ms, 2))
            warm_start = time.perf_counter()
            warm_response = client.post("/api/analysis", json=payload)
            warm_ms = (time.perf_counter() - warm_start) * 1000
            if warm_response.status_code != 200:
                raise ScienceError("warm_benchmark_failed", "Cached NASA repeat request failed", warm_response.status_code)
            warm = warm_response.json()
            assert warm["provenance"]["cache_hits"] == 420 and warm["provenance"]["cache_misses"] == 0
            assert warm["provenance"]["network_used"] is False
            assert warm["monthly_series"] == cold["monthly_series"] and warm["trend"] == cold["trend"]
            report["repeat_request"] = {"http_status": warm_response.status_code, "total_ms": warm_ms,
                "timings_ms": warm["timings_ms"], "cache_hits": 420, "cache_misses": 0,
                "network_used": False, "identical_to_cold": True}
        report["all_checks_passed"] = True
        (PROJECT_ROOT / "docs/3C_COLD_BENCHMARK.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
        status("cold_benchmark_complete", check="berlin_T2M_420_months", cold_ms=round(cold_ms, 2), warm_ms=round(warm_ms, 2))
    except AssertionError:
        raise ScienceError("cold_benchmark_assertion_failed", "Cold-cache scientific or cache-reuse check failed", 500) from None


def _run(status):
    documents = PROJECT_ROOT / "docs"
    root = PROJECT_ROOT / "backend/.cache/integration-nasa"
    config = NasaConfig(cache_dir=root)
    initial_entries = len(list(root.glob("*.json"))) if root.exists() else 0
    label = {"current": "setup"}
    def progress(**kw):
        if kw["completed"] % 10 == 0 or kw["completed"] == kw["total"]:
            status("source_progress", check=label["current"], **kw)
    source = NasaSource(config, progress=progress)
    server = uvicorn.Server(uvicorn.Config(create_app(source), host="127.0.0.1", port=0, access_log=False, log_level="warning"))
    sock = socket.socket(); sock.bind(("127.0.0.1", 0)); port = sock.getsockname()[1]
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start(); started = time.monotonic()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    url = f"http://127.0.0.1:{port}"
    while not server.started:
        if time.monotonic()-started > 30: raise ScienceError("verification_startup_timeout", "Local verification server did not start", 503)
        time.sleep(.05)
    def call(payload):
        started = time.perf_counter()
        request = urllib.request.Request(url+"/api/analysis", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
        try:
            with opener.open(request, timeout=config.analysis_timeout+120) as response:
                return response.status, json.load(response), (time.perf_counter()-started)*1000
        except urllib.error.HTTPError as exc:
            return exc.code, json.load(exc), (time.perf_counter()-started)*1000
    report = {"stage": "3C", "initial_cache_entries": initial_entries, "transport": "real HTTP loopback FastAPI -> real CMR/OPeNDAP HTTPS",
              "cold_benchmark_is_fresh": initial_entries == 0, "checks": {}}
    try:
        baseline = json.loads((PROJECT_ROOT/".data-check/analysis_results.json").read_text(encoding="utf-8"))
        reference_rows = json.loads((PROJECT_ROOT/".data-check/monthly_values.json").read_text(encoding="utf-8"))
        for name, latitude, longitude in [("pavlodar", 52.27601, 76.96881), ("berlin", 52.52, 13.405)]:
            responses = {}
            for variable in ["T2M", "QV2M"]:
                label["current"] = name+"_"+variable
                status("starting_analysis", check=label["current"])
                payload = {"latitude": latitude, "longitude": longitude, "variable": variable, "start_year": 1991, "end_year": 2025}
                code, result, elapsed = call(payload)
                if code != 200:
                    error = result.get("error", {})
                    raise ScienceError(error.get("code", "verification_error"), error.get("message", "NASA integration failed"), code)
                assert len(result["monthly_series"]) == 420 and len(result["annual_series"]) == 35
                assert result["provenance"]["mode"] == "nasa_opendap"
                if name == "pavlodar":
                    key = "T2M_C" if variable == "T2M" else "QV2M_g_kg"
                    expected = baseline["statistics"][key]["primary"]
                    for field in ["slope_per_decade", "p_value_two_sided", "standard_error_per_decade"]:
                        assert np.isclose(result["trend"][field], expected[field], rtol=1e-10, atol=1e-12)
                    assert np.allclose(list(result["trend"]["ci95_per_decade"].values()), expected["ci95_per_decade"], rtol=1e-10, atol=1e-12)
                    values = [r["T2M_C"] if variable == "T2M" else r["QV2M"]*1000 for r in reference_rows]
                    assert np.allclose([r["value"] for r in result["monthly_series"]], values, rtol=0, atol=1e-12)
                else:
                    assert result["actual_cell"]["longitude"] != 76.875
                    assert not np.allclose([r["value"] for r in result["monthly_series"]], [r["T2M_C"] if variable == "T2M" else r["QV2M"]*1000 for r in reference_rows])
                if variable == "QV2M":
                    assert result["provenance"]["cache_hits"] == 420 and not result["provenance"]["network_used"]
                (documents/f"3C_API_{name.upper()}_{variable}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
                responses[variable] = result
                report["checks"][name+"_"+variable] = {"http_status": code, "total_ms": elapsed, "cell": result["actual_cell"],
                    "trend": result["trend"], "timings_ms": result["timings_ms"], "cache_hits": result["provenance"]["cache_hits"],
                    "cache_misses": result["provenance"]["cache_misses"], "network_used": result["provenance"]["network_used"],
                    "etalon_matches": True if name == "pavlodar" else None}
                (documents/"3C_INTEGRATION.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
                status("analysis_verified", check=label["current"], milliseconds=round(elapsed, 2))
            label["current"] = name+"_repeat_T2M"
            payload["variable"] = "T2M"
            code, repeated, elapsed = call(payload)
            assert code == 200 and repeated["provenance"]["cache_hits"] == 420 and not repeated["provenance"]["network_used"]
            assert repeated["monthly_series"] == responses["T2M"]["monthly_series"]
            assert repeated["trend"] == responses["T2M"]["trend"]
            report["checks"][name+"_repeat"] = {"http_status": code, "total_ms": elapsed, "cache_hits": 420, "network_used": False, "identical": True}
        bad = dict(payload, latitude=100.0)
        code, result, _ = call(bad)
        assert code == 422 and result["error"]["code"] == "invalid_request"
        report["checks"]["invalid_coordinates"] = {"http_status": code}
        # A real anonymous request, with ambient .netrc/proxy credentials disabled.
        anonymous = requests.Session(); anonymous.trust_env = False
        transport = NasaHTTP(config, session_provider=lambda: anonymous)
        entry = responses["T2M"]["provenance"]["granules"][0]
        try:
            transport.get(entry["url"]+".dap.nc4", {"dap4.ce": "/T2M[0:1:0][285:1:285][309:1:309]"},
                          authenticated=True, deadline=time.monotonic()+60)
            raise AssertionError("Anonymous protected request unexpectedly succeeded")
        except ScienceError as exc:
            report["checks"]["real_anonymous_request"] = {"code": exc.code, "http_status": exc.status}
            assert exc.code in ["nasa_auth_required", "nasa_forbidden"]
        finally:
            anonymous.close()
        report["all_checks_passed"] = True
        (documents/"3C_INTEGRATION.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        status("complete", checks=list(report["checks"]))
    finally:
        server.should_exit = True
        thread.join(timeout=15)
        sock.close()
