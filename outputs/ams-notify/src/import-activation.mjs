// ADMIN-BE-001: import an activation export (work/export-activation-tencent.mjs) into the service database.
//   node src/import-activation.mjs <export.json> [--db /data/ams-notify.sqlite] [--replace] [--delta]
// Refuses to touch existing activation rows unless --replace (full overwrite) or --delta (insert rows that are
// missing and update codes whose activation state moved on; for the cutover window). Prints counts and digests only.
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {openDb} from './db.mjs';
import {Registry,migrateRegistry} from './registry.mjs';
import {TABLES,digestTables} from './activation-dump.mjs';

export function importActivation(db,dump,{mode='empty',now=Date.now()}={}){
 migrateRegistry(db);
 const registry=new Registry(db);
 const count=t=>db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
 if(mode==='empty'&&(count('activation_codes')||count('admin_credentials')))throw Error('activation tables are not empty: use --replace or --delta');
 const columns=t=>db.prepare(`PRAGMA table_info(${t})`).all().map(c=>c.name);
 const stats={installations:0};
 registry.tx(()=>{
  for(const t of TABLES){
   const cols=columns(t),rows=dump.tables[t]||[];
   if(mode==='replace')db.prepare(`DELETE FROM ${t}`).run();
   for(const row of rows){
    const keys=cols.filter(c=>c in row);
    const verb=mode==='empty'?'INSERT':t==='activation_codes'&&mode==='delta'?'INSERT OR REPLACE':mode==='delta'?'INSERT OR IGNORE':'INSERT OR REPLACE';
    // service_settings 'global' already exists from schema.sql defaults: always take the exported values.
    db.prepare(`${t==='service_settings'?'INSERT OR REPLACE':verb} INTO ${t}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>row[k]));
   }
  }
  // Every install key bound to a code becomes an installation (idempotent), so devices show up before they check in.
  for(const c of db.prepare('SELECT id,device,issued,bound_devices FROM activation_codes').all()){
   for(const fp of String(c.bound_devices||'').split('|').filter(Boolean)){
    const had=registry.installationByFingerprint(fp);
    registry.claim({fingerprint:fp,codeId:c.id,now});
    if(!had)stats.installations++;
   }
  }
 });
 const tables=Object.fromEntries(TABLES.map(t=>[t,db.prepare(`SELECT * FROM ${t}`).all()]));
 return {digest:digestTables(tables),...stats};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const args=process.argv.slice(2),file=args.find(a=>!a.startsWith('--')&&args[args.indexOf(a)-1]!=='--db');
 const dbPath=args.includes('--db')?args[args.indexOf('--db')+1]:process.env.AMS_NOTIFY_DB||'/data/ams-notify.sqlite';
 const mode=args.includes('--replace')?'replace':args.includes('--delta')?'delta':'empty';
 const dump=JSON.parse(readFileSync(file,'utf8'));
 const store=openDb(dbPath);
 const here=dirname(fileURLToPath(import.meta.url));
 const schema=[join(here,'../activation/schema.sql'),join(here,'../../ams-activation-tencent/schema.sql')].find(existsSync);
 store.db.exec(readFileSync(schema,'utf8'));
 console.log('export digest');console.table(digestTables(dump.tables));
 const r=importActivation(store.db,dump,{mode});
 console.log(`imported (${mode}); new installations: ${r.installations}`);console.table(r.digest);
}
