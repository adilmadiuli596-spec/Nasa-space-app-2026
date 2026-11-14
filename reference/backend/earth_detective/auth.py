"""Earthdata credentials stay in memory; no persistent login or token endpoint."""
import contextlib
import getpass
import io
import logging
import os
from pathlib import Path
import sys
import threading

import earthaccess

from .errors import ScienceError

_login_lock = threading.Lock()
_authenticated = False
_thread_sessions = threading.local()


def _login(strategies):
    global _authenticated
    logging.getLogger("earthaccess").setLevel(logging.CRITICAL)
    for strategy in strategies:
        try:
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                auth = earthaccess.login(strategy=strategy, persist=False)
            if auth.authenticated:
                _authenticated = True
                return
        except Exception:
            pass
    raise ScienceError("nasa_auth_required", "Earthdata login required; use the local interactive launcher or process environment", 503)


def session():
    with _login_lock:
        if not _authenticated:
            _login(["environment", "netrc"])
        if not hasattr(_thread_sessions, "session"):
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                _thread_sessions.session = earthaccess.get_requests_https_session()
            _thread_sessions.session.max_redirects = 5
        return _thread_sessions.session


def interactive_login():
    if not sys.stdin.isatty():
        raise ScienceError("interactive_terminal_required", "Use a real local terminal with hidden password entry", 503)
    # Disable QuickEdit in this console only; no OS configuration or ACL changes.
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes
        kernel = ctypes.windll.kernel32
        kernel.GetStdHandle.restype = wintypes.HANDLE
        handle = kernel.GetStdHandle(-10)
        mode = wintypes.DWORD()
        if kernel.GetConsoleMode(handle, ctypes.byref(mode)):
            kernel.SetConsoleMode(handle, (mode.value | 0x0080) & ~0x0040)
    print("NASA Earthdata local login. Both fields are hidden; nothing is saved.", flush=True)
    username = getpass.getpass("Earthdata username (hidden): ").strip()
    password = getpass.getpass("Earthdata password (hidden): ")
    with _login_lock:
        saved = {k: os.environ.get(k) for k in ["EARTHDATA_USERNAME", "EARTHDATA_PASSWORD", "EARTHDATA_TOKEN"]}
        try:
            os.environ.pop("EARTHDATA_TOKEN", None)
            os.environ["EARTHDATA_USERNAME"] = username
            os.environ["EARTHDATA_PASSWORD"] = password
            username = password = None
            _login(["environment"])
        finally:
            for key, value in saved.items():
                if value is None: os.environ.pop(key, None)
                else: os.environ[key] = value
            saved.clear()
    print("Earthdata authenticated. Credentials remain in this process only.", flush=True)
