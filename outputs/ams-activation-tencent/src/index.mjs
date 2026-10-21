import worker from './worker.mjs';
import CloudBase from 'E:/DevTools/CloudbaseTools/node_modules/@cloudbase/manager-node/lib/index.js';
import fs from 'node:fs';
const origin='https://ams-activation-d7gv2f67vbfbacb39-1500641748.ap-shanghai.app.tcloudbase.com';
const assets=JSON.parse(fs.readFileSync(new URL('./assets.json',import.meta.url),'utf8'));
function literal(value){if(value===null)return 'NULL';if(typeof value==='number'&&Number.isFinite(value))return String(value);if(typeof value!=='string')throw Error('Invalid SQL value');return "'"+value.replace(/'/g,"''")+"'";}
export function statement(sql,args){let i=0;sql=sql.replace(/\b(activation_codes|rate_limits|admin_credentials|service_settings|demo_codes|demo_states|demo_nonces)\b/g,'ams_license.$1').replace(/\?/g,()=>literal(args[i++]));if(i!==args.length)throw Error('SQL argument mismatch');return sql;}
let app;
function database(){return app ||= CloudBase.init({envId:process.env.TCB_ENV,region:'ap-shanghai',secretId:process.env.TENCENTCLOUD_SECRETID,secretKey:process.env.TENCENTCLOUD_SECRETKEY,token:process.env.TENCENTCLOUD_SESSIONTOKEN});}
async function query(sql,args){const result=await database().database.executePGSql({Sql:(/\bRETURNING\b/i.test(sql)?'WITH changed AS ('+statement(sql,args)+') SELECT * FROM changed':statement(sql,args))});return {rows:(result.Rows||[]).map(row=>{const values=JSON.parse(row);return Object.fromEntries(result.Columns.map((col,i)=>[col,(['int2','int4','int8'].includes(result.ColumnTypes?.[i])&&values[i]!==null?Number(values[i]):values[i])]));}),changes:result.RowsAffected||result.AffectedRows||0};}
const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return (await query(sql,args)).rows[0]||null;},async all(){return {results:(await query(sql,args)).rows};},async run(){const result=await query(sql,args);return {meta:{changes:result.changes}};}};}};
export async function main(event){
 
 const headers=new Headers(event.headers||{});
 // Gateway overwrites the connection source; never trust client-supplied CF IP.
 headers.set('CF-Connecting-IP',event.requestContext?.sourceIp||event.requestContext?.identity?.sourceIp||'unknown');
 const method=event.httpMethod||event.requestContext?.httpMethod||'GET';
 let path=event.path||'/';
 const req=new Request(origin+path,{method,headers,...(['GET','HEAD'].includes(method)?{}:{body:event.isBase64Encoded?Buffer.from(event.body||'','base64'):event.body||''})});
 const env={...process.env,DB,ASSETS:{async fetch(request){const path=new URL(request.url).pathname;const content=assets[path];return new Response(content||'',{status:content?200:404,headers:{'Content-Type':path.endsWith('.js')?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'}});}}};
 const response=await worker.fetch(req,env);
 if(response.status===503)console.error('Activation request failed',path);
 return {statusCode:response.status,headers:Object.fromEntries(response.headers),body:await response.text(),isBase64Encoded:false};
}


