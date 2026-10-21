// Offline Edge (Chromium) check of the Android restore page + hook. Every request is intercepted; nothing reaches the school.
// It proves browser sessionStorage semantics for the restore hand-off, not Android WebView behaviour or a real school session.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),{spawn}=require('child_process'),net=require('net'),{setTimeout:delay}=require('timers/promises');
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const template=read('work/android-school-session-restore.html'),hook=read('work/android-school-session.js');
// Same construction as SchoolSession.restoreUrl: target first, then org.json output (which escapes "/").
const javaJson=value=>JSON.stringify(value).replace(/\//g,'\\/');
const restorePage=(items,target)=>template.replace('__TARGET__',javaJson(target)).replace('__SESSION_ITEMS__',javaJson(items));
const tricky=JSON.stringify({token:'synthetic</script><script>__TARGET__ __SESSION_ITEMS__',userId:'synthetic-user'});
const pages={
 'https://ams.xjtlu.edu.cn/__campus/session-restore?n=ams':restorePage({amsuserInfo:tricky},'https://ams.xjtlu.edu.cn/studenth5/#/home'),
 'https://ams.xjtlu.edu.cn/studenth5/':'<!doctype html><title>synthetic AMS</title><p>synthetic AMS shell'
};
let socket,session,id=0,edgeProcess;const pending=new Map(),loads=[],calls=[],requests=[];
function command(method,params={}){const n=++id;return new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params,sessionId:session}));setTimeout(()=>{if(pending.has(n)){pending.delete(n);reject(new Error('CDP timeout '+method))}},10000).unref()})}
async function start(){
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ams-session-edge-'));
 edgeProcess=spawn(edge,[`--user-data-dir=${profile}`,'--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,'--remote-allow-origins=*','about:blank'],{stdio:'ignore',windowsHide:true});
 let version;for(let i=0;i<100&&!version;i++){try{version=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json()}catch{await delay(100)}}
 assert.ok(version?.webSocketDebuggerUrl,'Edge CDP endpoint did not start');
 socket=new WebSocket(version.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true})});
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);
  if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);return;}
  if(m.method==='Page.loadEventFired')loads.splice(0).forEach(f=>f());
  if(m.method==='Runtime.bindingCalled')calls.push(JSON.parse(m.params.payload));
  if(m.method==='Fetch.requestPaused'){const url=m.params.request.url;requests.push(url);const body=pages[url];
   const reply=body===undefined?command('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'})
    :command('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(body).toString('base64')});
   reply.catch(()=>{});}
 });
 const target=await command('Target.createTarget',{url:'about:blank'});session=(await command('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 await command('Runtime.addBinding',{name:'amsRecord'});
 // Stand-in for the Android @JavascriptInterface: it only records the signals the hook sends.
 await command('Page.addScriptToEvaluateOnNewDocument',{source:"window.AmsSchoolSession={changed(){amsRecord(JSON.stringify(['changed',location.hostname]))},expired(t){amsRecord(JSON.stringify(['expired',location.hostname,t]))}};"});
}
async function open(url,settledUrl){const loaded=new Promise(r=>loads.push(r));await command('Page.navigate',{url});await loaded;
 for(let i=0;i<50;i++){const href=(await evaluate('location.href'));if(href===settledUrl)return;await delay(100)}
 throw new Error('did not settle at '+settledUrl+', now '+(await evaluate('location.href')));}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;}
async function main(){
 await start();
 // AMS: restore page writes amsuserInfo, replaces itself, and the AMS shell sees the exact saved value.
 await open('https://ams.xjtlu.edu.cn/__campus/session-restore?n=ams','https://ams.xjtlu.edu.cn/studenth5/#/home');
 assert.equal(await evaluate("sessionStorage.getItem('amsuserInfo')"),tricky,'AMS session survives the same-origin replace exactly, placeholders and </script> included');
 const history=(await command('Page.getNavigationHistory')).entries.map(e=>e.url);
 assert.ok(!history.some(url=>url.includes('/__campus/session-restore')),'restore entry was replaced, not left in back history: '+history.join(', '));
 assert.equal(await evaluate("localStorage.length"),0,'nothing written to localStorage');
 await evaluate(hook);await delay(150);
 assert.deepEqual(calls.at(-1),['changed','ams.xjtlu.edu.cn']);
 await evaluate('sessionStorage.clear()');await delay(150);   // what the AMS 401 handler does
 assert.deepEqual(calls.at(-1),['expired','ams.xjtlu.edu.cn',JSON.parse(tricky).token]);
 // Requests without a fixture were failed inside the interceptor (only the browser's own favicon probes).
 const unexpected=requests.filter(url=>!(url in pages)&&!url.endsWith('/favicon.ico'));
 assert.deepEqual(unexpected,[],'every request was intercepted; none reached the network');
 fs.mkdirSync('outputs/test-0.14.1-build73-session',{recursive:true});
 fs.writeFileSync('outputs/test-0.14.1-build73-session/browser-restore-check.json',JSON.stringify({result:'PASS',evidenceType:'Offline headless Edge with all requests intercepted; synthetic tokens; not Android WebView or real school session acceptance',requests,signals:calls.map(c=>c.slice(0,2))},null,2)+'\n');
 console.log('PASS: offline Edge restore hand-off keeps the exact session through location.replace on the same origin, leaves no history entry, and the hook reports the AMS 401 clear with the held token; '+requests.length+' requests, all intercepted offline.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{try{socket?.close();edgeProcess?.kill()}catch{}});
