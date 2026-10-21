import fs from 'node:fs';import {passwordHash,b64} from '../outputs/ams-activation-tencent/src/worker.mjs';
const s=JSON.parse(fs.readFileSync('E:/DevTools/Cache/AmsActivationSecrets/secrets.json','utf8'));
const salt=b64(crypto.getRandomValues(new Uint8Array(16))),hash=await passwordHash(s.ADMIN_PASSWORD,salt);
const quote=x=>"'"+x.replaceAll("'","''")+"'";
fs.writeFileSync('work/admin-credentials-migration.sql',`CREATE TABLE IF NOT EXISTS ams_license.admin_credentials(id TEXT PRIMARY KEY,username TEXT NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1); INSERT INTO ams_license.admin_credentials(id,username,password_hash,salt) VALUES ('owner','2689232641@qq.com',${quote(hash)},${quote(salt)}) ON CONFLICT(id) DO NOTHING;`);
console.log('Prepared hashed credential migration; existing account will not be overwritten.');
