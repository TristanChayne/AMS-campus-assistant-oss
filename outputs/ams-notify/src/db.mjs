import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {DEFAULT_PREFS,normalizePrefs,planEvents,syncEvent} from './schedule.mjs';

const SCHEMA=`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS devices(
 id TEXT PRIMARY KEY,
 secret_hash TEXT NOT NULL,
 platform TEXT NOT NULL,
 bundle_id TEXT NOT NULL,
 apns_env TEXT NOT NULL,
 start_token TEXT,
 consent_at INTEGER NOT NULL,
 last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS prefs(
 device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
 json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS courses(
 device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
 key TEXT NOT NULL,
 json TEXT NOT NULL,
 end_ms INTEGER NOT NULL,
 PRIMARY KEY(device_id,key)
);
CREATE TABLE IF NOT EXISTS activities(
 device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
 chain TEXT NOT NULL,
 update_token TEXT,
 local INTEGER NOT NULL DEFAULT 0,
 ended INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(device_id,chain)
);
CREATE TABLE IF NOT EXISTS events(
 device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
 key TEXT NOT NULL,
 chain TEXT NOT NULL,
 kind TEXT NOT NULL,
 due INTEGER NOT NULL,
 json TEXT NOT NULL,
 sent_at INTEGER,
 status TEXT,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_try INTEGER,
 PRIMARY KEY(device_id,key)
);
CREATE INDEX IF NOT EXISTS events_due ON events(due) WHERE sent_at IS NULL;
`;

export function openDb(path){
 const db=new DatabaseSync(path);
 db.exec(SCHEMA);
 // Databases created before retry support.
 const columns=db.prepare('PRAGMA table_info(events)').all().map(c=>c.name);
 if(!columns.includes('attempts'))db.exec('ALTER TABLE events ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0');
 if(!columns.includes('next_try'))db.exec('ALTER TABLE events ADD COLUMN next_try INTEGER');
 // ADMIN-BE-001: link to the app installation, snapshot metadata and the ordinary notification token.
 const deviceColumns=db.prepare('PRAGMA table_info(devices)').all().map(c=>c.name);
 for(const [name,type] of [['installation_id','TEXT'],['timetable_at','INTEGER'],['coverage_until','TEXT'],['alert_token','TEXT']])
  if(!deviceColumns.includes(name))db.exec(`ALTER TABLE devices ADD COLUMN ${name} ${type}`);
 // Account name at send time, so push records show who it was for even after an account switch.
 if(!db.prepare('PRAGMA table_info(events)').all().some(c=>c.name==='account_name'))db.exec('ALTER TABLE events ADD COLUMN account_name TEXT');
 return new Store(db);
}

export class Store{
 constructor(db){this.db=db;}
 tx(fn){
  this.db.exec('BEGIN');
  try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 device(id){return this.db.prepare('SELECT * FROM devices WHERE id=?').get(id);}
 createDevice(d){
  this.db.prepare('INSERT INTO devices(id,secret_hash,platform,bundle_id,apns_env,consent_at,last_seen) VALUES(?,?,?,?,?,?,?)').run(d.id,d.secretHash,d.platform,d.bundleId,d.apnsEnv,d.now,d.now);
 }
 updateDevice(id,fields){
  const keys=Object.keys(fields);
  if(!keys.length)return;
  this.db.prepare(`UPDATE devices SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`).run(...keys.map(k=>fields[k]),id);
 }
 deleteDevice(id){this.db.prepare('DELETE FROM devices WHERE id=?').run(id);}
 // One reminder registration per app installation: an older registration of the same install is replaced.
 linkInstallation(id,installationId){
  this.db.prepare('DELETE FROM devices WHERE installation_id=? AND id<>?').run(installationId,id);
  this.db.prepare('UPDATE devices SET installation_id=? WHERE id=?').run(installationId,id);
 }
 prefs(id){
  const row=this.db.prepare('SELECT json FROM prefs WHERE device_id=?').get(id);
  return row?normalizePrefs(JSON.parse(row.json)):{...DEFAULT_PREFS};
 }
 setPrefs(id,prefs){this.db.prepare('INSERT INTO prefs(device_id,json) VALUES(?,?) ON CONFLICT(device_id) DO UPDATE SET json=excluded.json').run(id,JSON.stringify(prefs));}
 courses(id){return this.db.prepare('SELECT json FROM courses WHERE device_id=?').all(id).map(r=>JSON.parse(r.json));}
 replaceCourses(id,courses){
  this.db.prepare('DELETE FROM courses WHERE device_id=?').run(id);
  const ins=this.db.prepare('INSERT OR REPLACE INTO courses(device_id,key,json,end_ms) VALUES(?,?,?,?)');
  for(const c of courses)ins.run(id,c.key,JSON.stringify(c),c.endMs);
 }
 activities(id){return this.db.prepare('SELECT * FROM activities WHERE device_id=?').all(id);}
 activity(id,chain){return this.db.prepare('SELECT * FROM activities WHERE device_id=? AND chain=?').get(id,chain);}
 upsertActivity(id,chain,fields,now){
  const cur=this.activity(id,chain)||{update_token:null,local:0,ended:0};
  const next={...cur,...fields};
  this.db.prepare('INSERT INTO activities(device_id,chain,update_token,local,ended,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(device_id,chain) DO UPDATE SET update_token=excluded.update_token,local=excluded.local,ended=excluded.ended,updated_at=excluded.updated_at').run(id,chain,next.update_token,next.local?1:0,next.ended?1:0,now);
 }
 // Rebuilds unsent events; already-sent keys are kept so nothing is pushed twice.
 replan(id,now){
  const acts=this.activities(id);
  const events=planEvents(this.courses(id),this.prefs(id),now,{endedChains:acts.filter(a=>a.ended).map(a=>a.chain),localChains:acts.filter(a=>a.local).map(a=>a.chain)});
  this.db.prepare('DELETE FROM events WHERE device_id=? AND sent_at IS NULL').run(id);
  const ins=this.db.prepare('INSERT OR IGNORE INTO events(device_id,key,chain,kind,due,json) VALUES(?,?,?,?,?,?)');
  for(const e of events)ins.run(id,e.key,e.chain,e.kind,e.due,JSON.stringify(e));
  return events.length;
 }
 dueEvents(now,graceMs,limit=200){
  return this.db.prepare(`SELECT e.*,d.start_token,d.bundle_id,d.apns_env,d.installation_id,a.update_token,a.local
   FROM events e JOIN devices d ON d.id=e.device_id LEFT JOIN activities a ON a.device_id=e.device_id AND a.chain=e.chain
   WHERE e.sent_at IS NULL AND e.due<=? AND e.due>=? AND (e.next_try IS NULL OR e.next_try<=?) ORDER BY e.due LIMIT ?`).all(now,now-graceMs,now,limit);
 }
 noteAccount(id,key,name){this.db.prepare('UPDATE events SET account_name=? WHERE device_id=? AND key=?').run(name??null,id,key);}
 markSent(id,key,status,now){this.db.prepare('UPDATE events SET sent_at=?,status=? WHERE device_id=? AND key=?').run(now,status,id,key);}
 markRetry(id,key,status,nextTry){this.db.prepare('UPDATE events SET status=?,attempts=attempts+1,next_try=? WHERE device_id=? AND key=?').run(status,nextTry,id,key);}
 // A later update or the end of the same chain is already due: an older update would show a stale state.
 superseded(row,now){
  // Also when a (late) start was sent after this boundary: it already carried the newer state.
  return !!this.db.prepare("SELECT 1 FROM events WHERE device_id=? AND chain=? AND key<>? AND ((kind<>'start' AND due>? AND due<=?) OR (kind='start' AND status='sent' AND sent_at>=?)) LIMIT 1").get(row.device_id,row.chain,row.key,row.due,now,row.due);
 }
 startSent(id,chain){return !!this.db.prepare("SELECT 1 FROM events WHERE device_id=? AND chain=? AND kind='start' AND status='sent' LIMIT 1").get(id,chain);}
 // Queue the chain's current state now (e.g. its update token arrived after a boundary passed).
 queueSync(id,chain,now){
  const e=syncEvent(this.courses(id),this.prefs(id),chain,now);
  if(!e)return false;
  this.db.prepare("DELETE FROM events WHERE device_id=? AND chain=? AND kind='update' AND sent_at IS NULL AND due<=?").run(id,chain,now);
  this.db.prepare('INSERT OR IGNORE INTO events(device_id,key,chain,kind,due,json) VALUES(?,?,?,?,?,?)').run(id,e.key,e.chain,e.kind,e.due,JSON.stringify(e));
  return true;
 }
 // Fresh state for a start that is sent after later boundaries already passed.
 currentState(id,chain,now){return syncEvent(this.courses(id),this.prefs(id),chain,now);}
 cleanup(now){
  const day=86400e3;
  this.db.prepare('DELETE FROM courses WHERE end_ms<?').run(now-day);
  this.db.prepare('DELETE FROM events WHERE due<?').run(now-2*day);
  this.db.prepare('DELETE FROM activities WHERE updated_at<?').run(now-2*day);
  this.db.prepare('DELETE FROM devices WHERE last_seen<?').run(now-30*day);
 }
 // Daily consistent copy (VACUUM INTO), keeping the newest `keep` files.
 backup(dir,now,keep=7){
  const name=`ams-notify-${new Date(now+8*3600e3).toISOString().slice(0,10)}.sqlite`,path=join(dir,name);
  mkdirSync(dir,{recursive:true});
  if(existsSync(path))return false;
  this.db.prepare('VACUUM INTO ?').run(path);
  for(const f of readdirSync(dir).filter(f=>/^ams-notify-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort().slice(0,-keep))rmSync(join(dir,f));
  return true;
 }
 counts(){
  const n=t=>this.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  return {devices:n('devices'),courses:n('courses'),pending:this.db.prepare('SELECT COUNT(*) AS n FROM events WHERE sent_at IS NULL').get().n};
 }
}
