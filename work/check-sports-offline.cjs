// Test dependency: npm install --prefix outputs/sports-offline-test-runtime --no-audit --no-fund jsdom@30.1.2
const fs=require('fs'),path=require('path'),assert=require('assert');
const {JSDOM,VirtualConsole}=require('../outputs/sports-offline-test-runtime/node_modules/jsdom');
const out=process.argv[2]?path.resolve(process.argv[2]):path.resolve('outputs/sports-offline-gpt'),html=fs.readFileSync(path.join(out,'index.html'),'utf8');
const errors=[],virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));
let networkAttempts=0;
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole,
  beforeParse(w){
    w.matchMedia=()=>({matches:true});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){this.dataset.scrolled='true'};
    w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
    w.confirm=()=>true;w.fetch=()=>{networkAttempts++;throw Error('Network forbidden')};
    w.XMLHttpRequest=class{constructor(){networkAttempts++;throw Error('Network forbidden')}};
  }});
const w=dom.window,d=w.document,q=s=>d.querySelector(s),all=s=>[...d.querySelectorAll(s)],pause=()=>new Promise(r=>setTimeout(r,30));
const click=async(s)=>{assert(q(s),s);q(s).click();await pause()};
const change=async(s,value)=>{const n=q(s);assert(n,s);n.value=value;n.dispatchEvent(new w.Event('change',{bubbles:true}));await pause()};
const agree=async()=>{q('#agreement').checked=true;q('#agreement').dispatchEvent(new w.Event('change',{bubbles:true}));await pause()};
const tests=[];
(async()=>{
  await pause();
  assert.equal(all('.service-top-box .item').length,16);assert.equal(all('.date-select-box .item').length,7);assert.equal(all('.field-box .item').length,66);
  assert.equal(q('[data-action=submit]').disabled,true);assert.equal(q('#agreement').checked,false);
  await click('.field-box .item:not(:disabled)');assert.equal(all('.field-box .item.checked').length,1);assert(q('#ams-selection-review').textContent.includes('1 个时段'));
  const selected=q('.field-box .item.checked');assert.equal(selected.getAttribute('aria-pressed'),'true');
  await click('#ams-selection-review');assert.equal(q('.order-wrapper').dataset.scrolled,'true');
  await click('.field-box .item.checked');assert.equal(all('.field-box .item.checked').length,0);assert(q('#ams-selection-review').hidden);
  await click('.field-box .item.disabled');assert.equal(all('.field-box .item.checked').length,0);
  const keyboard=q('.field-box .item:not(:disabled)');let nativeClickCount=0;keyboard.addEventListener('click',()=>nativeClickCount++);
  const enter=new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});keyboard.dispatchEvent(enter);
  assert.equal(enter.defaultPrevented,false);assert(nativeClickCount<=1,'native button is not synthetically activated twice');
  if(nativeClickCount===0)keyboard.click();await pause();assert.equal(nativeClickCount,1,'native Enter/default activation has one click');assert.equal(all('.field-box .item.checked').length,1);
  await click('[data-action=date][data-value="1"]');assert.equal(all('.field-box .item.checked').length,0);assert.equal(q('#agreement').checked,false);
  tests.push('16 projects, 7 days, 66 slots; selection/cancel/disabled/keyboard; review scroll; filter reset; explicit consent');
  await click('.field-box .item:not(:disabled)');await agree();assert.equal(q('[data-action=submit]').disabled,false);await click('[data-action=submit]');
  assert(q('#screen').textContent.includes('DEMO-2000'));assert(q('#screen').textContent.includes('确认与支付'));
  await click('[data-action=method][data-value=wechat]');await click('[data-action=launch]');assert(q('#modal').open);assert(q('#modal').textContent.includes('不生成支付参数'));await click('[data-action=dismiss]');
  await click('[data-action=pending]');assert(q('#screen').textContent.includes('确认与支付'));
  await click('[data-action=payError]');assert(q('#modal').textContent.includes('保留原订单'));await click('[data-action=dismiss]');
  await click('[data-action=success]');assert(q('#screen').textContent.includes('已支付'));await click('[data-action=code]');assert(q('.demo-code').textContent.includes('非二维码'));assert.equal(all('canvas,img').length,0);await click('[data-action=dismiss]');
  await click('[data-route=orders]');assert.equal(all('.order-box').length,5);await click('[data-action=filter][data-value="已支付"]');assert.equal(all('.order-box').length,2);
  await click('[data-action=refund]');assert.equal(all('.order-box').length,1);await click('[data-action=filter][data-value="待支付"]');await click('[data-action=cancel]');assert.equal(all('.order-box').length,0);
  tests.push('Local order creation, payment explanation, cancellation return, query-error retention, mock success, invalid text credential; list filters, mock cancel/refund');
  await click('[data-route=tickets]');assert.equal(all('.ticket-container .ticket-box').length,3);await click('[data-action=ticketFilter][data-value="已过期"]');assert.equal(all('.ticket-container .ticket-box').length,1);
  await click('[data-route=court]');await change('input[name=mode][value=ticket]','ticket');assert.equal(all('.ticket-box .item').length,3);await change('#quantity','2');assert(q('.order-choose').textContent.includes('× 2'));await agree();await click('[data-action=submit]');assert(q('#screen').textContent.includes('DEMO-2001'));
  await click('[data-route=court]');await change('input[name=mode][value=club]','club');await agree();assert(q('[data-action=submit]').disabled);await change('#club-name','演示社团训练');assert(!q('[data-action=submit]').disabled);await change('#club-end','17:00');assert(q('[data-action=submit]').disabled);await change('#club-end','19:00');await click('[data-action=submit]');assert(q('#screen').textContent.includes('DEMO-2002'));
  tests.push('Ticket filters/purchase quantity; activity-form required name and chronological validation; unique demo IDs');
  await click('[data-action=reset]');await click('[data-action=login]');assert(q('#screen').textContent.includes('请先登录'));assert.equal(all('input[type=password]').length,0);await click('[data-action=login]');
  for(const scenario of ['empty','loading','error']){await change('#scenario',scenario);assert.equal(all('.field-box').length,0);assert(q('.empty-state'))}
  await click('[data-action=normal]');await change('input[name=mode][value=field]','field');assert.equal(all('.field-box').length,6);
  for(let i=0;i<9;i++){await change('#palette',String(i));for(const a of ['light','dark']){await change('#appearance',a);assert(q('html').style.getPropertyValue('--campus-ink').startsWith('#'));assert(q('html').style.getPropertyValue('--campus-primary').startsWith('#'))}}
  // Use a fresh DOM instance to verify restored seeds, without browser navigation.
  const restored=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole,beforeParse(w){w.matchMedia=()=>({matches:true});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{}}});
  restored.window.document.querySelector('[data-route=orders]').click();assert.equal(restored.window.document.querySelectorAll('.order-box').length,4);restored.window.close();
  tests.push('No credential input; empty/loading/error/retry; 9 palettes x 2 appearances; fresh load restores seeds');
  assert.equal(networkAttempts,0);assert.equal(errors.length,0,errors.join('\n'));
  assert(!/\b(fetch|XMLHttpRequest|localStorage|sessionStorage)\b/.test(fs.readFileSync('work/sports-offline.js','utf8')));
  assert(!/<(?:script[^>]*src|link[^>]*href|img[^>]*src)/i.test(html));assert(html.includes("connect-src 'none'"));
  for(const n of ['sports-theme.css','sports-ui.js'])assert.equal(fs.readFileSync(path.join(out,'assets',n),'utf8'),fs.readFileSync(path.join('work',n),'utf8'));
  const report={date:'2026-10-12',reference:'Android 0.14.1 build 73',result:'PASS',method:'Local jsdom DOM/event checks; separate Edge report covers rendered layout and screenshots',tests,networkAttempts,scriptErrors:errors,limits:['DOM checks do not prove rendered browser or Android layout','Android WebView, system fonts, insets, lifecycle, and real payment remain unverified','No real authentication, order, payment, QR or entry test']};
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));w.close();console.log(JSON.stringify(report,null,2));
})().catch(e=>{w.close();console.error(e);process.exitCode=1});
