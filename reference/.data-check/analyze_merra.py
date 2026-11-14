"""Reproduce annual OLS-HAC statistics from authenticated NASA subsets."""
from pathlib import Path
import hashlib
import importlib.metadata
import json
import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.diagnostic import acorr_ljungbox
from statsmodels.stats.multitest import multipletests

ROOT = Path(__file__).resolve().parent


def annual_means(frame, column):
    out = []
    for year, g in frame.groupby(frame.index.year):
        if len(g) != 12 or g[column].isna().any():
            raise ValueError('Incomplete annual series')
        out.append({'year': int(year), 'value': float(np.average(g[column], weights=g.index.days_in_month))})
    return out


def fit_trend(annual, lag):
    years = np.array([r['year'] for r in annual], dtype=float)
    y = np.array([r['value'] for r in annual], dtype=float)
    x = sm.add_constant(years-years.mean())
    model = sm.OLS(y, x).fit(cov_type='HAC', cov_kwds={
        'maxlags': lag, 'kernel': 'bartlett', 'use_correction': True,
    }, use_t=True)
    ci = model.conf_int(alpha=0.05)[1]*10
    resid = model.resid
    return {
        'n_years': len(y), 'hac_maxlags': lag,
        'slope_per_decade': float(model.params[1]*10),
        'standard_error_per_decade': float(model.bse[1]*10),
        'p_value_two_sided': float(model.pvalues[1]),
        'ci95_per_decade': [float(v) for v in ci],
        'r_squared': float(model.rsquared),
        'residual_lag1_correlation': float(np.corrcoef(resid[:-1], resid[1:])[0,1]),
        'ljung_box_lag3_p_value': float(acorr_ljungbox(resid, lags=[3], return_df=True)['lb_pvalue'].iloc[0]),
    }


def main():
    path = ROOT/'monthly_values.json'
    content = path.read_bytes()
    df = pd.DataFrame(json.loads(content))
    expected = pd.date_range('1991-01-01', '2025-12-01', freq='MS')
    df.index = pd.to_datetime(df.pop('month'), format='%Y-%m')
    assert len(df) == 420 and df.index.equals(expected), 'Months missing, duplicated or unordered'
    assert np.allclose(df['lat'], 52.5) and np.allclose(df['lon'], 76.875), 'Coordinates differ'
    for column in ['T2M', 'T2M_C', 'QV2M']:
        assert np.isfinite(df[column].to_numpy(dtype=float)).all(), 'Non-finite or missing values'
    metadata = json.loads((ROOT/'january_1991.json').read_text(encoding='utf-8'))['metadata']
    assert metadata['T2M']['attributes']['units'].lower() in ['k', 'kelvin']
    assert metadata['QV2M']['attributes']['units'] in ['kg kg-1', 'kg/kg', 'kg kg**-1']
    assert np.allclose(df['T2M_C'], df['T2M']-273.15)
    df['QV2M_g_kg'] = df['QV2M']*1000
    annual = {v: annual_means(df, v) for v in ['T2M_C', 'QV2M_g_kg']}
    results = {v: {'primary': fit_trend(a, 3), 'sensitivity': [fit_trend(a, lag) for lag in [1,2,4]]} for v,a in annual.items()}
    adjusted = multipletests([r['primary']['p_value_two_sided'] for r in results.values()], method='holm')[1]
    for r, p in zip(results.values(), adjusted):
        r['primary']['p_value_holm_two_variables'] = float(p)
    quality = {
        'expected_months':420, 'actual_months':len(df), 'missing_months':0,
        'null_or_nonfinite':{v:int((~np.isfinite(df[v])).sum()) for v in ['T2M','QV2M']},
        'coordinate_center':{'latitude':52.5,'longitude':76.875},
        'monthly_ranges':{v:{'min':float(df[v].min()),'max':float(df[v].max())} for v in ['T2M','T2M_C','QV2M']},
        'broad_plausibility_flags':{
            'T2M_outside_180_330_K':int(((df.T2M<180)|(df.T2M>330)).sum()),
            'QV2M_outside_0_0point1_kgkg':int(((df.QV2M<0)|(df.QV2M>0.1)).sum()),
        },
        'note':'Broad range checks are screening only, not validation against stations.'
    }
    seasonal_checks = {}
    for variable in ['T2M_C', 'QV2M_g_kg']:
        series = df[variable]
        mean = series.groupby(series.index.month).transform('mean')
        std = series.groupby(series.index.month).transform('std')
        z = (series-mean)/std
        order = z.abs().sort_values(ascending=False).head(5).index
        seasonal_checks[variable] = {
            'method':'Calendar-month mean and sample standard deviation across 35 years; screening only, no data removed',
            'count_abs_z_above_3':int((z.abs()>3).sum()),
            'top_five':[{'month':date.strftime('%Y-%m'),'value':float(series.loc[date]),'calendar_month_z_score':float(z.loc[date])} for date in order],
        }
    quality['seasonal_extreme_screening'] = seasonal_checks
    report = {
        'quality':quality, 'statistics':results, 'annual':annual,
        'method':{'aggregation':'days-in-month weighted mean, 12 valid months required',
                  'model':'OLS with intercept and centered calendar year',
                  'inference':'HAC Newey-West, Bartlett kernel, maxlags=3, finite sample correction, t reference df=n-2',
                  'limitations':'HAC and t reference are approximate for n=35; seasonal trends and reanalysis structural uncertainty are not quantified.'},
        'input_sha256':hashlib.sha256(content).hexdigest(),
        'versions':{n:importlib.metadata.version(n) for n in ['earthaccess','numpy','pandas','scipy','statsmodels','netCDF4']},
    }
    (ROOT/'analysis_results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    df.to_csv(ROOT/'monthly_values.csv', index_label='month')
    pd.DataFrame({'year':[x['year'] for x in annual['T2M_C']],
                  'T2M_C':[x['value'] for x in annual['T2M_C']],
                  'QV2M_g_kg':[x['value'] for x in annual['QV2M_g_kg']]}).to_csv(ROOT/'annual_values.csv',index=False)
    print(json.dumps({'quality':quality,'statistics':results},ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
