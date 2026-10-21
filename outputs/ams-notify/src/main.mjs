import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {openDb} from './db.mjs';
import {Apns} from './apns.mjs';
import {startHost} from './host.mjs';

const env=process.env;
// Activation worker sources: copied to ../activation in the image, shared from ams-activation-tencent in the repo.
const here=dirname(fileURLToPath(import.meta.url));
const activationDir=[join(here,'../activation'),join(here,'../../ams-activation-tencent/src')].find(d=>existsSync(join(d,'worker.mjs')));
const schemaPath=[join(here,'../activation/schema.sql'),join(here,'../../ams-activation-tencent/schema.sql')].find(existsSync);
const worker=await import(pathToFileURL(join(activationDir,'worker.mjs')));
const {iosPublicConfig}=await import(pathToFileURL(join(activationDir,'ios-public-config.mjs')));

const dbPath=env.AMS_NOTIFY_DB||'/data/ams-notify.sqlite';
mkdirSync(dirname(dbPath),{recursive:true});
const store=openDb(dbPath);
store.db.exec(readFileSync(schemaPath,'utf8'));
const apns=new Apns({keyPath:env.APNS_KEY_PATH,keyId:env.APNS_KEY_ID,teamId:env.APNS_TEAM_ID});
const allowedBundles=(env.AMS_BUNDLE_IDS||'cn.xjtlu.ams.ios').split(',').map(s=>s.trim()).filter(Boolean);
const secrets={SIGNING_KEY:env.SIGNING_KEY,CODE_PEPPER:env.CODE_PEPPER,SESSION_SECRET:env.SESSION_SECRET};
const port=Number(env.PORT||8080);
const app=startHost({
 port,db:store.db,store,apns,worker,secrets,allowedBundles,
 origin:env.AMS_PUBLIC_ORIGIN||'https://ams.tristanchayne.com',
 proxyKey:env.AMS_PROXY_KEY||'',
 validateIosRelease:release=>iosPublicConfig(JSON.stringify({schemaVersion:1,release,announcement:null})).release,
 backupDir:env.AMS_NOTIFY_BACKUP_DIR||join(dirname(dbPath),'backup')
});
const activationReady=Object.values(secrets).every(Boolean);
console.log(`ams service on :${port}; activation ${activationReady?'ready':'NOT configured (activation/admin return 503)'}; apns ${apns.configured?'configured':'NOT configured'}; bundles ${allowedBundles.join(',')}`);
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{app.stop();process.exit(0);});
