import {createHash} from 'node:crypto';

// Activation tables moved from Tencent CloudBase (rate_limits and demo_nonces are short-lived and not moved).
export const TABLES=['activation_codes','admin_credentials','service_settings','demo_codes','demo_states'];
const KEYS={activation_codes:'id',admin_credentials:'id',service_settings:'id',demo_codes:'code_id',demo_states:'id'};

// Order-independent digest of each table, used to prove export and import hold the same rows.
export function digestTables(tables){
 const out={};
 for(const t of TABLES){
  const rows=(tables[t]||[]).map(r=>Object.fromEntries(Object.keys(r).sort().map(k=>[k,r[k]===undefined?null:r[k]]))).sort((a,b)=>String(a[KEYS[t]])<String(b[KEYS[t]])?-1:1);
  out[t]={rows:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0,16)};
 }
 return out;
}
