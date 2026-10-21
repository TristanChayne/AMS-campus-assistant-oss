CREATE TABLE IF NOT EXISTS activation_codes (
 id TEXT PRIMARY KEY, code_hash TEXT NOT NULL UNIQUE, note TEXT NOT NULL DEFAULT '',
 enabled INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL,
 device TEXT, issued INTEGER, max_uses INTEGER NOT NULL DEFAULT 1,
 used_count INTEGER NOT NULL DEFAULT 0, bound_devices TEXT NOT NULL DEFAULT '|', code_cipher TEXT
);
CREATE TABLE IF NOT EXISTS rate_limits (
 key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(expires);
CREATE TABLE IF NOT EXISTS admin_credentials (
 id TEXT PRIMARY KEY, username TEXT NOT NULL, password_hash TEXT NOT NULL,
 salt TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS service_settings (
 id TEXT PRIMARY KEY, interval_days INTEGER NOT NULL DEFAULT 7,
 version_code INTEGER NOT NULL DEFAULT 31, version_name TEXT NOT NULL DEFAULT '0.12.7',
 download_url TEXT NOT NULL DEFAULT 'https://www.pgyer.com/amsxiaoyuanzhushou',
 release_notes TEXT NOT NULL DEFAULT ''
);
INSERT INTO service_settings(id) VALUES ('global') ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS demo_codes (code_id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS demo_states (
 id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_nonces (id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
