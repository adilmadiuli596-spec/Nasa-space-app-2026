from pathlib import Path
import json,sys,math
ROOT=Path.cwd();sys.path.insert(0,str(ROOT/'reference/backend'))
from earth_detective.result import scientific_result
from earth_detective.source import LoadedSeries
from earth_detective.schemas import AnalysisRequest,Cell,Provenance
actual=json.loads((ROOT/'docs/N4A_LIVE_BERLIN_2000_T2M.json').read_text())
case=next(c for c in json.loads((ROOT/'tests/fixtures/n2/real-cases.json').read_text()) if c['id']=='BERLIN_T2M')
records=[r for r in case['loaded']['records'] if '2000-01'<=r['month']<='2025-12']
expected=scientific_result(AnalysisRequest.model_validate(actual['requested']),LoadedSeries(records,Cell.model_validate(actual['actual_cell']),case['loaded']['source_unit'],(),Provenance.model_validate(actual['provenance']))).model_dump()
metrics={'numeric_leaves':0,'max_absolute_error':0.0,'errors':[]}
def compare(a,b,p):
 if isinstance(b,(int,float)) and not isinstance(b,bool):
  error=abs(a-b);metrics['numeric_leaves']+=1;metrics['max_absolute_error']=max(metrics['max_absolute_error'],error)
  if not math.isfinite(a) or error>1e-12+1e-10*abs(b):metrics['errors'].append(p)
 elif isinstance(b,list):
  assert len(a)==len(b),p
  for i,(x,y) in enumerate(zip(a,b,strict=True)):compare(x,y,f'{p}[{i}]')
 elif isinstance(b,dict):
  for k,v in b.items():compare(a[k],v,p+'.'+k)
 else:assert a==b,p
for k in ['requested','actual_cell','monthly_series','annual_series','trend','quality','warnings']:compare(actual[k],expected[k],k)
report={'passed':not metrics['errors'],'request':actual['requested'],'python_raw_source':'unchanged N2 Berlin raw records restricted to 2000–2025',**metrics}
(ROOT/'docs/N4A_PERIOD_PARITY.json').write_text(json.dumps(report,indent=2),encoding='utf-8');assert report['passed'];print(json.dumps(report))

