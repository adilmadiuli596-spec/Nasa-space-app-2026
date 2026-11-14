"""Offline oracle only; use an existing environment satisfying reference/backend/requirements.lock."""
from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'reference/backend'))
from fastapi.testclient import TestClient
from earth_detective.main import create_app
with TestClient(create_app()) as client:
    for variable in ['T2M','QV2M']:
        response=client.post('/api/analysis',json={'latitude':52.27601,'longitude':76.96881,'variable':variable,'start_year':1991,'end_year':2025})
        assert response.status_code==200
        (ROOT/'docs'/f'N1_ORACLE_{variable}.json').write_text(json.dumps(response.json(),ensure_ascii=False,indent=2),encoding='utf-8')
print('Two fresh Python reference API results written')
