import hashlib
import json
from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))

from earth_detective.main import create_app


@pytest.fixture(scope="session")
def baseline():
    return json.loads((ROOT / ".data-check" / "analysis_results.json").read_text())


@pytest.fixture
def client():
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def payload():
    return {"latitude": 52.27601, "longitude": 76.96881, "variable": "T2M", "start_year": 1991, "end_year": 2025}


@pytest.fixture(scope="session", autouse=True)
def protect_reference():
    paths = sorted((ROOT / ".data-check").glob("*.json")) + sorted((ROOT / ".data-check").glob("*.csv"))
    before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
    yield
    assert all(hashlib.sha256(p.read_bytes()).hexdigest() == digest for p, digest in before.items())
