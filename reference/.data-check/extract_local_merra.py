"""Validate local NASA M2TMNXSLV files without credentials or network access."""
from pathlib import Path
import hashlib
import json
import warnings
import netCDF4
import numpy as np

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parent
CITY = (52.27601, 76.96881)


def extract(path):
    with netCDF4.Dataset(path) as ds:
        assert ds.ShortName == 'M2TMNXSLV' and ds.VersionID == '5.12.4'
        lat = ds.variables['lat'][:]
        lon = ds.variables['lon'][:]
        i, j = int(np.argmin(abs(lat-CITY[0]))), int(np.argmin(abs(lon-CITY[1])))
        assert len(ds.dimensions['time']) == 1
        month = ds.RangeBeginningDate[:7]
        t = ds.variables['time']
        t.set_auto_maskandscale(False)
        decoded = netCDF4.num2date(t[:], t.units, calendar=getattr(t, 'calendar', 'standard'))[0]
        assert str(decoded)[:7] == month
        row = {'month':month, 'lat':float(lat[i]), 'lon':float(lon[j])}
        meta = {}
        for name, units in [('T2M','K'),('QV2M','kg kg-1')]:
            v = ds.variables[name]
            assert v.units == units and v.dimensions == ('time','lat','lon')
            v.set_auto_maskandscale(False)
            value = float(v[0,i,j])
            invalid = not np.isfinite(value)
            for attr in ['_FillValue','missing_value']:
                if attr in v.ncattrs(): invalid |= value == float(v.getncattr(attr))
            row[name] = None if invalid else value
            meta[name] = {'units':v.units, 'long_name':v.long_name, 'cell_missing':bool(invalid)}
        row['T2M_C'] = None if row['T2M'] is None else row['T2M']-273.15
        row['QV2M_g_per_kg'] = None if row['QV2M'] is None else row['QV2M']*1000
        return {'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                'dataset':ds.ShortName,'version':ds.VersionID,'doi':ds.identifier_product_doi,
                'values':row,'metadata':meta,'time_label':str(decoded),
                'time_note':'time valid_range exceeds int32; date decoded from raw time and units, checked against RangeBeginningDate',
                'cell_indices_zero_based':{'lat':i,'lon':j}}


if __name__ == '__main__':
    files = sorted(set(WORKSPACE.glob('MERRA2_*.nc4')) | set(ROOT.glob('MERRA2_*.nc4')))
    records = [extract(p) for p in files]
    months = [r['values']['month'] for r in records]
    assert len(months) == len(set(months)), 'Duplicate months'
    expected = [f'{y}-{m:02}' for y in range(1991,2026) for m in range(1,13)]
    report = {'records':records,'expected_months':420,
              'available_months':len(set(months)&set(expected)),
              'missing_months':[m for m in expected if m not in months]}
    (ROOT/'local_file_verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
    print(json.dumps({'records':records,'available_months':report['available_months'],
                      'missing_month_count':len(report['missing_months'])},ensure_ascii=False,indent=2))
