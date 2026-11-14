# Scientific core — N2
scientificResult(request, loadedSeries) is an in-memory, server-only pipeline over already decoded observations. It validates complete monthly series, units, Gregorian weights and supplied provenance, then computes OLS/Bartlett HAC lag 3, finite-sample correction n/(n−2), Student t df=n−2, two-sided p and 95% CI. It validates the full shared output schema. No file reads, NASA network access or API integration occurs here.

Coordinates, calendar, series, units, aggregation, OLS, covariance, Student t, inference and interpretation each have one implementation. hacCovariance supports sensitivity tests; primary hacTrend is fixed at lag 3. N1 spike entrypoints are compatibility adapters to this implementation.

The core validates provenance declarations, not the authenticity of bytes decoded by a future NASA adapter. That adapter must verify product metadata, calendar, fill/scale/offset, coordinates, units and byte hashes. Python and all scientific artifacts remain preserved; POST /api/analysis still returns 503 migration_pending. N3 requires explicit approval.
