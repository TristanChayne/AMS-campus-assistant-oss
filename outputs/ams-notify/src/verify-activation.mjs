// ADMIN-BE-001: check that migrated activation data and signing material work together, printing no secrets.
//   SIGNING_KEY=… CODE_PEPPER=… node src/verify-activation.mjs [--db path] [--public-key <base64url spki>]
// - SIGNING_KEY derives the public key the apps ship with (activation-config.json publicKey)
// - every stored code cipher decrypts with CODE_PEPPER and matches its code hash
// - every bound install fingerprint has an installation
import {DatabaseSync} from 'node:sqlite';
import {createHash,createPrivateKey,createPublicKey,createDecipheriv} from 'node:crypto';

const args=process.argv.slice(2),opt=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
const db=new DatabaseSync(opt('--db')||process.env.AMS_NOTIFY_DB||'/data/ams-notify.sqlite',{readOnly:true});
const {SIGNING_KEY,CODE_PEPPER}=process.env;
const unb64=s=>Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64');
const b64url=b=>Buffer.from(b).toString('base64url');
const results=[];
const check=(name,ok,detail='')=>results.push({check:name,ok,detail});

const pub=b64url(createPublicKey(createPrivateKey({key:unb64(SIGNING_KEY),format:'der',type:'pkcs8'})).export({format:'der',type:'spki'}));
const expected=opt('--public-key');
check('signing key matches app public key',expected?pub===expected:null,expected?'':'pass --public-key to compare');

const key=createHash('sha256').update('AMS-CODE-STORAGE-1:'+CODE_PEPPER).digest();
let decrypted=0,mismatch=0,missing=0;
for(const row of db.prepare('SELECT id,code_hash,code_cipher FROM activation_codes').all()){
 if(!row.code_cipher){missing++;continue;}
 const [iv,data]=row.code_cipher.split('.').map(unb64);
 const d=createDecipheriv('aes-256-gcm',key,iv);d.setAuthTag(data.subarray(data.length-16));
 const code=Buffer.concat([d.update(data.subarray(0,data.length-16)),d.final()]).toString('utf8');
 createHash('sha256').update(CODE_PEPPER+':'+code).digest('hex')===row.code_hash?decrypted++:mismatch++;
}
check('stored codes decrypt and match hash',mismatch===0,`${decrypted} ok, ${mismatch} mismatch, ${missing} without stored code`);

let bound=0,unlinked=0;
for(const c of db.prepare('SELECT bound_devices FROM activation_codes').all())for(const fp of String(c.bound_devices||'').split('|').filter(Boolean)){
 bound++;if(!db.prepare('SELECT 1 FROM installations WHERE fingerprint=?').get(fp))unlinked++;
}
check('bound install keys have installations',unlinked===0,`${bound} bound, ${unlinked} missing`);
check('admin account present',!!db.prepare("SELECT 1 FROM admin_credentials WHERE id='owner'").get());
console.table(results);
process.exitCode=results.some(r=>r.ok===false)?1:0;
