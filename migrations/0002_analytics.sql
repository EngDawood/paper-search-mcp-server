-- Deep analytics for the paper-search MCP server. Additive only: tool_calls (0001) is untouched.
-- Timestamps are ISO-8601 UTC strings (same convention as tool_calls.created_at).

-- One row per tool call. A JSON-RPC batch shares one request_id.
CREATE TABLE IF NOT EXISTS invocations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  request_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  args_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  error_message TEXT,
  duration_ms INTEGER,
  result_count INTEGER,
  response_bytes INTEGER,
  user_agent TEXT,
  mcp_protocol_version TEXT,
  client_name TEXT,
  client_version TEXT,
  country TEXT,
  colo TEXT,
  asn INTEGER
);
CREATE INDEX IF NOT EXISTS idx_invocations_created_at ON invocations(created_at);
CREATE INDEX IF NOT EXISTS idx_invocations_tool_created ON invocations(tool, created_at);
CREATE INDEX IF NOT EXISTS idx_invocations_status_created ON invocations(status, created_at);
CREATE INDEX IF NOT EXISTS idx_invocations_request_id ON invocations(request_id);
CREATE INDEX IF NOT EXISTS idx_invocations_client ON invocations(client_name);

-- MCP `initialize` requests. Stateless mode only sees clientInfo here, never on tools/call.
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  request_id TEXT NOT NULL,
  client_name TEXT,
  client_version TEXT,
  protocol_version TEXT,
  capabilities_json TEXT,
  user_agent TEXT,
  country TEXT,
  colo TEXT,
  asn INTEGER
);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(client_name, client_version);

-- One row per upstream HTTP request made during an invocation (cache hits included).
CREATE TABLE IF NOT EXISTS source_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invocation_id TEXT NOT NULL REFERENCES invocations(id),
  created_at TEXT NOT NULL,
  source TEXT,
  host TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT,
  http_status INTEGER,
  ok INTEGER NOT NULL,
  duration_ms INTEGER,
  attempts INTEGER NOT NULL DEFAULT 1,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  response_bytes INTEGER,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_source_calls_invocation ON source_calls(invocation_id);
CREATE INDEX IF NOT EXISTS idx_source_calls_created_at ON source_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_source_calls_source_created ON source_calls(source, created_at);
CREATE INDEX IF NOT EXISTS idx_source_calls_host_created ON source_calls(host, created_at);

-- One row per search-type invocation (args had a `query` string).
CREATE TABLE IF NOT EXISTS queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invocation_id TEXT NOT NULL REFERENCES invocations(id),
  created_at TEXT NOT NULL,
  tool TEXT NOT NULL,
  query_text TEXT NOT NULL,
  query_normalized TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('ar', 'en', 'mixed', 'other')),
  sources_requested TEXT,
  filters_json TEXT,
  result_count INTEGER
);
CREATE INDEX IF NOT EXISTS idx_queries_invocation ON queries(invocation_id);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON queries(created_at);
CREATE INDEX IF NOT EXISTS idx_queries_normalized ON queries(query_normalized);
CREATE INDEX IF NOT EXISTS idx_queries_language_created ON queries(language, created_at);

-- Top 10 papers returned by each search.
CREATE TABLE IF NOT EXISTS query_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invocation_id TEXT NOT NULL REFERENCES invocations(id),
  rank INTEGER NOT NULL,
  source TEXT,
  paper_id TEXT,
  doi TEXT,
  title TEXT,
  year INTEGER
);
CREATE INDEX IF NOT EXISTS idx_query_results_invocation ON query_results(invocation_id);
CREATE INDEX IF NOT EXISTS idx_query_results_doi ON query_results(doi);
CREATE INDEX IF NOT EXISTS idx_query_results_source ON query_results(source);

-- Views for stats
CREATE VIEW IF NOT EXISTS v_daily_tool_stats AS
SELECT
  substr(created_at, 1, 10) AS day,
  tool,
  COUNT(*) AS calls,
  SUM(status = 'error') AS errors,
  ROUND(100.0 * SUM(status = 'error') / COUNT(*), 2) AS error_pct,
  ROUND(AVG(duration_ms), 1) AS avg_ms,
  MAX(duration_ms) AS max_ms,
  SUM(COALESCE(result_count, 0)) AS results
FROM invocations
GROUP BY day, tool;

CREATE VIEW IF NOT EXISTS v_daily_source_stats AS
SELECT
  substr(created_at, 1, 10) AS day,
  COALESCE(source, host) AS source,
  host,
  COUNT(*) AS calls,
  SUM(ok = 0) AS errors,
  ROUND(100.0 * SUM(ok = 0) / COUNT(*), 2) AS error_pct,
  SUM(cache_hit) AS cache_hits,
  SUM(MAX(attempts - 1, 0)) AS retries,
  ROUND(AVG(CASE WHEN cache_hit = 0 THEN duration_ms END), 1) AS avg_ms,
  MAX(duration_ms) AS max_ms
FROM source_calls
GROUP BY day, COALESCE(source, host), host;

CREATE VIEW IF NOT EXISTS v_source_stats AS
SELECT
  COALESCE(source, host) AS source,
  host,
  COUNT(*) AS calls,
  SUM(ok = 0) AS errors,
  ROUND(100.0 * SUM(ok = 0) / COUNT(*), 2) AS error_pct,
  SUM(cache_hit) AS cache_hits,
  ROUND(AVG(CASE WHEN cache_hit = 0 THEN duration_ms END), 1) AS avg_ms,
  MAX(duration_ms) AS max_ms
FROM source_calls
GROUP BY COALESCE(source, host), host;

CREATE VIEW IF NOT EXISTS v_top_queries AS
SELECT
  query_normalized,
  language,
  COUNT(*) AS searches,
  ROUND(AVG(result_count), 1) AS avg_results,
  MAX(created_at) AS last_seen
FROM queries
GROUP BY query_normalized, language;
