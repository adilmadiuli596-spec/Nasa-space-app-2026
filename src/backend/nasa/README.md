# NASA adapter N3

`NasaSource.load` discovers M2TMNXSLV 5.12.4 months in CMR, fetches bounded GES DISC Cloud OPeNDAP DAP4 `.dap.nc4` subsets, decodes in HDF5 MEMFS, validates and produces shared LoadedSeries. Scientific calculations remain exclusively in backend/science.

Default runtime mode is blocked. `EARTH_MODE=local` only supports the loopback launch scripts; Vercel forces this mode to blocked regardless of a token. `EARTH_MODE=demo` is a separate, explicit two-cell real-data demonstration. No silent local/reference fallback is allowed after NASA failures.

Token configuration: `EARTHDATA_TOKEN` in the server process. User-approved local `.env` is supported by Next; it is ignored by Git/Vercel and must never enter review archives. Alternatively `npm run nasa:local` accepts hidden input without persisting a token. Changes in `.env` require restarting the local server. No password exchange, cookie/netrc discovery, browser token or user-account system is implemented.

JWT exp only hints at early expiry. NASA determines token authenticity. 401/403 produce safe errors and latch rejection until token rotation; tokens are not refreshed using saved passwords. All redirects are refused, TLS verification stays enabled, arbitrary client URLs are rejected.

Budgets: 270 s source deadline, 20 s request attempts, 3 tries, at most 4 network operations per process and 2 distinct analysis jobs; identical cell/period consumers coalesce. These limits do not prove Vercel deployment readiness or unlimited global throughput.
