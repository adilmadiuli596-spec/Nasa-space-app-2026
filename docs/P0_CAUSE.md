# P0 — confirmed production cause

Before changes, live /api/health returned mode=blocked, dynamic_nasa_enabled=false and public_access_blocked. configFromEnv defaults to blocked; local is forcibly blocked when VERCEL is set. createAnalysisService rejects blocked mode with public_access_unconfirmed (503). App.ready allows only demo or authorized local MERRA-2; therefore Analyze is disabled. This intentionally protected private Earthdata access, but there was no public data adapter. NASA POWER is a separate no-token source; the Earthdata public restriction must stay in place.
