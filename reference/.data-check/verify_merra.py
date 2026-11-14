"""Local scientific check. Credentials are entered locally and never persisted."""
from pathlib import Path
import contextlib
import io
import json
import logging
import os
import sys
import time
import urllib.parse
import warnings

ROOT = Path(__file__).resolve().parent
logging.disable(logging.CRITICAL)
warnings.filterwarnings('ignore')


def save(name, value):
    p = ROOT / name
    tmp = p.with_suffix(p.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    tmp.replace(p)


def status(stage, **extra):
    save('status.json', {'stage': stage, **extra})


def credentials():
    import tkinter as tk
    from tkinter import ttk
    win = tk.Tk()
    win.title('Earth Detective — NASA Earthdata Login')
    win.geometry('540x270')
    win.resizable(False, False)
    win.attributes('-topmost', True)
    box = ttk.Frame(win, padding=22)
    box.pack(fill='both', expand=True)
    ttk.Label(box, text='Local sign-in to NASA Earthdata (urs.earthdata.nasa.gov)').pack(anchor='w')
    ttk.Label(box, text='Credentials stay in this process. No .netrc file is written.').pack(anchor='w', pady=(4, 12))
    ttk.Label(box, text='Earthdata username').pack(anchor='w')
    username = ttk.Entry(box, width=64)
    username.pack(fill='x')
    ttk.Label(box, text='Earthdata password').pack(anchor='w', pady=(8, 0))
    password = ttk.Entry(box, show='*', width=64)
    password.pack(fill='x')
    result = []

    def submit(*_):
        if username.get().strip() and password.get():
            result.extend([username.get().strip(), password.get()])
            password.delete(0, 'end')
            username.delete(0, 'end')
            win.destroy()

    ttk.Button(box, text='Sign in and verify January 1991', command=submit).pack(pady=(15, 0))
    win.bind('<Return>', submit)
    username.focus_set()
    win.mainloop()
    return result


def main():
    import earthaccess
    import netCDF4
    import numpy as np
    status('awaiting_local_sign_in')
    values = credentials()
    if not values:
        status('sign_in_cancelled')
        return
    os.environ['EARTHDATA_USERNAME'], os.environ['EARTHDATA_PASSWORD'] = values
    values.clear()
    status('authenticating_earthdata')
    try:
        # Library output is discarded, including exception descriptions.
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            auth = earthaccess.login(strategy='environment', persist=False)
    except Exception as exc:
        status('earthdata_login_failed', error_type=type(exc).__name__)
        return
    finally:
        os.environ.pop('EARTHDATA_USERNAME', None)
        os.environ.pop('EARTHDATA_PASSWORD', None)
    if not auth.authenticated:
        status('earthdata_login_failed', authenticated=False)
        return
    session = earthaccess.get_requests_https_session()
    status('earthdata_authenticated')
    trace = []

    def get(url, **kw):
        response = session.get(url, timeout=(15, 100), **kw)
        trace.append({
            'host': urllib.parse.urlsplit(url).hostname,
            'path': urllib.parse.urlsplit(url).path,
            'status': response.status_code,
            'redirects': [{'status': h.status_code, 'host': urllib.parse.urlsplit(h.url).hostname} for h in response.history],
            'final_host': urllib.parse.urlsplit(response.url).hostname,
        })
        save('http_trace.json', trace)
        return response

    cmr_url = 'https://cmr.earthdata.nasa.gov/search/granules.json'
    result = get(cmr_url, params={
        'short_name': 'M2TMNXSLV', 'version': '5.12.4',
        'temporal': '1991-01-01T00:00:00Z,2025-12-31T23:59:59Z',
        'page_size': 500, 'sort_key': 'start_date',
    })
    result.raise_for_status()
    entries = result.json()['feed']['entry']
    manifest = []
    for e in entries:
        links = [l for l in e['links'] if not l.get('inherited')]
        manifest.append({
            'month': e['time_start'][:7], 'title': e['title'],
            'opendap': next(l['href'] for l in links if l.get('title', '').startswith('OPeNDAP')),
            'download': next(l['href'] for l in links if l.get('title', '').startswith('Download ')),
        })
    save('manifest.json', manifest)
    ce = ';'.join(f'/{v}[0:1:0][285:1:285][411:1:411]' for v in ['T2M', 'QV2M'])
    ce += ';/lat[285:1:285];/lon[411:1:411];/time[0:1:0]'

    def extract(entry):
        response = get(entry['opendap'] + '.dap.nc4', params={'dap4.ce': ce})
        if response.status_code != 200:
            return None, {'month': entry['month'], 'status': response.status_code, 'phase': 'opendap_subset'}
        if not response.content.startswith((b'\x89HDF', b'CDF')):
            return None, {'month': entry['month'], 'phase': 'unexpected_response', 'content_type': response.headers.get('Content-Type')}
        with netCDF4.Dataset('memory', memory=response.content) as ds:
            row = {'month': entry['month']}
            details = {}
            for variable in ['T2M', 'QV2M', 'lat', 'lon', 'time']:
                v = ds.variables[variable]
                a = v[:]
                row[variable] = None if np.ma.is_masked(a.reshape(-1)[0]) else float(a.reshape(-1)[0])
                details[variable] = {'dimensions': list(v.dimensions), 'shape': list(v.shape), 'attributes': {
                    k: (x.tolist() if hasattr(x, 'tolist') else x)
                    for k in v.ncattrs() if k in ['units', 'long_name', 'standard_name', '_FillValue', 'missing_value', 'scale_factor', 'add_offset', 'valid_range', 'calendar']
                    for x in [v.getncattr(k)]
                }}
            if not np.isclose(row['lat'], 52.5) or not np.isclose(row['lon'], 76.875):
                return None, {'month': entry['month'], 'phase': 'coordinate_mismatch'}
            row['T2M_C'] = None if row['T2M'] is None else row['T2M'] - 273.15
            return (row, details, response.content), None

    status('reading_january_1991')
    first, failure = extract(manifest[0])
    if failure:
        # Diagnose metadata and file access independently; never persist responses.
        checks = []
        for label, url in [('opendap_dds', manifest[0]['opendap']+'.dds'), ('direct_file', manifest[0]['download'])]:
            try:
                r = get(url, stream=True)
                checks.append({'check': label, 'status': r.status_code})
                r.close()
            except Exception as exc:
                checks.append({'check': label, 'error_type': type(exc).__name__})
        status('january_failed', earthdata_authenticated=True, failure=failure, checks=checks)
        return
    row, details, content = first
    (ROOT/'january_1991_subset.nc4').write_bytes(content)
    save('january_1991.json', {'values': row, 'metadata': details})
    rows = [row]
    save('monthly_values.json', rows)
    status('january_verified', values=row)
    # Keep the authenticated session in memory for sequential checks or diagnostics.
    deadline = time.monotonic() + 1800
    while time.monotonic() < deadline:
        command = ROOT/'command.json'
        if not command.exists():
            time.sleep(1)
            continue
        action = json.loads(command.read_text(encoding='utf-8')).get('action')
        command.unlink()
        if action == 'stop':
            status('stopped')
            return
        if action != 'full':
            continue
        for i, entry in enumerate(manifest[1:], start=2):
            data, failure = extract(entry)
            if failure:
                status('series_failed', completed=len(rows), failure=failure)
                return
            row, _, _ = data
            rows.append(row)
            save('monthly_values.json', rows)
            status('downloading_series', completed=i, total=len(manifest), last_month=entry['month'])
        status('series_downloaded', completed=len(rows))
        return
    status('session_expired_locally')


if __name__ == '__main__':
    try:
        main()
    except BaseException as exc:
        # Raw exception messages, URLs and tracebacks may contain credentials.
        status('failed', error_type=type(exc).__name__)
