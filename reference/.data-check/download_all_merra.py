"""Resumable NASA download; credentials remain only in process memory."""
from pathlib import Path
import contextlib, io, json, logging, os, time, hashlib, getpass
from datetime import datetime, timezone
import requests, netCDF4, numpy as np, earthaccess
ROOT=Path(__file__).resolve().parent
CACHE=ROOT/'cache'
logging.disable(logging.CRITICAL)
EXPECTED=[f'{y}-{m:02}' for y in range(1991,2026) for m in range(1,13)]
CE=';'.join(f'/{v}[0:1:0][285:1:285][411:1:411]' for v in ['T2M','QV2M'])+';/lat[285:1:285];/lon[411:1:411];/time[0:1:0]'

def save(name,obj):
 p=ROOT/name; tmp=p.with_suffix(p.suffix+'.tmp')
 tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8');tmp.replace(p)

def status(stage,**kw):
 save('download_status.json',{'stage':stage,'utc':datetime.now(timezone.utc).isoformat(),**kw})
 print(stage,kw,flush=True)

def login():
 for strategy in ['environment','netrc']:
  try:
   with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
    a=earthaccess.login(strategy=strategy,persist=False)
   if a.authenticated:return
  except Exception:pass
 status('awaiting_local_sign_in')
 print('NASA Earthdata local sign-in. Password is hidden. Credentials stay in memory only.')
 username=input('Earthdata username: ').strip();password=getpass.getpass('Earthdata password (hidden): ')
 os.environ['EARTHDATA_USERNAME']=username;os.environ['EARTHDATA_PASSWORD']=password
 username=password=None
 try:
  with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
   a=earthaccess.login(strategy='environment',persist=False)
 finally:
  os.environ.pop('EARTHDATA_USERNAME',None);os.environ.pop('EARTHDATA_PASSWORD',None)
 if not a.authenticated:raise RuntimeError('AuthenticationFailed')

def inspect(path,month,full=False):
 with netCDF4.Dataset(path) as ds:
  if full:assert ds.ShortName=='M2TMNXSLV' and ds.VersionID=='5.12.4'
  lat=np.asarray(ds['lat'][:]);lon=np.asarray(ds['lon'][:])
  i=int(np.argmin(abs(lat-52.27601)));j=int(np.argmin(abs(lon-76.96881)))
  assert abs(float(lat[i])-52.5)<1e-9 and abs(float(lon[j])-76.875)<1e-9
  assert ds['T2M'].shape[0]==ds['QV2M'].shape[0]==1
  tv=ds['time'];tv.set_auto_maskandscale(False)
  date=netCDF4.num2date(tv[:],tv.units,calendar=getattr(tv,'calendar','standard'))[0]
  assert str(date)[:7]==month
  if 'RangeBeginningDate' in ds.ncattrs():assert ds.RangeBeginningDate[:7]==month
  row={'month':month,'lat':float(lat[i]),'lon':float(lon[j]),'time':float(tv[0])};meta={}
  for name,units in [('T2M','K'),('QV2M','kg kg-1')]:
   v=ds[name];assert v.units==units and v.dimensions==('time','lat','lon')
   v.set_auto_maskandscale(False);value=float(v[0,i,j]);assert np.isfinite(value)
   for attr in ['_FillValue','missing_value']:
    if attr in v.ncattrs():assert value!=float(v.getncattr(attr))
   if 'valid_range' in v.ncattrs():
    lo,hi=v.valid_range;assert lo<=value<=hi
   assert (180<=value<=330) if name=='T2M' else (0<=value<=0.1)
   row[name]=value
   meta[name]={'dimensions':list(v.dimensions),'attributes':{k:(a.tolist() if hasattr(a,'tolist') else a) for k in v.ncattrs() if k in ['units','long_name','_FillValue','missing_value','valid_range','scale_factor','add_offset'] for a in [v.getncattr(k)]}}
  row['T2M_C']=row['T2M']-273.15
  return row,{'month':month,'time_label':str(date),'metadata':meta,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source_file':path.name,'global_attributes':{k:str(ds.getncattr(k)) for k in ds.ncattrs() if k in ['ShortName','VersionID','RangeBeginningDate','RangeEndingDate','identifier_product_doi']}}

def main():
 CACHE.mkdir(exist_ok=True);status('querying_cmr')
 r=requests.get('https://cmr.earthdata.nasa.gov/search/granules.json',params={'short_name':'M2TMNXSLV','version':'5.12.4','temporal':'1991-01-01T00:00:00Z,2025-12-31T23:59:59Z','page_size':500,'sort_key':'start_date'},timeout=90);r.raise_for_status()
 manifest=[]
 for e in r.json()['feed']['entry']:
  links=[l for l in e['links'] if not l.get('inherited')]
  manifest.append({'month':e['time_start'][:7],'granule_id':e['id'],'title':e['title'],'filename':e['producer_granule_id'],'time_start':e['time_start'],'time_end':e['time_end'],'download':next(l['href'] for l in links if l.get('title','').startswith('Download ')),'opendap':next(l['href'] for l in links if l.get('title','').startswith('OPeNDAP'))})
 assert [m['month'] for m in manifest]==EXPECTED
 save('manifest.json',manifest)
 login();session=earthaccess.get_requests_https_session();status('earthdata_authenticated',total=420)
 rows=[];checks=[];failures=[]
 for entry in manifest:
  month=entry['month'];path=CACHE/(month+'.nc4');mode='cached_subset'
  local=ROOT.parent/entry['filename']
  if local.exists():path=local;mode='local_original'
  if not path.exists():
   success=False
   for attempt in range(3):
    try:
     r=session.get(entry['opendap']+'.dap.nc4',params={'dap4.ce':CE},timeout=(20,150))
     if r.status_code==200 and r.content.startswith((b'\x89HDF',b'CDF')):
      tmp=path.with_suffix('.tmp');tmp.write_bytes(r.content);inspect(tmp,month);tmp.replace(path);success=True;mode='opendap_subset';break
     failures.append({'month':month,'method':'opendap','status':r.status_code,'attempt':attempt+1})
     if r.status_code in [401,403,404]:break
    except Exception as exc:failures.append({'month':month,'method':'opendap','error_type':type(exc).__name__,'attempt':attempt+1})
    time.sleep(2*(attempt+1))
   if not success:
    fullpath=CACHE/entry['filename'];mode='direct_original'
    for attempt in range(3):
     try:
      with session.get(entry['download'],stream=True,timeout=(20,180)) as resp:
       if resp.status_code!=200:
        failures.append({'month':month,'method':'direct','status':resp.status_code,'attempt':attempt+1})
        if resp.status_code in [401,403]:break
        continue
       tmp=fullpath.with_suffix('.tmp')
       with tmp.open('wb') as f:
        for chunk in resp.iter_content(1024*1024):f.write(chunk)
      inspect(tmp,month,True);tmp.replace(fullpath);path=fullpath;success=True;break
     except Exception as exc:failures.append({'month':month,'method':'direct','error_type':type(exc).__name__,'attempt':attempt+1})
    if not success:
     save('download_diagnostics.json',failures);status('download_failed',completed=len(rows),month=month);return
  row,check=inspect(path,month,mode in ['local_original','direct_original'])
  check['retrieval']=mode;check['cmr_granule_id']=entry['granule_id'];checks.append(check);rows.append(row)
  save('monthly_values.json',rows);save('monthly_quality.json',checks)
  if len(rows)==1:save('january_1991.json',{'values':row,'metadata':check['metadata']})
  status('downloading',completed=len(rows),total=420,last_month=month,retrieval=mode)
 save('download_diagnostics.json',failures)
 import analyze_merra
 analyze_merra.main()
 status('complete',completed=420,total=420)

if __name__=='__main__':
 try:main()
 except (KeyboardInterrupt,EOFError):status('local_sign_in_or_run_cancelled')
 except BaseException as exc:status('failed',error_type=type(exc).__name__)
 finally:
  import write_report
  write_report.main()
