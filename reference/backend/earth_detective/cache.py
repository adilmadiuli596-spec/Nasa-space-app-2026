"""Bounded local cache. SHA-256 detects corruption, not malicious local rewriting."""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import time

from filelock import FileLock, Timeout

from .errors import ScienceError


def canonical(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


class FileCache:
    def __init__(self, root: Path, max_bytes: int, lock_timeout: float = 180):
        self.root = root.resolve()
        self.max_bytes = max_bytes
        self.lock_timeout = lock_timeout

    def prepare(self):
        try:
            self.root.mkdir(parents=True, exist_ok=True)
            (self.root / "locks").mkdir(exist_ok=True)
        except OSError:
            raise ScienceError("cache_unavailable", "Local NASA cache is not writable", 503) from None

    @staticmethod
    def key(identity) -> str:
        return hashlib.sha256(canonical(identity)).hexdigest()

    @contextmanager
    def _lock(self, name):
        self.prepare()
        try:
            with FileLock(str(self.root / "locks" / (name + ".lock")), timeout=self.lock_timeout):
                yield
        except Timeout:
            raise ScienceError("cache_busy", "Local cache is busy; retry later", 503) from None
        except OSError:
            raise ScienceError("cache_unavailable", "Local cache operation failed", 503) from None

    def _path(self, key):
        path = self.root / (key + ".json")
        if path.is_symlink():
            raise ScienceError("cache_unsafe_path", "Cache entry must not be a symbolic link", 503)
        return path

    def _read(self, key, identity, validator, ttl):
        with self._lock("index"):
            path = self._path(key)
            if not path.exists():
                return None
            try:
                if path.stat().st_size > min(self.max_bytes, 2 * 1024**2):
                    raise ValueError("oversized")
                envelope = json.loads(path.read_bytes())
                if set(envelope) != {"schema", "identity", "created", "payload", "sha256"} or envelope["schema"] != 1:
                    raise ValueError("schema")
                if envelope["identity"] != identity or hashlib.sha256(canonical(envelope["payload"])).hexdigest() != envelope["sha256"]:
                    raise ValueError("checksum")
                if ttl is not None and time.time() - envelope["created"] > ttl:
                    raise ValueError("expired")
                payload = validator(envelope["payload"])
                os.utime(path, None)
                return payload
            except (ValueError, TypeError, KeyError, ScienceError):
                # Only this cache entry is removed, never scientific reference data.
                path.unlink(missing_ok=True)
                return None

    def _write(self, key, identity, payload):
        envelope = {"schema": 1, "identity": identity, "created": time.time(), "payload": payload,
                    "sha256": hashlib.sha256(canonical(payload)).hexdigest()}
        content = canonical(envelope)
        if len(content) > self.max_bytes:
            raise ScienceError("cache_entry_too_large", "Cache limit is smaller than one scientific entry", 503)
        with self._lock("index"):
            path = self._path(key)
            for stale in self.root.glob("*.tmp"):
                if re.fullmatch(r"[0-9a-f]{64}-.+\.tmp", stale.name) and not stale.is_symlink():
                    stale.unlink(missing_ok=True)
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(dir=self.root, prefix=key + "-", suffix=".tmp", delete=False) as handle:
                    temporary = Path(handle.name)
                    handle.write(content); handle.flush(); os.fsync(handle.fileno())
                os.replace(temporary, path)
            finally:
                if temporary is not None:
                    temporary.unlink(missing_ok=True)
            entries = [p for p in self.root.glob("*.json") if re.fullmatch(r"[0-9a-f]{64}\.json", p.name) and not p.is_symlink()]
            total = sum(p.stat().st_size for p in entries)
            for old in sorted(entries, key=lambda p: p.stat().st_mtime_ns):
                if total <= self.max_bytes:
                    break
                if old == path:
                    continue
                size = old.stat().st_size
                old.unlink(); total -= size

    def get_or_create(self, identity, producer, validator, ttl=None):
        key = self.key(identity)
        # One download per key across threads/processes. Global index lock is never held during HTTP.
        # A fixed number of stripes also bounds the number of lock files.
        with self._lock("entry-" + str(int(key[:8], 16) % 64)):
            value = self._read(key, identity, validator, ttl)
            if value is not None:
                return value, True
            value = validator(producer())
            self._write(key, identity, value)
            return value, False
