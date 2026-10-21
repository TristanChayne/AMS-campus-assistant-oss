// ADMIN-BE-001: read-only export of the Tencent CloudBase activation database (ams_license schema) for the
// move to the self-hosted AMS service. Uses the logged-in CloudBase CLI session (run `tcb env list` first to
// refresh it). Writes the rows to a private file OUTSIDE the repository and prints only counts and digests.
//   node work/export-activation-tencent.mjs [outDir]
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {digestTables,TABLES} from '../outputs/ams-notify/src/activation-dump.mjs';

const CloudBase=createRequire('E:/DevTools/CloudbaseTools/')('@cloudbase/manager-node');
const ENV_ID='ams-activation-d7gv2f67vbfbacb39';
const outDir=process.argv[2]||'E:/DevTools/Cache/AmsActivationSecrets/migration';
const auth=JSON.parse(readFileSync(join(homedir(),'.config/.cloudbase/auth.json'),'utf8')).credential;
if(!auth?.tmpSecretId||auth.tmpExpired<Date.now())throw Error('CloudBase CLI credential expired: run `tcb env list` first');
const app=CloudBase.init({envId:ENV_ID,region:'ap-shanghai',secretId:auth.tmpSecretId,secretKey:auth.tmpSecretKey,token:auth.tmpToken});

async function rows(table){
 const r=await app.database.executePGSql({Sql:`SELECT * FROM ams_license.${table}`});
 return (r.Rows||[]).map(row=>{const values=JSON.parse(row);return Object.fromEntries(r.Columns.map((c,i)=>[c,['int2','int4','int8'].includes(r.ColumnTypes?.[i])&&values[i]!==null?Number(values[i]):values[i]]));});
}
const dump={source:ENV_ID,exportedAt:new Date().toISOString(),tables:{}};
for(const t of TABLES)dump.tables[t]=await rows(t);
mkdirSync(outDir,{recursive:true});
const file=join(outDir,`activation-export-${dump.exportedAt.replace(/[:.]/g,'-')}.json`);
writeFileSync(file,JSON.stringify(dump),{mode:0o600});
console.log('written',file);
console.table(digestTables(dump.tables));
