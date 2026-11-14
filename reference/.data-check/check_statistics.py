"""Cross-check OLS and Newey-West inference with independent matrix algebra."""
from pathlib import Path
import json
import numpy as np
import pandas as pd
from scipy.stats import t
ROOT=Path(__file__).resolve().parent

def main():
 source=json.loads((ROOT/'monthly_values.json').read_text())
 reference=json.loads((ROOT/'analysis_results.json').read_text())
 df=pd.DataFrame(source);dates=pd.to_datetime(df.month+'-01')
 years=np.arange(1991,2026);X=np.column_stack([np.ones(35),years-years.mean()])
 bread=np.linalg.inv(X.T@X);out={}
 for variable,values in [('T2M_C',df.T2M.to_numpy()-273.15),('QV2M_g_kg',df.QV2M.to_numpy()*1000)]:
  annual=np.array([np.sum(values[dates.dt.year==year]*dates[dates.dt.year==year].dt.days_in_month.to_numpy())/dates[dates.dt.year==year].dt.days_in_month.sum() for year in years])
  beta=bread@X.T@annual;resid=annual-X@beta;z=X*resid[:,None]
  meat=z.T@z
  for lag in range(1,4):
   cross=z[lag:].T@z[:-lag]
   meat+=(1-lag/4)*(cross+cross.T)
  cov=(35/33)*bread@meat@bread
  slope=float(beta[1]*10);se=float(np.sqrt(cov[1,1])*10)
  p=float(2*t.sf(abs(slope/se),df=33));ci=np.array([slope-t.ppf(.975,33)*se,slope+t.ppf(.975,33)*se])
  ref=reference['statistics'][variable]['primary']
  assert np.isclose(slope,ref['slope_per_decade'],rtol=1e-10,atol=1e-12)
  assert np.isclose(se,ref['standard_error_per_decade'],rtol=1e-10,atol=1e-12)
  assert np.isclose(p,ref['p_value_two_sided'],rtol=1e-10,atol=1e-12)
  assert np.allclose(ci,ref['ci95_per_decade'],rtol=1e-10,atol=1e-12)
  out[variable]={'slope_per_decade':slope,'standard_error_per_decade':se,'p_value_two_sided':p,'ci95_per_decade':ci.tolist(),'matches_statsmodels':True}
 (ROOT/'statistics_crosscheck.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
 print(json.dumps(out,indent=2))
if __name__=='__main__':main()
