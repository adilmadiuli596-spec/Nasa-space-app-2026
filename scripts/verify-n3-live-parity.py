"""Offline verification of saved HTTP results. No credentials, network or reference writes."""
from pathlib import Path
import sys,json,math
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'reference/backend'))
from earth_detective.result import scientific_result
from earth_detective.source import LoadedSeries
from earth_detective.schemas import AnalysisRequest,Cell,Provenance
cases=json.loads((ROOT/'tests/fixtures/n2/real-cases.json').read_text(encoding='utf-8'))
reports=[]
def compare(a,b,path,metrics):
    if isinstance(b,(float,int)) and not isinstance(b,bool):
        error=abs(a-b);metrics['numeric_leaves']+=1
        metrics['max_absolute_error']=max(metrics['max_absolute_error'],error)
        if not math.isfinite(a) or error>1e-12+1e-10*abs(b):metrics['errors'].append(path)
    elif isinstance(b,list):
        if len(a)!=len(b):metrics['errors'].append(path+'.length');return
        for i,(x,y) in enumerate(zip(a,b,strict=True)):compare(x,y,f'{path}[{i}]',metrics)
    elif isinstance(b,dict):
        for key,value in b.items():compare(a.get(key),value,path+'.'+key,metrics)
    elif a!=b:metrics['errors'].append(path)
for case in cases:
    p=ROOT/'docs'/('N3_LIVE_'+case['id']+'.json')
    if not p.exists():continue
    actual=json.loads(p.read_text(encoding='utf-8'));expected=case['expected'];metrics={'numeric_leaves':0,'max_absolute_error':0,'errors':[]}
    for key in ['requested','actual_cell','source_unit','unit','trend_unit','monthly_series','annual_series','trend','quality','warnings']:compare(actual[key],expected[key],key,metrics)
    for key,value in expected['method'].items():
        if not key.endswith('_version'):compare(actual['method'].get(key),value,'method.'+key,metrics)
    for key in ['provider','dataset','version','doi','source_id','mode']:compare(actual['provenance'][key],expected['provenance'][key],'provenance.'+key,metrics)
    for a,b in zip(actual['provenance']['granules'],expected['provenance']['granules'],strict=True):
        for key in ['month','granule_id','filename','url']:compare(a[key],b[key],'granule.'+key,metrics)
    reports.append({'id':case['id'],'passed':not metrics['errors'],**metrics,'python_trend':expected['trend'],'typescript_trend':actual['trend'],'response_hashes_equal_to_historical':sum(a['sha256']==b['sha256'] for a,b in zip(actual['provenance']['granules'],expected['provenance']['granules'],strict=True))})
tokyo=ROOT/'docs/N3_LIVE_TOKYO_T2M.json';tokyo_report={'status':'not_available'}
if tokyo.exists():
    actual=json.loads(tokyo.read_text(encoding='utf-8'))
    # Invert the known T2M Kelvin offset only for this independent verification;
    # the app never calls Python or reads this reconstructed fixture.
    records=[{'month':r['month'],'value':r['value']+273.15} for r in actual['monthly_series']]
    oracle=scientific_result(AnalysisRequest.model_validate(actual['requested']),LoadedSeries(records,Cell.model_validate(actual['actual_cell']),actual['source_unit'],(),Provenance.model_validate(actual['provenance']))).model_dump()
    metrics={'numeric_leaves':0,'max_absolute_error':0,'errors':[]}
    for key in ['requested','actual_cell','monthly_series','annual_series','trend','quality','warnings']:compare(actual[key],oracle[key],key,metrics)
    (ROOT/'docs/N3_TOKYO_PYTHON_ORACLE.json').write_text(json.dumps(oracle,indent=2,ensure_ascii=False),encoding='utf-8')
    tokyo_report={'passed':not metrics['errors'],**metrics,'note':'Independent Python replay of the fresh API time series; no historical Tokyo oracle or separate Python NASA download claimed','actual_cell':actual['actual_cell'],'trend':actual['trend']}
result={'rtol':1e-10,'atol':1e-12,'four_historical_analyses_passed':len(reports)==4 and all(r['passed'] for r in reports),'reports':reports,'third_cell_python_replay':tokyo_report,'runtime_metadata_policy':'Current cache/transport flags, SHA hashes and measured timings are verified by their role and reported as current; never copied from historic oracle. Python library versions replaced by truthful TS metadata.'}
(ROOT/'docs/N3_PARITY.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
assert result['four_historical_analyses_passed']
if tokyo.exists():assert tokyo_report['passed']
print(json.dumps({'four_historical_analyses_passed':result['four_historical_analyses_passed'],'max_absolute_error':max(r['max_absolute_error'] for r in reports),'third_cell':tokyo_report},ensure_ascii=False))
