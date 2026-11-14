# N3 bounded cache

Default: per-process MemoryCache, 16 MiB LRU by encoded payload size, catalog TTL 6 h and decoded single-cell months TTL 30 d. Keys include dataset/version, requested cell indices, catalog granule/updated identity and decoder revision. Values are revalidated against the requested cell/granule on every read. No credential or ready-made scientific answer is cached.

Optional local `EARTH_CACHE=file`: atomic, hashed envelopes in the fixed project `.cache/nasa-n3`, maximum 64 MiB JSON entries. Invalid/corrupt/unavailable cache reads become misses. The cache is an optimization, not scientific evidence or authenticated storage. It is ignored by Git and Vercel. Do not rely on it to survive function execution or span Vercel instances.

On Vercel the file backend is disabled; only bounded disposable RAM can be reused in a warm instance. Public dynamic Earthdata remains blocked pending permission; the explicitly limited two-cell demo uses bundled raw scientific snapshots and recomputes all statistics. No persistent `/tmp`, paid storage or required database.
