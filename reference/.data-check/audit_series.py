"""Independent on-disk audit of every monthly NASA response and exported value."""
from pathlib import Path
import calendar, hashlib, json
import netCDF4
import numpy as np
ROOT=Path(__file__).resolve().parent

def main(require_complete=True):
 rows=json.loads((ROOT/'monthly_values.json').read_text())
 manifest=json.loads((ROOT/'manifest.json').read_text())
 checks=json.loads((ROOT/'monthly_quality.json').read_text())
 expected=[f'{y}-{m:02}' for y in range(1991,2026) for m in range(1,13)]
 assert len(rows)==len(checks)<=len(manifest)==420
 if require_complete:assert len(rows)==420
 assert [x['month'] for x in manifest]==expected
 assert [x['month'] for x in rows]==[x['month'] for x in checks]==expected[:len(rows)]
 records=[]
 for row,check,entry in zip(rows,checks,manifest):
  month=row['month'];year,m=map(int,month.split('-'))
  path=ROOT/'cache'/check['source_file']
  if not path.exists():path=ROOT.parent/check['source_file']
  digest=hashlib.sha256(path.read_bytes()).hexdigest();assert digest==check['sha256']
  with netCDF4.Dataset(path) as ds:
   assert ds.ShortName=='M2TMNXSLV' and ds.VersionID=='5.12.4'
   assert ds.identifier_product_doi=='10.5067/AP1B0BA5PD2K'
   assert ds.RangeBeginningDate==month+'-01'
   assert ds.RangeEndingDate==f'{month}-{calendar.monthrange(year,m)[1]:02}'
   lat=np.asarray(ds['lat'][:]);lon=np.asarray(ds['lon'][:])
   i=int(np.argmin(abs(lat-52.27601)));j=int(np.argmin(abs(lon-76.96881)))
   assert float(lat[i])==row['lat']==52.5 and float(lon[j])==row['lon']==76.875
   t=ds['time'];t.set_auto_maskandscale(False)
   assert t.size==1 and float(t[0])==row['time']
   date=netCDF4.num2date(t[:],t.units,calendar=getattr(t,'calendar','standard'))[0]
   assert (date.year,date.month)==(year,m)
   for name,unit in [('T2M','K'),('QV2M','kg kg-1')]:
    v=ds[name];assert v.units==unit and v.dimensions==('time','lat','lon')
    assert not hasattr(v,'scale_factor') and not hasattr(v,'add_offset')
    v.set_auto_maskandscale(False);value=float(v[0,i,j])
    assert np.isfinite(value) and value==row[name]
    for attr in ['_FillValue','missing_value']:
     if hasattr(v,attr):assert value!=float(v.getncattr(attr))
    lo,hi=v.valid_range;assert lo<=value<=hi
   assert row['T2M_C']==row['T2M']-273.15
  assert check['cmr_granule_id']==entry['granule_id']
  records.append({'month':month,'sha256':digest,'all_checks_passed':True})
 report={'all_available_checks_passed':True,'complete':len(rows)==420,'months':len(rows),'missing_months':420-len(rows),'duplicate_months':0,'nonfinite_values':0,'fill_values':0,'unit_mismatches':0,'coordinate_mismatches':0,'calendar_mismatches':0,'product_version_doi_mismatches':0,'sha256_mismatches':0,'records':records}
 (ROOT/'independent_audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 print(json.dumps({k:v for k,v in report.items() if k!='records'}))
if __name__=='__main__':main()
