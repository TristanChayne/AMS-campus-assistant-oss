// Full generated iOS iframe with a synthetic schedule and a controlled clock.
const fs=require('fs'),assert=require('assert/strict'),{chromium}=require('playwright');
const main=fs.readFileSync('outputs/ams-ios/Assets/ams-modern-ui.js','utf8');
const doc=Array.from(main.matchAll(/"(?:[^"\\]|\\.)*"/g),m=>JSON.parse(m[0])).find(s=>s.includes('function renderSettings(screen){'));
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.AMS_TEST_BROWSER_CHANNEL?{channel:process.env.AMS_TEST_BROWSER_CHANNEL}:{})});
 try{
  const context=await browser.newContext({timezoneId:'Asia/Shanghai',viewport:{width:390,height:844}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.__testNow=Date.parse('2026-10-21T09:10:00+08:00');
   const ActualDate=Date;window.Date=class extends ActualDate{constructor(...a){super(...(a.length?a:[window.__testNow]));}static now(){return window.__testNow;}};
   const start=window.setInterval,stop=window.clearInterval;
   window.__clockTimers=new Set();window.setInterval=(fn,ms,...a)=>{const id=start(fn,ms,...a);if(ms===1000)window.__clockTimers.add(id);return id;};
   window.clearInterval=id=>{window.__clockTimers.delete(id);stop(id);};
   window.__actions=[];window.addEventListener('message',e=>{if(e.data?.amsUiAction)window.__actions.push(e.data);});
  });
  await page.route('**/*',route=>route.request().url()==='https://ams.xjtlu.edu.cn/lifecycle'?route.fulfill({contentType:'text/html',body:doc}):route.abort());
  await page.goto('https://ams.xjtlu.edu.cn/lifecycle');
  await page.evaluate(()=>postMessage({amsUiData:{route:'/home',ready:true,loading:false,days:[{date:'2026-10-21',timetableVoList:[{moduleTime:'09:00~10:00',moduleTitle:'Synthetic course',moduleCode:'SOE106TC',room:'DE-2001'}]}]}},'*'));
  await page.getByText('还有 40 分钟结束',{exact:true}).waitFor();
  await page.evaluate(()=>postMessage({iosActive:false},'*'));
  await page.waitForFunction(()=>window.__clockTimers.size===0);
  await page.evaluate(()=>{window.__testNow=Date.parse('2026-10-21T09:30:00+08:00');postMessage({iosActive:true},'*');});
  await page.getByText('还有 20 分钟结束',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__clockTimers.size),1);
  await page.evaluate(()=>{show('<p>Synthetic detail</p>');postMessage({iosActive:false},'*');});
  await page.waitForFunction(()=>window.__clockTimers.size===0);
  await page.evaluate(()=>{window.__testNow=Date.parse('2026-10-21T09:35:00+08:00');postMessage({iosActive:true},'*');});
  await page.waitForFunction(()=>window.__clockTimers.size===1);
  await page.evaluate(()=>document.getElementById('sheet').close());
  await page.getByText('还有 15 分钟结束',{exact:true}).waitFor();
  await page.evaluate(()=>{postMessage({iosActive:false},'*');});
  await page.waitForFunction(()=>window.__clockTimers.size===0);
  await page.evaluate(()=>{window.__testNow=Date.parse('2026-10-23T09:35:00+08:00');postMessage({iosActive:true},'*');});
  await page.waitForFunction(()=>document.querySelector('#focus').textContent==='');
  // UIKit owns the visible tab bar; reproduce its existing navIndex message.
  await page.evaluate(()=>postMessage({navIndex:3},'*'));
  await page.getByRole('button',{name:/FB 讨论室（SIP）/}).click();
  await page.waitForFunction(()=>window.__actions.some(e=>e.amsUiAction==='reservationService'&&e.service==='fb'));
  assert.deepEqual(errors,[]);
  console.log('PASS: complete iOS UI, 40→20→15 minutes, sheet close, two-day return, single timer and FB entry dispatch; no school traffic');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
