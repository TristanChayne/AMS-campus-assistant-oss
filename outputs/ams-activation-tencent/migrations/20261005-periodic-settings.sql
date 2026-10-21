CREATE TABLE IF NOT EXISTS ams_license.service_settings (
 id TEXT PRIMARY KEY, interval_days INTEGER NOT NULL DEFAULT 7,
 version_code INTEGER NOT NULL DEFAULT 31, version_name TEXT NOT NULL DEFAULT '0.12.7',
 download_url TEXT NOT NULL DEFAULT 'https://www.pgyer.com/amsxiaoyuanzhushou',
 release_notes TEXT NOT NULL DEFAULT ''
);
INSERT INTO ams_license.service_settings(id) VALUES ('global') ON CONFLICT(id) DO NOTHING;
