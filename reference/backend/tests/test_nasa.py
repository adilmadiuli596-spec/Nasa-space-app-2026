from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time

from fastapi.testclient import TestClient
import netCDF4
import numpy as np
import pytest
import requests

from earth_detective.cache import FileCache, canonical
from earth_detective.errors import ScienceError
from earth_detective.main import create_app
from earth_detective.nasa import CatalogGranule, NasaSource, decode_subset, _netcdf_lock
from earth_detective.nasa_config import NasaConfig
from earth_detective.nasa_http import NasaHTTP
from earth_detective.schemas import AnalysisRequest
from earth_detective.source import nearest_cell


def entry(month="1991-01"):
    filename = f"MERRA2_100.tavgM_2d_slv_Nx.{month.replace('-', '')}.nc4"
    return CatalogGranule(month=month, filename=filename, granule_id="G123-GES_DISC", updated="2020-01-01T00:00:00Z",
                          opendap="https://opendap.earthdata.nasa.gov/collections/C1276812859-GES_DISC/granules/"+filename)


def subset(month="1991-01", latitude=52.5, longitude=13.125, case="valid"):
    with _netcdf_lock:
        d = netCDF4.Dataset("mock", mode="w", memory=65536)
        for dim in ["time", "lat", "lon"]: d.createDimension(dim, 1)
        d.ShortName="M2TMNXSLV"; d.VersionID="5.12.4"; d.identifier_product_doi="10.5067/AP1B0BA5PD2K"
        import calendar
        year, m=map(int, month.split("-"))
        d.RangeBeginningDate=month+"-01"; d.RangeEndingDate=f"{month}-{calendar.monthrange(year,m)[1]:02}"
        for name,value in [("lat",latitude),("lon",longitude)]: d.createVariable(name,"f8",(name,))[:]=value
        t=d.createVariable("time","i4",("time",));t.units=f"minutes since {month}-01 00:30:00";t[:]=0
        for name,value,unit in [("T2M",280.0,"K"),("QV2M",.004,"kg kg-1")]:
            v=d.createVariable(name,"f4",("time","lat","lon"),fill_value=-9999.0);v.units=unit;v[:]=value
            v.valid_range=np.array([0,330],dtype="f4")
        if case=="units":d["T2M"].units="°C"
        if case=="fill":d["T2M"][:]=-9999.0
        if case=="time":t[:]=60*24*40
        if case=="coordinates":d["lat"][:]=latitude+1
        if case=="product":d.ShortName="OTHER"
        if case=="range":d.RangeEndingDate=month+"-01"
        if case=="physical":d["QV2M"][:]=.2
        return bytes(d.close())


class FakeNASA:
    def __init__(self, fail=None, incomplete=False):
        self.calls=[];self.fail=fail;self.incomplete=incomplete
    def get(self,url,params,*,authenticated,deadline):
        self.calls.append((url,params,authenticated))
        if not authenticated:
            rows=[]
            for year in range(1991,1996):
                for m in range(1,13):
                    e=entry(f"{year}-{m:02}")
                    rows.append({"id":e.granule_id,"producer_granule_id":e.filename,"data_center":"GES_DISC",
                                 "title":"M2TMNXSLV.5.12.4:"+e.filename,"time_start":e.month+"-01T00:00:00Z","updated":e.updated,
                                 "links":[{"title":"OPeNDAP request URL","href":e.opendap}]})
            if self.incomplete:rows.pop()
            return json.dumps({"feed":{"entry":rows}}).encode()
        if self.fail:raise self.fail
        assert "/T2M[0:1:0][285:1:285][309:1:309]" in params["dap4.ce"]
        assert "/QV2M" in params["dap4.ce"]
        yyyymm=url.split(".")[-4] if False else url.split("slv_Nx.")[1][:6]
        return subset(yyyymm[:4]+"-"+yyyymm[4:])


def nasa_request():
    return AnalysisRequest(latitude=52.52,longitude=13.405,variable="T2M",start_year=1991,end_year=1995)


def test_cold_and_warm_cache_no_cross_cell_substitution(tmp_path):
    fake=FakeNASA();source=NasaSource(NasaConfig(cache_dir=tmp_path),http=fake)
    request=nasa_request()
    cold=source.load(request);assert cold.cell.longitude==13.125
    assert cold.provenance.cache_misses==60 and cold.provenance.network_used
    calls=len(fake.calls)
    warm=source.load(request.model_copy(update={"variable":"QV2M"}))
    assert warm.provenance.cache_hits==60 and warm.provenance.catalog_cache_hit
    assert not warm.provenance.network_used and len(fake.calls)==calls
    assert cold.records[0]["value"]==280.0
    assert warm.records[0]["value"]==pytest.approx(.004)
    assert len(list((tmp_path/"locks").glob("*.lock")))<=65


@pytest.mark.parametrize("case",["units","time","coordinates","product","range","physical"])
def test_netcdf_validation(case):
    with pytest.raises(ScienceError) as e:
        decode_subset(subset(case=case),entry(),nearest_cell(52.52,13.405))
    assert e.value.status==502


def test_missing_netcdf_values_not_imputed():
    with pytest.raises(ScienceError) as e:
        decode_subset(subset(case="fill"),entry(),nearest_cell(52.52,13.405))
    assert e.value.code=="nasa_missing_data"


def test_invalid_binary_format():
    with pytest.raises(ScienceError) as e:decode_subset(b"<html>login</html>",entry(),nearest_cell(52.52,13.405))
    assert e.value.code=="nasa_invalid_format"


@pytest.mark.parametrize("url",["http://opendap.earthdata.nasa.gov/collections/abc","https://evil.example/collections/abc","https://secret:password@opendap.earthdata.nasa.gov/collections/abc","https://opendap.earthdata.nasa.gov/collections/abc?token=secret"])
def test_catalog_url_allowlist(url):
    payload=entry().model_dump();payload["opendap"]=url
    with pytest.raises(ValueError):CatalogGranule.model_validate(payload)


def test_incomplete_catalog_is_upstream_error(tmp_path):
    source=NasaSource(NasaConfig(cache_dir=tmp_path),http=FakeNASA(incomplete=True))
    with TestClient(create_app(source)) as client:
        response=client.post('/api/analysis',json=nasa_request().model_dump())
    assert response.status_code==502 and response.json()['error']['code']=='nasa_incomplete_series'


@pytest.mark.parametrize("code,status",[("nasa_auth_required",503),("nasa_forbidden",503),("nasa_rate_limited",503),("nasa_timeout",504),("nasa_unavailable",503)])
def test_upstream_failure_does_not_become_no_data(tmp_path,code,status):
    source=NasaSource(NasaConfig(cache_dir=tmp_path),http=FakeNASA(fail=ScienceError(code,"Controlled upstream failure",status)))
    with TestClient(create_app(source)) as client:
        response=client.post('/api/analysis',json=nasa_request().model_dump())
    assert response.status_code==status
    assert response.json()['error']['code']==code
    assert 'data_not_available' not in response.text


def test_dynamic_mode_metadata_and_default_period(tmp_path):
    source=NasaSource(NasaConfig(cache_dir=tmp_path),http=FakeNASA())
    with TestClient(create_app(source)) as client:
        assert client.get('/api/health').json()['dynamic_nasa_enabled'] is True
        assert client.get('/api/variables').json()['available_cells'] is None
        assert client.get('/api/health').json()['nasa_network']=='not_checked'
    request=AnalysisRequest(latitude=0.0,longitude=0.0,variable="T2M")
    assert (request.start_year,request.end_year)==(1991,2025)


def test_cache_corruption_refetches(tmp_path):
    cache=FileCache(tmp_path,8192);identity={'month':'1991-01'};calls=[]
    def producer():calls.append(1);return {'value':3.0}
    cache.get_or_create(identity,producer,lambda x:x)
    path=tmp_path/(cache.key(identity)+'.json');path.write_text('{broken',encoding='utf-8')
    value,hit=cache.get_or_create(identity,producer,lambda x:x)
    assert value=={'value':3.0} and not hit and len(calls)==2
    envelope=json.loads(path.read_text());envelope['payload']['value']=9
    path.write_text(json.dumps(envelope),encoding='utf-8')
    value,hit=cache.get_or_create(identity,producer,lambda x:x)
    assert value['value']==3.0 and not hit and len(calls)==3


def test_cache_validation_even_with_matching_hash(tmp_path):
    cache=FileCache(tmp_path,8192);identity={'key':1}
    def validator(value):
        if set(value)!={'value'}:raise ValueError('unexpected field')
        return value
    producer=lambda:{'value':1}
    cache.get_or_create(identity,producer,validator)
    path=tmp_path/(cache.key(identity)+'.json');envelope=json.loads(path.read_text())
    envelope['payload']['password']='NEVER_STORE_THIS';envelope['sha256']=hashlib.sha256(canonical(envelope['payload'])).hexdigest()
    path.write_text(json.dumps(envelope),encoding='utf-8')
    _,hit=cache.get_or_create(identity,producer,validator)
    assert not hit and 'NEVER_STORE_THIS' not in path.read_text()


def test_cache_limit_and_thread_concurrency(tmp_path):
    cache=FileCache(tmp_path,1500);calls=[];identity={'same':True}
    def producer():calls.append(1);time.sleep(.03);return {'value':'x'*200}
    with ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(lambda _:cache.get_or_create(identity,producer,lambda x:x),range(8)))
    assert len(calls)==1 and sum(hit for _,hit in results)==7
    for i in range(20):cache.get_or_create({'i':i},producer,lambda x:x)
    assert sum(p.stat().st_size for p in tmp_path.glob('*.json'))<=1500
    assert len(list((tmp_path/'locks').glob('*.lock')))<=65


def test_cache_process_concurrency(tmp_path):
    code="""
from pathlib import Path
import sys,time
from earth_detective.cache import FileCache
p=Path(sys.argv[1]);c=FileCache(p,8192)
def make():
 with (p/'count.txt').open('a') as f:f.write('download\\n')
 time.sleep(.2)
 return {'value':1}
c.get_or_create({'same':True},make,lambda x:x)
"""
    flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
    processes=[subprocess.Popen([sys.executable,'-B','-c',code,str(tmp_path)],cwd=Path(__file__).resolve().parents[1],creationflags=flags) for _ in range(2)]
    assert all(p.wait(timeout=30)==0 for p in processes)
    assert (tmp_path/'count.txt').read_text().splitlines()==['download']


def test_cache_expired_catalog(tmp_path):
    cache=FileCache(tmp_path,8192);identity={'catalog':1};calls=[]
    def make():calls.append(1);return [1]
    cache.get_or_create(identity,make,lambda x:x,ttl=.01);time.sleep(.02)
    cache.get_or_create(identity,make,lambda x:x,ttl=.01)
    assert len(calls)==2


class Response:
    def __init__(self,status=200,content=b'ok',url='https://opendap.earthdata.nasa.gov/collections/a',headers=None):
        self.status_code=status;self.content=content;self.url=url;self.headers=headers or {}
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def iter_content(self,size):yield self.content


class Session:
    def __init__(self,responses):self.responses=list(responses);self.calls=[]
    def get(self,url,**kw):
        self.calls.append(kw);out=self.responses.pop(0)
        if isinstance(out,Exception):raise out
        return out
    def close(self):pass


@pytest.mark.parametrize('status,code,out_status',[(401,'nasa_auth_required',503),(403,'nasa_forbidden',503),(429,'nasa_rate_limited',503),(500,'nasa_unavailable',503),(404,'nasa_granule_unavailable',502),(400,'nasa_http_error',502)])
def test_http_status_mapping(tmp_path,status,code,out_status):
    config=NasaConfig(cache_dir=tmp_path,attempts=1);session=Session([Response(status=status)])
    with pytest.raises(ScienceError) as e:NasaHTTP(config,session_provider=lambda:session).get('https://opendap.earthdata.nasa.gov/collections/a',{},authenticated=True,deadline=time.monotonic()+10)
    assert e.value.code==code and e.value.status==out_status
    assert session.calls[0]['verify'] is True
    assert max(session.calls[0]['timeout'])<=10


@pytest.mark.parametrize('error,code,status',[(requests.exceptions.Timeout('SECRET'),'nasa_timeout',504),(requests.exceptions.ConnectionError('SECRET'),'nasa_unavailable',503),(requests.exceptions.SSLError('SECRET'),'nasa_tls_error',502)])
def test_transport_failure_is_sanitized(tmp_path,error,code,status):
    config=NasaConfig(cache_dir=tmp_path,attempts=1);session=Session([error])
    with pytest.raises(ScienceError) as e:NasaHTTP(config,session_provider=lambda:session).get('https://opendap.earthdata.nasa.gov/collections/a',{},authenticated=True,deadline=time.monotonic()+10)
    assert e.value.code==code and e.value.status==status and 'SECRET' not in e.value.message


def test_429_retry_is_bounded_and_honors_small_retry_after(tmp_path,monkeypatch):
    delays=[];monkeypatch.setattr('earth_detective.nasa_http.time.sleep',delays.append)
    config=NasaConfig(cache_dir=tmp_path,attempts=3)
    session=Session([Response(status=429,headers={'Retry-After':'2'}),Response(status=503),Response()])
    assert NasaHTTP(config,session_provider=lambda:session).get('https://opendap.earthdata.nasa.gov/collections/a',{},authenticated=True,deadline=time.monotonic()+10)==b'ok'
    assert len(session.calls)==3 and delays[0]==2


def test_size_limit_and_redirect_auth(tmp_path):
    config=NasaConfig(cache_dir=tmp_path,max_response_bytes=4096)
    for response,code in [(Response(content=b'x'*4097),'nasa_response_too_large'),(Response(url='https://urs.earthdata.nasa.gov/login'),'nasa_auth_required')]:
        session=Session([response])
        with pytest.raises(ScienceError) as e:NasaHTTP(config,session_provider=lambda:session).get('https://opendap.earthdata.nasa.gov/collections/a',{},authenticated=True,deadline=time.monotonic()+10)
        assert e.value.code==code


def test_invalid_host_and_expired_deadline(tmp_path):
    config=NasaConfig(cache_dir=tmp_path)
    http=NasaHTTP(config,session_provider=lambda:None)
    with pytest.raises(ScienceError) as e:http.get('https://evil.example/abc',{},authenticated=True,deadline=time.monotonic()+10)
    assert e.value.code=='nasa_invalid_url'
    with pytest.raises(ScienceError) as e:http.get('https://opendap.earthdata.nasa.gov/collections/a',{},authenticated=True,deadline=0)
    assert e.value.code=='nasa_timeout'
