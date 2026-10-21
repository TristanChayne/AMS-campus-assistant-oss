BEGIN;
ALTER TABLE ams_license.activation_codes ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ams_license.activation_codes ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ams_license.activation_codes ADD COLUMN IF NOT EXISTS bound_devices TEXT NOT NULL DEFAULT '|';
ALTER TABLE ams_license.activation_codes ADD COLUMN IF NOT EXISTS code_cipher TEXT;
UPDATE ams_license.activation_codes SET used_count=1,bound_devices='|' || device || '|' WHERE device IS NOT NULL AND bound_devices='|' AND used_count=0;
COMMIT;