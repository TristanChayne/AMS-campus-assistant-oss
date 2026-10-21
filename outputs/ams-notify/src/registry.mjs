import {randomBytes} from 'node:crypto';

// ADMIN-BE-001: installations (one per app install key), announcements, push messages and Apple release info.
// Lives in the same SQLite file as the activation tables and the course reminder tables.
const SCHEMA=`
CREATE TABLE IF NOT EXISTS installations(
 id TEXT PRIMARY KEY,
 fingerprint TEXT NOT NULL UNIQUE,
 code_id TEXT,
 platform TEXT,
 model TEXT,
 app_version TEXT,
 bundle_id TEXT,
 enabled INTEGER NOT NULL DEFAULT 1,
 test INTEGER NOT NULL DEFAULT 0,
 protocol INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 activated_at INTEGER,
 checked_at INTEGER,
 state_changed_at INTEGER,
 account_name TEXT,
 account_revision INTEGER NOT NULL DEFAULT 0,
 account_updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS installations_code ON installations(code_id);
CREATE TABLE IF NOT EXISTS announcements(
 id TEXT PRIMARY KEY,
 revision INTEGER NOT NULL DEFAULT 1,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 platform TEXT NOT NULL,
 status TEXT NOT NULL,
 publish_at INTEGER,
 expires_at INTEGER,
 important INTEGER NOT NULL DEFAULT 0,
 url TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 published_at INTEGER,
 withdrawn_at INTEGER
);
CREATE TABLE IF NOT EXISTS messages(
 id TEXT PRIMARY KEY,
 revision INTEGER NOT NULL DEFAULT 1,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 platform TEXT NOT NULL,
 audience TEXT NOT NULL,
 status TEXT NOT NULL,
 schedule_at INTEGER,
 expires_at INTEGER,
 url TEXT,
 announcement_id TEXT,
 reason TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 submitted_at INTEGER
);
CREATE TABLE IF NOT EXISTS message_deliveries(
 message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
 installation_id TEXT NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
 status TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_try INTEGER,
 reason TEXT,
 retryable INTEGER NOT NULL DEFAULT 0,
 at INTEGER NOT NULL,
 account_name TEXT,
 PRIMARY KEY(message_id,installation_id)
);
CREATE INDEX IF NOT EXISTS message_deliveries_queue ON message_deliveries(status,next_try);
CREATE TABLE IF NOT EXISTS submissions(
 key TEXT PRIMARY KEY,
 target TEXT NOT NULL,
 status INTEGER NOT NULL,
 body TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings_kv(
 key TEXT PRIMARY KEY,
 json TEXT NOT NULL
);
`;

const CROCKFORD='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function newInstallationId(){
 const b=randomBytes(10);let bits=0,value=0,out='';
 for(const byte of b){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=CROCKFORD[(value>>>(bits-5))&31];bits-=5;}}
 return `AMSD-${out.slice(0,4)}-${out.slice(4,8)}-${out.slice(8,12)}`;
}
export const newId=prefix=>`${prefix}-${randomBytes(9).toString('base64url')}`;
// Second precision: Swift's JSONDecoder .iso8601 rejects fractional seconds.
export const iso=ms=>ms==null?null:new Date(ms).toISOString().replace(/\.\d{3}Z$/,'Z');

export function migrateRegistry(db){
 db.exec(SCHEMA);
 const has=(t,c)=>db.prepare(`PRAGMA table_info(${t})`).all().some(x=>x.name===c);
 // D-021: the AMS message push token belongs to the app installation (reported with every per-open check).
 for(const [c,t] of [['alert_token','TEXT'],['apns_env','TEXT'],['inbox_supported','INTEGER NOT NULL DEFAULT 0']])if(!has('installations',c))db.exec(`ALTER TABLE installations ADD COLUMN ${c} ${t}`);
 // Draft creation is idempotent per editing session (clientRequestId), so a lost response never duplicates a draft.
 for(const t of ['announcements','messages'])if(!has(t,'client_request_id'))db.exec(`ALTER TABLE ${t} ADD COLUMN client_request_id TEXT`);
 db.exec('CREATE UNIQUE INDEX IF NOT EXISTS announcements_client_request ON announcements(client_request_id) WHERE client_request_id IS NOT NULL');
 db.exec('CREATE UNIQUE INDEX IF NOT EXISTS messages_client_request ON messages(client_request_id) WHERE client_request_id IS NOT NULL');
}

const DEVICE_SECRET_FIELDS=new Set(['secret_hash','start_token','alert_token']);

export class Registry{
 constructor(db){this.db=db;}
 q(sql){return this.db.prepare(sql);}
 tx(fn){this.db.exec('BEGIN');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}

 // ---- installations
 installation(id){return this.q('SELECT * FROM installations WHERE id=?').get(id);}
 installationByFingerprint(fp){return this.q('SELECT * FROM installations WHERE fingerprint=?').get(fp);}
 code(id){return id?this.q('SELECT id,note,enabled,issued,bound_devices FROM activation_codes WHERE id=?').get(id):null;}
 // Idempotent claim by install key fingerprint; the grant presented names its code record, so the latest valid grant wins.
 // activatedAt is only known for activations seen by this service (the grant's issued time is shared by the whole code).
 claim({fingerprint,codeId,activatedAt=null,now,fields={}}){
  let row=this.installationByFingerprint(fingerprint);
  if(!row){
   const id=newInstallationId();
   this.q('INSERT INTO installations(id,fingerprint,code_id,created_at,activated_at) VALUES(?,?,?,?,?)').run(id,fingerprint,codeId||null,now,activatedAt);
   row=this.installation(id);
  }
  const set={...fields};
  if(codeId&&row.code_id!==codeId)set.code_id=codeId;
  if(activatedAt&&!row.activated_at)set.activated_at=activatedAt;
  const keys=Object.keys(set);
  if(keys.length)this.q(`UPDATE installations SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`).run(...keys.map(k=>set[k]),row.id);
  return this.installation(row.id);
 }
 effective(row){
  const code=this.code(row.code_id);
  const codeEnabled=code?Number(code.enabled)===1:null;
  return {code,codeEnabled,deviceEnabled:Number(row.enabled)===1,enabled:Number(row.enabled)===1&&codeEnabled!==false};
 }
 // Account sync: newer revisions win; a late request carrying an older revision never overwrites.
 applyAccount(row,{name,revision},now){
  if(!Number.isInteger(revision)||revision<0)return row;
  if(revision<row.account_revision)return row;
  if(revision===row.account_revision&&(row.account_name??null)===(name??null))return row;
  if(revision===row.account_revision&&row.account_updated_at)return row;
  this.q('UPDATE installations SET account_name=?,account_revision=?,account_updated_at=? WHERE id=?').run(name??null,revision,now,row.id);
  // Switch or logout: the previous account's uploaded timetable, pending reminders and activity state go with it.
  if((row.account_name??null)!==(name??null))this.clearReminderData(row.id);
  return this.installation(row.id);
 }
 clearReminderData(installationId){
  for(const d of this.q('SELECT id FROM devices WHERE installation_id=?').all(installationId)){
   this.q('DELETE FROM courses WHERE device_id=?').run(d.id);
   this.q('DELETE FROM events WHERE device_id=? AND sent_at IS NULL').run(d.id);
   this.q('DELETE FROM activities WHERE device_id=?').run(d.id);
   this.q('UPDATE devices SET timetable_at=NULL,coverage_until=NULL WHERE id=?').run(d.id);
  }
 }
 setInstallation(id,{enabled,test},now){
  const row=this.installation(id);if(!row)return null;
  if(typeof enabled==='boolean'&&(Number(row.enabled)===1)!==enabled)this.q('UPDATE installations SET enabled=?,state_changed_at=? WHERE id=?').run(enabled?1:0,now,id);
  if(typeof test==='boolean')this.q('UPDATE installations SET test=? WHERE id=?').run(test?1:0,id);
  return this.installation(id);
 }
 // Hooks handed to the activation worker (self-hosted runtime only).
 hooks(now=()=>Date.now()){
  return {
   disabled:fingerprint=>{const row=this.installationByFingerprint(fingerprint);return !!row&&Number(row.enabled)!==1;},
   activated:({fingerprint,codeId})=>{const t=now();this.claim({fingerprint,codeId,activatedAt:t,now:t});},
   checked:({fingerprint,codeId})=>{
    const t=now(),row=this.claim({fingerprint,codeId,now:t,fields:{checked_at:t}});
    if(row.protocol<1)this.q('UPDATE installations SET protocol=1 WHERE id=?').run(row.id);
    return Number(row.enabled)===1;
   }
  };
 }
 // A course reminder device may be used for pushes only while its installation is effectively enabled.
 deviceAllowed(device){
  if(!device?.installation_id)return false;
  const row=this.installation(device.installation_id);
  return !!row&&this.effective(row).enabled;
 }

 // ---- admin device view (installations plus reminder registrations not yet linked to one)
 deviceRows(now){
  const installs=this.q('SELECT * FROM installations').all();
  const notify=this.q('SELECT * FROM devices').all();
  const byInstall=new Map(notify.filter(d=>d.installation_id).map(d=>[d.installation_id,d]));
  const linked=new Set(installs.map(i=>i.id));
  const rows=installs.map(i=>this.deviceView(i,byInstall.get(i.id),now));
  for(const d of notify)if(!d.installation_id||!linked.has(d.installation_id))rows.push(this.deviceView(null,d,now));
  return rows.sort((a,b)=>(b._seen||0)-(a._seen||0));
 }
 deviceView(inst,notify,now){
  const eff=inst?this.effective(inst):null;
  // legacy_pending: reminder registration without a verified installation; unbound: the code record no longer exists.
  const state=!inst?'legacy_pending':!eff.enabled?'disabled':eff.code?'active':'unbound';
  const pending=notify?this.q('SELECT COUNT(*) AS n FROM events WHERE device_id=? AND sent_at IS NULL').get(notify.id).n:0;
  const courseCount=notify?this.q('SELECT COUNT(*) AS n FROM courses WHERE device_id=?').get(notify.id).n:0;
  const prefsRow=notify?this.q('SELECT json FROM prefs WHERE device_id=?').get(notify.id):null;
  const prefs=prefsRow?JSON.parse(prefsRow.json):null;
  const seen=Math.max(inst?.checked_at||0,notify?.last_seen||0)||null;
  return {
   id:inst?inst.id:notify.id,
   accountName:inst?.account_name??null,
   platform:inst?.platform||notify?.platform||null,
   model:inst?.model??null,
   appVersion:inst?.app_version??null,
   bundleId:inst?.bundle_id||notify?.bundle_id||null,
   apnsEnv:inst?.apns_env??notify?.apns_env??null,
   lastSeenAt:iso(seen),
   accountUpdatedAt:iso(inst?.account_updated_at),
   accountRevision:inst?.account_revision??0,
   activation:{
    codeId:inst?.code_id??null,
    note:eff?.code?.note??null,
    state,
    codeEnabled:eff?eff.codeEnabled:null,
    deviceEnabled:inst?Number(inst.enabled)===1:true,
    activatedAt:iso(inst?.activated_at),
    checkedAt:iso(inst?.checked_at),
    protocol:inst?(inst.protocol===2?'per_open':inst.protocol===1?'periodic':'not_seen'):null
   },
   test:inst?Number(inst.test)===1:false,
   reminder:notify?{registered:true,deviceId:notify.id,consentAt:iso(notify.consent_at)}:null,
   timetableUpdatedAt:iso(notify?.timetable_at),
   courseCount,
   pendingCount:pending,
   coverageUntil:notify?.coverage_until??null,
   tokenState:notify?.start_token?'ready':'missing',
   alertTokenState:inst?.alert_token?'ready':'missing',
   prefs:prefs?{enabled:prefs.enabled!==false,leadMin:prefs.leadMin??15,merge:prefs.merge!==false}:{enabled:false,leadMin:15,merge:true},
   _seen:seen,_notify:notify?.id??null,_install:inst?.id??null
  };
 }
 findDevice(id,now){
  const inst=this.installation(id);
  if(inst)return this.deviceView(inst,this.q('SELECT * FROM devices WHERE installation_id=?').get(inst.id),now);
  const notify=this.q('SELECT * FROM devices WHERE id=?').get(id);
  if(!notify)return null;
  const owner=notify.installation_id&&this.installation(notify.installation_id);
  return owner?this.deviceView(owner,notify,now):this.deviceView(null,notify,now);
 }

 // ---- announcements
 announcementsDue(now){this.q("UPDATE announcements SET status='published',published_at=publish_at WHERE status='scheduled' AND publish_at<=?").run(now);}
 announcement(id){return this.q('SELECT * FROM announcements WHERE id=?').get(id);}
 announcements(){return this.q('SELECT * FROM announcements ORDER BY updated_at DESC').all();}
 // Active for a platform: published, started, not expired. Newest first.
 activeAnnouncements(platform,now){
  this.announcementsDue(now);
  return this.q("SELECT * FROM announcements WHERE status='published' AND (publish_at IS NULL OR publish_at<=?) AND (expires_at IS NULL OR expires_at>?) AND (platform='all' OR platform=?) ORDER BY COALESCE(published_at,updated_at) DESC").all(now,now,platform);
 }

 // ---- settings (Apple release metadata)
 kv(key){const r=this.q('SELECT json FROM settings_kv WHERE key=?').get(key);return r?JSON.parse(r.json):null;}
 setKv(key,value){this.q('INSERT INTO settings_kv(key,json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json').run(key,JSON.stringify(value));}

 // Public client view of an announcement. The id changes with each revision so an edited
 // announcement is shown again; withdrawing removes it from the next check.
 static publicAnnouncement(a){
  const out={id:`${a.id}.${a.revision}`,title:a.title,message:a.body,publishedAt:iso(a.published_at||a.publish_at||a.updated_at)};
  if(a.important)out.important=true;
  if(a.expires_at)out.expiresAt=iso(a.expires_at);
  if(a.url)out.url=a.url;
  return out;
 }
 // The legacy iOS public configuration (single announcement, independent Apple release).
 iosPublicConfig(now){
  const [a]=this.activeAnnouncements('ios',now);
  return {schemaVersion:1,announcement:a?Registry.publicAnnouncement(a):null,release:this.kv('ios_release')};
 }

 // ---- idempotent submissions
 submission(key){return this.q('SELECT * FROM submissions WHERE key=?').get(key);}
 saveSubmission(key,target,status,body,now){this.q('INSERT OR IGNORE INTO submissions(key,target,status,body,created_at) VALUES(?,?,?,?,?)').run(key,target,status,JSON.stringify(body),now);}
 cleanup(now){
  this.q('DELETE FROM submissions WHERE created_at<?').run(now-7*86400e3);
  this.q("DELETE FROM message_deliveries WHERE status IN ('accepted','failed','expired','read') AND at<?").run(now-30*86400e3);
 }
}

export function stripSecrets(row){return Object.fromEntries(Object.entries(row).filter(([k])=>!DEVICE_SECRET_FIELDS.has(k)));}
