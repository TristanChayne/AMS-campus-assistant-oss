const fs=require('fs'),assert=require('assert'),vm=require('vm');
const {JSDOM,VirtualConsole}=require('../outputs/sports-offline-test-runtime/node_modules/jsdom');
const source=fs.readFileSync('work/sports-ui.js','utf8');
const projects=Array.from({length:16},(_,i)=>`<div class="item ${i===0?'checked':''}"><span class="service-name">项目${i+1}</span></div>`).join('');
const dates=Array.from({length:7},(_,i)=>`<button class="item ${i===0?'checked':''}"><span class="day">周${i+1}</span><span class="date">10/${13+i}</span></button>`).join('');
const slots=`<div class="item"><span>¥30.00</span><i class="iconzhengque">✓</i></div><div class="item disabled"><span>¥30.00</span></div><div class="item"><span>¥35.00</span><i class="iconzhengque">✓</i></div>`;
const html=`<!doctype html><html lang="en"><body class="lang-zh_cn">
<div class="header" style="position:fixed;top:0;height:70px"><div class="venues"><button class="item">Sports Centre(SIP)</button><button class="item">Sports Centre(TC)</button></div></div>
<div class="service-top"><div class="service-top-inner one-line"><div class="service-top-box">${projects}</div></div></div>
<div class="date-box"><div class="date-select-box"><div class="item-box">${dates}</div></div></div>
<div class="field-wrapper"><div class="time-line"><div class="item">10:00</div><div class="item">11:00</div><div class="item">12:00</div></div><div class="field-outer"><div class="field-box"><div class="item-name">1号场</div>${slots}</div></div></div>
<div class="main-body list-page"><div class="order-tab-item active">全部订单</div><div class="order-box">订单卡片</div></div>
<div class="member-page"><div class="ticket-page">我的入馆票</div></div>
<div class="order-wrapper"><h2 class="order-title">订单确认</h2><input id="agreement" type="checkbox"></div>
<div class="ticket-tips" tabindex="0">使用说明<span class="tips-detail">说明正文</span></div>
<div class="ticket-tips" tabindex="0">另一说明<span class="tips-detail">另一正文</span></div>
</body></html>`;
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(html,{url:'https://sportscentre.xipueduinno.cn/website/court',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document,wait=()=>new Promise(resolve=>setTimeout(resolve,0));
const officialHeader=d.querySelector('.header');officialHeader.getBoundingClientRect=()=>({left:0,right:390,top:0,bottom:70,width:390,height:70});
let mutationObservers=0,mutationCallbacks=0;const NativeMutationObserver=w.MutationObserver;
w.MutationObserver=class extends NativeMutationObserver{constructor(callback){mutationObservers++;super((records,observer)=>{mutationCallbacks++;callback(records,observer)})}};
Object.defineProperty(w,'innerWidth',{value:390,writable:true,configurable:true});
w.matchMedia=()=>({matches:true});w.scrollBy=()=>{};w.requestAnimationFrame=fn=>{fn();return 1};
let scrollIntoViewCalls=0;w.HTMLElement.prototype.scrollIntoView=function(){scrollIntoViewCalls++};
const rail=d.querySelector('.date-box .item-box'),dateItems=[...rail.querySelectorAll('.item')];
Object.defineProperties(rail,{clientWidth:{value:200,configurable:true},scrollWidth:{value:500,configurable:true},scrollLeft:{value:0,writable:true,configurable:true}});
rail.getBoundingClientRect=()=>({left:0,right:200,width:200,top:0,bottom:60,height:60});
dateItems[0].getBoundingClientRect=()=>({left:300,right:350,width:50,top:0,bottom:60,height:60});
vm.runInContext(source,dom.getInternalVMContext());
assert.equal(mutationObservers,1,'one MutationObserver is installed');
vm.runInContext(source,dom.getInternalVMContext());
assert.equal(mutationObservers,1,'reinjection is idempotent');

(async()=>{
  const projectItems=()=>[...d.querySelectorAll('.service-top-box .item')];
  let toggle=d.getElementById('ams-project-toggle');
  assert(toggle);assert.equal(toggle.textContent,'展开全部 16 项');assert.equal(toggle.getAttribute('aria-expanded'),'false');
  assert.equal(d.documentElement.lang,'en');assert(d.body.classList.contains('lang-zh_cn'));
  assert.equal(d.getElementById('ams-grid-hint').textContent,'每行对应时段，每列对应场地；左右滑动查看更多场地，点击可选价格选择。','official body language wins over the generic html lang');
  assert.equal(d.querySelector('.main-body.list-page').style.getPropertyValue('--ams-order-header-offset'),'70px','fixed official header is measured for the order list');
  assert.equal(d.querySelector('.member-page').getAttribute('data-ams-ticket-page'),'true');
  assert.equal(projectItems().slice(0,8).some(n=>n.hasAttribute('data-ams-project-collapsed')),false);
  assert(projectItems().slice(8).every(n=>n.getAttribute('data-ams-project-collapsed')==='true'));
  assert.equal(rail.scrollLeft,150,'initial selected date is revealed by scrolling only the date rail');
  assert(rail.parentElement.classList.contains('ams-has-more-dates'));
  assert.equal(scrollIntoViewCalls,0,'date enhancement never scrolls the whole page');assert.equal(w.scrollY,0);
  let projectClicks=0;projectItems()[0].addEventListener('click',()=>projectClicks++);
  projectItems()[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  assert.equal(projectClicks,1,'non-native project control simulates one click');
  const spaceKey=new w.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true});projectItems()[0].dispatchEvent(spaceKey);
  assert.equal(projectClicks,2,'Space simulates one click');
  projectItems()[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',repeat:true,bubbles:true,cancelable:true}));
  assert.equal(projectClicks,2,'held keyboard key does not repeat a click');
  assert.equal(projectItems()[0].classList.contains('checked'),true,'click delegation does not replace the official class');

  let toggleClicks=0;toggle.addEventListener('click',()=>toggleClicks++);
  toggle.click();await wait();toggle=d.getElementById('ams-project-toggle');
  assert.equal(toggleClicks,1,'project toggle handler is not duplicated');
  assert.equal(toggle.textContent,'收起项目');assert.equal(toggle.getAttribute('aria-expanded'),'true');
  assert(projectItems().every(n=>!n.hasAttribute('data-ams-project-collapsed')));
  Object.defineProperties(rail,{clientWidth:{value:200,configurable:true},scrollWidth:{value:500,configurable:true},scrollLeft:{value:0,writable:true,configurable:true}});
  dateItems[6].getBoundingClientRect=()=>({left:450,right:500,width:50,top:0,bottom:60,height:60});
  const previousRailScroll=rail.scrollLeft;dateItems[0].classList.remove('checked');dateItems[6].classList.add('checked');await wait();
  assert(rail.scrollLeft>previousRailScroll,'selection change scrolls the rail when the new date is outside it');
  assert.equal(rail.scrollLeft,300,'the rail clamps to its maximum scroll offset');
  assert.equal(scrollIntoViewCalls,0);assert.equal(w.scrollY,0);
  assert.equal(toggle.getAttribute('aria-expanded'),'true','project expansion survives date updates');
  assert.equal(rail.parentElement.classList.contains('ams-has-more-dates'),false,'no date overflow hint remains at the end of the rail');
  const nativeClicks=[];dateItems[6].addEventListener('click',()=>nativeClicks.push('click'));
  const keyEvent=new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});dateItems[6].dispatchEvent(keyEvent);
  assert.equal(keyEvent.defaultPrevented,false,'native button keyboard behavior is left to the browser');
  dateItems[6].click();assert.equal(nativeClicks.length,1,'native button activation is not doubled by the helper');

  const available=d.querySelectorAll('.field-box .item:not(.disabled)'),selected=available[0],unavailable=d.querySelector('.field-box .item.disabled'),selectedTwo=available[1];
  assert.equal(selected.getAttribute('aria-label'),'1号场 · 10:00 · ¥30.00');
  assert.equal(unavailable.getAttribute('aria-disabled'),'true');assert.equal(unavailable.getAttribute('tabindex'),'-1');
  assert.equal(unavailable.getAttribute('aria-label'),'1号场 · 11:00 · 不可选');
  const review=d.getElementById('ams-selection-review');assert(review.hidden);
  let unavailableClicks=0;unavailable.addEventListener('click',()=>unavailableClicks++);
  unavailable.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  assert.equal(unavailableClicks,0,'disabled slot cannot be activated by keyboard');
  selected.classList.add('checked');await wait();assert.equal(review.hidden,false);assert(review.textContent.includes('已选 1 个时段'));
  assert(selected.getAttribute('aria-label').includes('已选 ¥30.00'),'selected slot label retains the displayed price');
  assert.equal(d.getElementById('agreement').checked,false,'review action does not consent');
  d.querySelector('.order-wrapper').scrollIntoView=()=>{d.querySelector('.order-wrapper').dataset.scrolled='true'};
  review.click();assert.equal(d.querySelector('.order-wrapper').dataset.scrolled,'true');
  selectedTwo.classList.add('checked');await wait();assert(review.textContent.includes('已选 2 个时段'));
  selected.classList.remove('checked');await wait();assert(review.textContent.includes('已选 1 个时段'));
  selectedTwo.classList.remove('checked');await wait();assert.equal(review.hidden,true);
  selected.classList.add('checked');await wait();d.querySelector('.order-wrapper').remove();await wait();
  assert.equal(review.hidden,true,'review entry hides without an order confirmation region');

  projectItems()[0].classList.remove('checked');projectItems()[9].classList.add('checked');await wait();
  assert.equal(toggle.textContent,'所选项目需保持展开','deep selected project explains why it cannot collapse');
  assert.equal(toggle.disabled,true);assert.equal(toggle.getAttribute('aria-disabled'),'true');
  assert.equal(toggle.getAttribute('aria-expanded'),'true');assert(!projectItems()[9].hasAttribute('data-ams-project-collapsed'));
  projectItems()[9].classList.remove('checked');projectItems()[2].classList.add('checked');await wait();
  assert.equal(toggle.textContent,'展开全部 16 项','switching back to a visible project recomputes to the collapsed state');
  assert.equal(toggle.disabled,false);toggle.click();await wait();assert.equal(toggle.textContent,'收起项目');
  d.querySelector('.venues .item').click();await wait();assert.equal(toggle.getAttribute('aria-expanded'),'false','switching campus resets the project expansion state');
  toggle.click();await wait();assert.equal(toggle.getAttribute('aria-expanded'),'true');
  dateItems[6].classList.remove('checked');dateItems[1].classList.add('checked');await wait();
  assert.equal(toggle.getAttribute('aria-expanded'),'true','user expansion survives date updates');
  dateItems[1].classList.remove('checked');dateItems[2].classList.add('checked');await wait();
  assert.equal(toggle.getAttribute('aria-expanded'),'true','user expansion persists across date changes');

  const firstTip=d.querySelector('.ticket-tips'),secondTip=d.querySelectorAll('.ticket-tips')[1];
  firstTip.click();await wait();assert.equal(firstTip.getAttribute('aria-expanded'),'true');
  secondTip.click();await wait();assert.equal(firstTip.getAttribute('aria-expanded'),'false');assert.equal(secondTip.getAttribute('aria-expanded'),'true');
  const escape=new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});secondTip.dispatchEvent(escape);await wait();
  assert.equal(secondTip.classList.contains('ams-open'),false);assert.equal(secondTip.getAttribute('aria-expanded'),'false');
  let tipClicks=0;firstTip.addEventListener('click',()=>tipClicks++);
  const enterTip=new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});firstTip.dispatchEvent(enterTip);await wait();
  assert.equal(tipClicks,1);assert.equal(firstTip.getAttribute('aria-expanded'),'true');assert(enterTip.defaultPrevented);
  firstTip.dispatchEvent(new w.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}));await wait();
  assert.equal(tipClicks,2);assert.equal(firstTip.getAttribute('aria-expanded'),'false');
  firstTip.dispatchEvent(new w.KeyboardEvent('keydown',{key:' ',repeat:true,bubbles:true,cancelable:true}));await wait();
  assert.equal(tipClicks,2,'repeated disclosure key does not click twice');
  const dateScrollBeforeProjectUpdate=rail.scrollLeft,before=projectItems().length;d.querySelector('.service-top-box').insertAdjacentHTML('beforeend','<div class="item"><span class="service-name">项目17</span></div><div class="item"><span class="service-name">项目18</span></div>');await wait();
  toggle=d.getElementById('ams-project-toggle');assert.equal(projectItems().length,before+2);assert.equal(toggle.textContent,'收起项目','official list re-render keeps the current expanded state');
  assert.equal(rail.scrollLeft,dateScrollBeforeProjectUpdate,'unrelated DOM updates do not recenter the selected date');
  toggle.click();await wait();assert.equal(toggle.textContent,'展开全部 18 项');

  vm.runInContext(source,dom.getInternalVMContext());
  assert.equal(d.querySelectorAll('#ams-project-toggle').length,1);assert.equal(d.querySelectorAll('#ams-selection-review').length,1);
  assert.equal(mutationObservers,1,'repeated reinjection does not install another observer');
  assert.equal(w.localStorage.length,0);assert(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|__vue__|addJavascriptInterface/.test(source));
  assert.equal(fs.readFileSync('outputs/ams-android/app/src/main/assets/sports-ui.js','utf8').replace(/\r\n/g,'\n'),source.replace(/\r\n/g,'\n'));
  await new Promise(resolve=>setTimeout(resolve,30));const stableCallbacks=mutationCallbacks;await new Promise(resolve=>setTimeout(resolve,60));
  assert.equal(mutationCallbacks,stableCallbacks,'MutationObserver reaches a quiet fixed point');
  d.querySelector('.ticket-page').remove();await wait();assert.equal(d.querySelector('.member-page').getAttribute('data-ams-ticket-page'),'false','ticket-only chrome follows official route DOM updates');
  assert.equal(errors.length,0,errors.join('\n'));
  d.querySelector('.header').style.position='static';w.dispatchEvent(new w.Event('resize'));await wait();assert.equal(d.querySelector('.main-body.list-page').style.getPropertyValue('--ams-order-header-offset'),'0px','normal-flow header does not add a duplicate order offset');
  d.querySelector('.header').style.position='fixed';w.dispatchEvent(new w.Event('resize'));await wait();assert.equal(d.querySelector('.main-body.list-page').style.getPropertyValue('--ams-order-header-offset'),'70px','fixed-header offset is restored after layout changes');
  console.log('PASS official DOM clipping fixture, fold/count/deep selection/campus/rerender, Chinese page-language detection, fixed-header order offset; date rail and keyboard single-click; slots, disabled semantics, tickets, idempotence, and no business/session access.');
  dom.window.close();
})().catch(e=>{dom.window.close();console.error(e);process.exitCode=1});
