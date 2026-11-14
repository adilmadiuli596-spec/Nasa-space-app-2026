import threading
import time
from urllib.parse import urlsplit

import requests

from . import auth
from .errors import ScienceError


class NasaHTTP:
    def __init__(self, config, session_provider=None, public_session=None):
        self.config = config
        self.session_provider = session_provider or auth.session
        self.public_session = public_session
        self.limit = threading.BoundedSemaphore(config.workers)

    def get(self, url, params, *, authenticated, deadline):
        if urlsplit(url).scheme != "https" or urlsplit(url).hostname not in {"cmr.earthdata.nasa.gov", "opendap.earthdata.nasa.gov"}:
            raise ScienceError("nasa_invalid_url", "NASA endpoint is not on the allowed HTTPS hosts", 502)
        last = None
        for attempt in range(self.config.attempts):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise ScienceError("nasa_timeout", "NASA analysis time budget exceeded; completed months remain cached", 504)
            delay = min(2**attempt * .5, 5)
            try:
                with self.limit:
                    session = self.session_provider() if authenticated else (self.public_session or requests.Session())
                    owned = not authenticated and self.public_session is None
                    try:
                        with session.get(url, params=params, timeout=(min(self.config.connect_timeout, remaining), min(self.config.read_timeout, remaining)),
                                         stream=True, verify=True) as response:
                            status = response.status_code
                            if status in [401, 403]:
                                code = "nasa_auth_required" if status == 401 else "nasa_forbidden"
                                raise ScienceError(code, f"NASA rejected authorization (HTTP {status}); no scientific result was substituted", 503)
                            if status == 429 or status in [500, 502, 503, 504]:
                                last = ScienceError("nasa_rate_limited" if status == 429 else "nasa_unavailable", f"NASA upstream returned HTTP {status}; retry later", 503)
                                retry_after = response.headers.get("Retry-After", "")
                                if retry_after.isdigit(): delay = min(float(retry_after), 10)
                            elif status == 404:
                                raise ScienceError("nasa_granule_unavailable", "NASA catalogued subset endpoint returned HTTP 404", 502)
                            elif status != 200:
                                raise ScienceError("nasa_http_error", f"Unexpected NASA HTTP status {status}", 502)
                            else:
                                final_host = urlsplit(response.url).hostname
                                if final_host == "urs.earthdata.nasa.gov":
                                    raise ScienceError("nasa_auth_required", "NASA redirected to Earthdata login", 503)
                                if final_host != urlsplit(url).hostname:
                                    raise ScienceError("nasa_redirect_error", "Unexpected final NASA response host", 502)
                                chunks, size = [], 0
                                for chunk in response.iter_content(65536):
                                    size += len(chunk)
                                    if size > self.config.max_response_bytes:
                                        raise ScienceError("nasa_response_too_large", "Subset response exceeds safety size limit; global download refused", 502)
                                    if time.monotonic() >= deadline:
                                        raise ScienceError("nasa_timeout", "NASA response exceeded analysis time budget", 504)
                                    chunks.append(chunk)
                                return b"".join(chunks)
                    finally:
                        if owned: session.close()
            except requests.exceptions.SSLError:
                raise ScienceError("nasa_tls_error", "NASA TLS certificate verification failed; verification remains enabled", 502) from None
            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
                last = ScienceError("nasa_timeout" if isinstance(exc, requests.exceptions.Timeout) else "nasa_unavailable", "NASA connection timed out or is unavailable", 504 if isinstance(exc, requests.exceptions.Timeout) else 503)
            except requests.exceptions.RequestException:
                raise ScienceError("nasa_transport_error", "NASA HTTPS request failed", 502) from None
            if attempt + 1 < self.config.attempts:
                time.sleep(min(delay, max(0, deadline-time.monotonic())))
        raise last or ScienceError("nasa_unavailable", "NASA service is unavailable", 503)
