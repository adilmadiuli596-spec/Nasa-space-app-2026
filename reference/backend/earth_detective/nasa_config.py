import os
from dataclasses import dataclass
from pathlib import Path

from .source import PROJECT_ROOT


@dataclass(frozen=True)
class NasaConfig:
    cache_dir: Path = PROJECT_ROOT / "backend" / ".cache" / "nasa"
    cache_max_bytes: int = 128 * 1024 * 1024
    workers: int = 4
    connect_timeout: float = 10
    read_timeout: float = 45
    attempts: int = 3
    analysis_timeout: float = 1200
    catalog_ttl: float = 86400
    lock_timeout: float = 180
    max_response_bytes: int = 2 * 1024 * 1024

    def __post_init__(self):
        if not self.cache_dir.resolve().is_relative_to((PROJECT_ROOT / "backend").resolve()):
            raise ValueError("NASA cache must stay inside backend, never .data-check")
        if not 1 <= self.workers <= 8 or not 1 <= self.attempts <= 5:
            raise ValueError("Invalid worker/retry limits")
        if min(self.connect_timeout, self.read_timeout, self.analysis_timeout, self.catalog_ttl, self.lock_timeout) <= 0:
            raise ValueError("Timeouts and catalog TTL must be positive")
        if not 4096 <= self.cache_max_bytes <= 10 * 1024**3 or not 4096 <= self.max_response_bytes <= 4 * 1024**2:
            raise ValueError("Invalid cache/response size limits")

    @classmethod
    def from_env(cls):
        return cls(cache_dir=Path(os.environ.get("EARTH_NASA_CACHE_DIR", str(cls.cache_dir))),
                   cache_max_bytes=int(os.environ.get("EARTH_NASA_CACHE_BYTES", cls.cache_max_bytes)),
                   workers=int(os.environ.get("EARTH_NASA_WORKERS", cls.workers)),
                   connect_timeout=float(os.environ.get("EARTH_NASA_CONNECT_TIMEOUT", cls.connect_timeout)),
                   read_timeout=float(os.environ.get("EARTH_NASA_READ_TIMEOUT", cls.read_timeout)),
                   attempts=int(os.environ.get("EARTH_NASA_ATTEMPTS", cls.attempts)),
                   analysis_timeout=float(os.environ.get("EARTH_NASA_ANALYSIS_TIMEOUT", cls.analysis_timeout)))
