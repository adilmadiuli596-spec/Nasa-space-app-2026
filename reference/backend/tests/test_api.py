import json

import pytest
from fastapi.testclient import TestClient

from earth_detective.main import create_app
from earth_detective.source import LocalReferenceSource, nearest_cell


def test_health_is_explicitly_offline(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["nasa_network"] == "not_checked"
    assert response.json()["dynamic_nasa_enabled"] is False


def test_variables(client):
    result = client.get("/api/variables").json()
    assert {r["id"] for r in result["variables"]} == {"T2M", "QV2M"}
    assert result["supported_period"]["minimum_complete_years"] == 5
    assert result["available_cells"] == [{"latitude": 52.5, "longitude": 76.875}]


@pytest.mark.parametrize("variable,key", [("T2M", "T2M_C"), ("QV2M", "QV2M_g_kg")])
def test_pavlodar_reference(client, payload, baseline, variable, key):
    payload["variable"] = variable
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 200, response.text
    result = response.json(); expected = baseline["statistics"][key]["primary"]
    # Much tighter than rounded user values: floating-point arithmetic only.
    for field in ["slope_per_decade", "standard_error_per_decade", "p_value_two_sided", "r_squared"]:
        assert result["trend"][field] == pytest.approx(expected[field], rel=1e-10, abs=1e-12)
    assert list(result["trend"]["ci95_per_decade"].values()) == pytest.approx(expected["ci95_per_decade"], rel=1e-10, abs=1e-12)
    assert [r["value"] for r in result["annual_series"]] == pytest.approx([r["value"] for r in baseline["annual"][key]], rel=1e-12, abs=1e-12)
    assert len(result["monthly_series"]) == 420 and len(result["annual_series"]) == 35
    assert result["actual_cell"]["latitude_index"] == 285
    assert result["actual_cell"]["longitude_index"] == 411
    assert result["provenance"]["network_used"] is False
    assert len(result["provenance"]["granules"]) == 420
    assert result["trend"]["significant"] is (variable == "QV2M")
    assert result["trend"]["multiple_testing_correction"] == "none"


def test_subperiod_is_computed_not_full_period_returned(client, payload):
    payload.update(start_year=2000, end_year=2010)
    result = client.post("/api/analysis", json=payload).json()
    assert len(result["monthly_series"]) == 132
    assert len(result["annual_series"]) == 11
    assert result["monthly_series"][0]["month"] == "2000-01"
    assert result["monthly_series"][-1]["month"] == "2010-12"
    assert result["trend"]["n_years"] == 11
    assert result["trend"]["slope_per_decade"] != pytest.approx(0.09179457757906843)
    assert any("Fewer than 20" in w for w in result["warnings"])


@pytest.mark.parametrize("latitude,longitude", [(0.0, 0.0), (51.1694, 71.4491), (-90.0, -180.0), (90.0, 180.0), (52.25, 76.875)])
def test_other_cell_is_not_pavlodar(client, payload, latitude, longitude):
    payload.update(latitude=latitude, longitude=longitude)
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "data_not_available"
    assert "monthly_series" not in response.text


def test_nearby_coordinate_with_same_cell_is_labeled(client, payload):
    payload.update(latitude=52.6, longitude=76.8)
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 200
    assert response.json()["requested"]["latitude"] == 52.6
    assert response.json()["actual_cell"]["latitude"] == 52.5
    assert response.json()["provenance"]["source_id"] == "pavlodar_1991_2025_v1"


@pytest.mark.parametrize("changes", [{"latitude": 90.1}, {"latitude": -90.1}, {"longitude": 180.1}, {"longitude": -180.1}, {"latitude": "nan"}, {"longitude": True}, {"variable": "RH"}, {"start_year": 1990}, {"end_year": 2026}, {"start_year": 2020, "end_year": 2010}, {"start_year": 2022}, {"start_year": "1991"}, {"end_year": True}, {"unexpected": "must-not-be-echoed"}])
def test_invalid_request(client, payload, changes):
    payload.update(changes)
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert "must-not-be-echoed" not in response.text


def test_nan_json_does_not_echo_raw_value(client, payload):
    payload["latitude"] = float("nan")
    response = client.post("/api/analysis", content=json.dumps(payload), headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert '"input"' not in response.text


def test_malformed_json(client):
    response = client.post("/api/analysis", content="{", headers={"Content-Type": "application/json"})
    assert response.status_code == 422


def test_unavailable_reference_returns_sanitized_503(tmp_path, payload):
    with TestClient(create_app(LocalReferenceSource(tmp_path))) as client:
        assert client.get("/api/health").status_code == 503
        response = client.post("/api/analysis", json=payload)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "reference_unavailable"
    assert str(tmp_path) not in response.text


def test_modified_reference_rejected(tmp_path, payload):
    (tmp_path/"monthly_values.json").write_text("[]", encoding="utf-8")
    with TestClient(create_app(LocalReferenceSource(tmp_path))) as client:
        response = client.post("/api/analysis", json=payload)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "reference_integrity_error"


@pytest.mark.parametrize("lon", [-180.0, 180.0])
def test_antimeridian_grid(lon):
    cell = nearest_cell(90.0, lon)
    assert cell.latitude == 90.0 and cell.latitude_index == 360
    assert cell.longitude == -180.0 and cell.longitude_index == 0


def test_openapi_schema_exposes_contract(client):
    result = client.get("/openapi.json").json()
    assert set(result["paths"]) == {"/api/health", "/api/variables", "/api/analysis"}
    assert "AnalysisResult" in result["components"]["schemas"]
    assert result["paths"]["/api/analysis"]["post"]["responses"]["422"]["content"]["application/json"]["schema"]["$ref"].endswith("ErrorResponse")


def test_five_year_minimum_is_explicit(client, payload):
    payload.update(end_year=1995)
    response = client.post("/api/analysis", json=payload)
    assert response.status_code == 200
    assert response.json()["trend"]["n_years"] == 5
    assert response.json()["trend"]["hac_maxlags"] == 3
    assert any("Fewer than 20" in w for w in response.json()["warnings"])


def test_unexpected_failure_does_not_leak_exception(payload, caplog):
    class FailedSource:
        def check_ready(self): pass
        def load(self, request): raise RuntimeError("PRIVATE_SENTINEL_MUST_NOT_LEAK")
    with TestClient(create_app(FailedSource())) as client:
        response = client.post("/api/analysis", json=payload)
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "PRIVATE_SENTINEL" not in response.text and "PRIVATE_SENTINEL" not in caplog.text


def test_injected_source_cannot_mislabel_cell(payload):
    from dataclasses import replace
    class WrongCellSource:
        def check_ready(self): pass
        def load(self, request):
            loaded = LocalReferenceSource().load(request)
            return replace(loaded, cell=nearest_cell(0.0, 0.0))
    with TestClient(create_app(WrongCellSource())) as client:
        response = client.post("/api/analysis", json=payload)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "coordinate_mismatch"
