-- Tool call persistence table for analytics
CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  request_params TEXT NOT NULL,
  response_data TEXT NOT NULL,
  is_error INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_calls_created_at ON tool_calls(created_at);
