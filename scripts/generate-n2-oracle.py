"""Read-only scientific replay; no NASA requests, credentials or cache writes."""
from pathlib import Path
import sys,json,hashlib,math,importlib.metadata
import numpy as np
from scipy.stats import t
import statsmodels.api as sm
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(r'D:\Projects\NASA')
sys.path.insert(0,str(ROOT/'reference/backend'))
from earth_detective.source import LoadedSeries
from earth_detective.schemas import AnalysisRequest,Cell,Provenance
from earth_detective.result import scientific_result
from earth_detective.inference import hac_trend

DEST=ROOT/'tests/fixtures/n2';DEST.mkdir(parents=True,exist_ok=True)
canonical=lambda x:json.dumps(x,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def write(name,value): (DEST/name).write_text(json.dumps(value,indent=2,ensure_ascii=False,allow_nan=False),encoding='utf-8')

audit=[];berlin={}
for p in sorted((SOURCE/'backend/.cache/cold-benchmark-berlin').glob('*.json')):
    envelope=json.loads(p.read_text());payload=envelope['payload']
    if not isinstance(payload,dict) or 'values' not in payload:continue
    assert hashlib.sha256(canonical(payload)).hexdigest()==envelope['sha256']
    assert payload['latitude']==52.5 and payload['longitude']==13.125
    assert payload['dataset']=='M2TMNXSLV' and payload['version']=='5.12.4' and payload['doi']=='10.5067/AP1B0BA5PD2K'
    assert payload['units']=={'T2M':'K','QV2M':'kg kg-1'} and payload['time_label'].startswith(payload['month']+'-01')
    assert payload['month'] not in berlin
    berlin[payload['month']]=payload['values']
    audit.append({'source':str(p.relative_to(SOURCE)).replace('\\','/'),'sha256':sha(p),'month':payload['month'],'response_sha256':payload['response_sha256']})
assert len(berlin)==420
pav=json.loads((ROOT/'reference/.data-check/monthly_values.json').read_text())
cases=[]
for city in ['PAVLODAR','BERLIN']:
 for variable in ['T2M','QV2M']:
    path=ROOT/'docs/history/pre-next'/f'3C_API_{city}_{variable}.json'
    original=json.loads(path.read_text(encoding='utf-8'))
    raw=[{'month':row['month'],'value':row[variable]} for row in pav] if city=='PAVLODAR' else [{'month':month,'value':values[variable]} for month,values in sorted(berlin.items())]
    assert len(raw)==len(original['monthly_series'])==420
    for a,b in zip(raw,original['monthly_series'],strict=True):
        value=a['value']-273.15 if variable=='T2M' else a['value']*1000
        assert a['month']==b['month'] and math.isclose(value,b['value'],rel_tol=1e-14,abs_tol=1e-14)
    loaded={'records':raw,'cell':original['actual_cell'],'source_unit':original['source_unit'],'fill_values':[999999986991104.0],'provenance':original['provenance'],'timings_ms':{}}
    request=AnalysisRequest.model_validate(original['requested'])
    oracle=scientific_result(request,LoadedSeries(raw,Cell.model_validate(loaded['cell']),loaded['source_unit'],tuple(loaded['fill_values']),Provenance.model_validate(loaded['provenance']))).model_dump()
    cases.append({'id':city+'_'+variable,'request':request.model_dump(),'loaded':loaded,'expected':oracle,'historical':original,'historical_sha256':sha(path)})
write('real-cases.json',cases)

# Every contiguous 5..35-year interval for both cities and variables (1984 fits).
periods=[]
for case in cases:
    for first in range(31):
        for last in range(first+4,35):
            annual=case['expected']['annual_series'][first:last+1]
            trend=hac_trend([r['year'] for r in annual],[r['value'] for r in annual]).model_dump()
            periods.append({'case':case['id'],'start':annual[0]['year'],'end':annual[-1]['year'],'trend':trend})
write('all-periods.json',periods)

numerical=[]
for n in [5,6,10,20,35]:
    years=np.arange(1991,1991+n);x=years-years.mean()
    for direction in [-1,1]:
        values=4+direction*.17*x+np.array([.2,-.3,.1,.4,-.2]*(n//5+1))[:n]
        fit=sm.OLS(values,sm.add_constant(x)).fit()
        for lag in range(0,min(5,n-1)):
            robust=fit.get_robustcov_results(cov_type='HAC',maxlags=lag,kernel='bartlett',use_correction=True,use_t=True)
            numerical.append({'years':years.tolist(),'values':values.tolist(),'lag':lag,'params':fit.params.tolist(),'covariance':robust.cov_params().tolist(),'trend':hac_trend(years,values).model_dump()})
write('numerical.json',numerical)
student=[{'df':df,'t':v,'p':float(2*t.sf(abs(v),df)),'reference_p':1-2*math.atan(abs(v))/math.pi if df==1 else float(2*t.sf(abs(v),df)),'reference_source':'analytic Cauchy identity' if df==1 else 'SciPy Student t','critical95':float(t.ppf(.975,df))} for df in [1,2,3,4,8,18,33,100] for v in [0,1e-8,.1,.66,1,2,5,10,50,1e4]]
write('student.json',student)
write('extraction.json',{'network_used_in_n2':False,'cache_envelopes_copied':False,'raw_berlin_observations':420,'source_records':audit,'versions':{n:importlib.metadata.version(n) for n in ['numpy','pandas','scipy','statsmodels']},'note':'Historic provenance flags describe saved 3C retrieval. This replay performs no network access; expected Python library versions/timings are not TypeScript runtime metadata.'})
print(json.dumps({'real_cases':len(cases),'all_periods':len(periods),'numerical_cases':len(numerical),'student_cases':len(student)}))
