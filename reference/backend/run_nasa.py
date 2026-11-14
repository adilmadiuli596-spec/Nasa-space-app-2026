"""Launch authenticated local verification/server; never persist Earthdata secrets."""
import argparse
import json
from pathlib import Path
import time

from earth_detective.auth import interactive_login
from earth_detective.errors import ScienceError

ROOT = Path(__file__).resolve().parent


def status(stage, **extra):
    directory = ROOT / ".cache"
    directory.mkdir(exist_ok=True)
    value = {"stage": stage, **extra}
    (directory / "3c_status.json").write_text(json.dumps(value, indent=2), encoding="utf-8")
    print(stage, extra, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--cold-benchmark", action="store_true", help="Run an isolated uncached 420-month Berlin request and its cached repeat")
    args = parser.parse_args()
    status("awaiting_local_sign_in")
    interactive_login()
    if args.cold_benchmark:
        status("authenticated_cold_benchmark")
        from earth_detective.verify3c import run_cold_benchmark
        run_cold_benchmark(status)
        return
    if args.verify:
        status("authenticated_waiting_for_adapter")
        deadline = time.monotonic() + 1800
        while not (ROOT / ".cache" / "3c-ready").exists():
            if time.monotonic() > deadline:
                raise ScienceError("setup_timeout", "Adapter setup was not completed in time", 503)
            time.sleep(1)
        from earth_detective.verify3c import run
        run(status)
    else:
        import uvicorn
        from earth_detective.main import app
        status("serving_local_nasa_backend")
        uvicorn.run(app, host="127.0.0.1", port=8000, access_log=False)


if __name__ == "__main__":
    try:
        main()
    except ScienceError as exc:
        status("failed", code=exc.code, message=exc.message)
    except (KeyboardInterrupt, EOFError):
        status("cancelled")
    except Exception as exc:
        status("failed", error_type=type(exc).__name__)
