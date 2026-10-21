const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert'),{pathToFileURL}=require('url');
const {chromium}=require('playwright');
const root=process.cwd(),out=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'outputs/sports-offline-gpt'),screenDir=path.join(out,'screenshots');
const html=pathToFileURL(path.join(out,'index.html')).href,themes=['blue','green','dusk','teal','sage','smoke','graphite','rose','wheat'];
const visual={date:'2026-10-12',reference:'Android 0.14.1 build 73',result:'PASS',method:'Local Edge browser rendering of the self-contained offline demo; synthetic data only',browser:'Microsoft Edge headless via Playwright',viewportChecks:[],firstScreenStateChecks:[],themeChecks:[],textScaleChecks:[],screenshots:[],networkAttempts:0,pageErrors:[],limits:['Offline browser results do not prove Android WebView/device behavior','No real authentication, order, payment, refund, QR or entry test']};
fs.mkdirSync(screenDir,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function main(){
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await context.route('**/*',route=>{const protocol=new URL(route.request().url()).protocol;if(protocol==='file:'||protocol==='data:')return route.continue();visual.networkAttempts++;return route.abort()});
  const page=await context.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(10000);
  page.on('pageerror',e=>visual.pageErrors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))visual.networkAttempts++});page.on('dialog',d=>d.accept());
  const wait=()=>page.waitForTimeout(100);
  const shot=async(name,fullPage=false)=>{const p=path.join(screenDir,name);await page.screenshot({path:p,fullPage,animations:'disabled'});visual.screenshots.push({file:`screenshots/${name}`,sha256:hash(p),bytes:fs.statSync(p).size,width:await page.evaluate(()=>innerWidth)})};
  const metrics=()=>page.evaluate(()=>{const grid=document.querySelector('.field-outer'),rail=document.querySelector('.date-box .item-box'),project=document.querySelector('.service-top-box .item'),date=document.querySelector('.date-select-box .item');return{viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,pageScrollY:window.scrollY,projectDisplay:getComputedStyle(document.querySelector('.service-top-box')).display,projectColumns:getComputedStyle(document.querySelector('.service-top-box')).gridTemplateColumns.split(' ').length,firstProjectHeight:project?.getBoundingClientRect().height,dateDisplay:getComputedStyle(rail).display,dateWidth:date?.getBoundingClientRect().width,dateHeight:date?.getBoundingClientRect().height,dateClientWidth:rail?.clientWidth,dateScrollWidth:rail?.scrollWidth,courtClientWidth:grid?.clientWidth,courtScrollWidth:grid?.scrollWidth}});
  const noOverflow=async(stage)=>{const m=await metrics();assert(m.documentWidth<=m.viewport+1,`${stage}: root width ${m.documentWidth}>${m.viewport}`);assert(m.bodyWidth<=m.viewport+1,`${stage}: body width ${m.bodyWidth}>${m.viewport}`);return m};
  const load=async()=>{await page.goto(html);await page.waitForSelector('.field-wrapper');await wait();assert.equal(await page.evaluate(()=>window.scrollY),0,'date enhancement must not scroll the page vertically on load')};
  await load();visual.cssRuleCount=await page.evaluate(()=>[...document.styleSheets].reduce((n,s)=>{try{return n+s.cssRules.length}catch{return n}},0));assert(visual.cssRuleCount>100);
  for(const width of [320,360,375,390,412,430,768]){
    await page.setViewportSize({width,height:width===320?640:width===768?900:844});await wait();const m=await noOverflow(`viewport ${width}`);
    assert.equal(m.pageScrollY,0,`viewport ${width}: selected date stays within its horizontal rail`);
    assert.equal(m.projectDisplay,'grid');assert.equal(m.projectColumns,width<768?4:8);assert(m.firstProjectHeight>=(width<768?48:44));
    if(width<768){assert.equal(m.dateDisplay,'flex');assert(m.dateWidth>=48&&m.dateWidth<=56);assert(m.dateHeight>=60);assert(m.dateScrollWidth>m.dateClientWidth)}
    else{assert(m.dateWidth>=72);assert(m.courtScrollWidth<=m.courtClientWidth+1)}
    if(width<768)assert(m.courtScrollWidth>m.courtClientWidth);
    visual.viewportChecks.push({...m,projectToggleVisible:await page.locator('#ams-project-toggle').isVisible()});
    if(width===320)await shot('booking-320.png');if(width===390)await shot('booking-390.png');
  }
  await page.setViewportSize({width:390,height:844});await load();
  assert.equal(await page.locator('.service-top-box .item').count(),16);
  const toggle=page.locator('#ams-project-toggle');assert.equal(await toggle.innerText(),'展开全部 16 项');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('.service-top-box .item[data-ams-project-collapsed="true"]').count(),8);
  await toggle.focus();const focus=await toggle.evaluate(e=>({style:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth}));assert.equal(focus.style,'solid');assert(parseFloat(focus.width)>=2);
  await page.keyboard.press('Enter');await wait();assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.equal(await page.locator('.service-top-box .item[data-ams-project-collapsed="true"]').count(),0);await shot('projects-expanded-390.png',true);
  await page.locator('.service-top-box .item').nth(9).click();await wait();assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.equal(await page.locator('#ams-project-toggle').count(),1);
  const rail=page.locator('.date-box .item-box');await rail.evaluate(e=>e.scrollLeft=e.scrollWidth);await wait();assert(await rail.evaluate(e=>e.scrollLeft>0));assert.equal(await rail.evaluate(e=>getComputedStyle(e).scrollSnapType),'none');await shot('dates-scrolled-390.png');
  const lastDate=rail.locator('.item').nth(6),pageYBeforeDateClick=await page.evaluate(()=>window.scrollY);await lastDate.click();await wait();assert(await lastDate.evaluate((e,r)=>{const a=e.getBoundingClientRect(),b=r.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1},await rail.elementHandle()));assert.equal(await page.evaluate(()=>window.scrollY),pageYBeforeDateClick,'date selection does not move the page vertically');
  const alignment=await page.evaluate(()=>{const t=document.querySelector('.time-line .item'),s=document.querySelector('.field-box .item:not(:disabled)');return{time:t.getBoundingClientRect().top+t.getBoundingClientRect().height/2,slot:s.getBoundingClientRect().top+s.getBoundingClientRect().height/2}});assert(Math.abs(alignment.time-alignment.slot)<=1,`row mismatch ${JSON.stringify(alignment)}`);
  const grid=page.locator('.field-outer');await grid.evaluate(e=>e.scrollLeft=e.scrollWidth);await wait();assert(await grid.evaluate(e=>e.scrollLeft>0));await noOverflow('court horizontal scroll');
  const first=page.locator('.field-box .item:not(:disabled)').first();await first.focus();await page.keyboard.press('Enter');await wait();assert.equal(await first.getAttribute('aria-pressed'),'true');
  const selectedLabel=await first.getAttribute('aria-label');assert(selectedLabel.includes('已选')&&selectedLabel.includes('¥'));
  const price=first.locator('span:not(.iconzhengque)');assert((await price.innerText()).trim().length>0);assert.notEqual(await price.evaluate(e=>getComputedStyle(e).display),'none');
  const review=page.locator('#ams-selection-review');assert(await review.isVisible());assert((await review.innerText()).includes('已选 1 个时段'));assert.equal(await page.locator('#agreement').isChecked(),false);
  const reviewBox=await review.boundingBox(),tabsBox=await page.locator('.native-tabs').boundingBox();assert(reviewBox.y+reviewBox.height<=tabsBox.y+1);await shot('slot-selected-390.png');
  await review.click();await wait();const orderTitle=await page.locator('.order-wrapper .order-title').boundingBox();assert(orderTitle&&orderTitle.y>=0&&orderTitle.y<tabsBox.y);assert.equal(await page.locator('#agreement').isChecked(),false);
  await first.focus();await page.keyboard.press('Space');await wait();assert.equal(await first.getAttribute('aria-pressed'),'false');assert(await review.isHidden());
  const disabled=page.locator('.field-box .item:disabled').first();assert.equal(await disabled.getAttribute('aria-disabled'),'true');assert.equal(await disabled.getAttribute('tabindex'),'-1');await disabled.focus();assert.notEqual(await disabled.evaluate(e=>document.activeElement===e),true);
  const rowAfterSwipe=await page.evaluate(()=>{const t=document.querySelector('.time-line .item'),s=document.querySelector('.field-box .item');return Math.abs((t.getBoundingClientRect().top+t.getBoundingClientRect().height/2)-(s.getBoundingClientRect().top+s.getBoundingClientRect().height/2))});assert(rowAfterSwipe<=1);
  await page.evaluate(()=>{window.__mutationCount=0;window.__auditObserver=new MutationObserver(ms=>window.__mutationCount+=ms.length);window.__auditObserver.observe(document.body,{childList:true,subtree:true,attributes:true})});
  for(let i=0;i<12;i++){await page.locator('#ams-project-toggle').click();await page.waitForTimeout(5)}await page.waitForTimeout(250);
  const mutations=await page.evaluate(()=>window.__mutationCount);assert(mutations<400);await page.waitForTimeout(100);
  const stableMutations=await page.evaluate(()=>window.__mutationCount);assert.equal(stableMutations,mutations,'MutationObserver settles after DOM updates');
  await page.evaluate(()=>window.__auditObserver.disconnect());assert.equal(await page.locator('#ams-project-toggle').count(),1);assert.equal(await page.locator('#ams-selection-review').count(),1);

  await page.locator('.native-tabs [data-route="orders"]').click();await wait();assert.equal(await page.locator('.order-box').count(),4);await shot('orders-390.png');
  await page.locator('.native-tabs [data-route="tickets"]').click();await wait();assert.equal(await page.locator('.ticket-box').count(),3);await shot('tickets-390.png');
  await page.locator('.native-tabs [data-route="court"]').click();await wait();
  const ticketMode=page.locator('.el-radio-button:has(input[value="ticket"])');await ticketMode.scrollIntoViewIfNeeded();await ticketMode.locator('.el-radio-button__inner').click({force:true});await wait();
  const tip=page.locator('.ticket-tips').first();await tip.click();await page.waitForTimeout(250);assert.equal(await tip.getAttribute('aria-expanded'),'true');
  const detail=tip.locator('.tips-detail'),tipRect=await detail.boundingBox(),layout=await detail.evaluate(e=>({display:getComputedStyle(e).display,parentOverflow:getComputedStyle(e.parentElement).overflow,text:e.innerText,scrollHeight:e.parentElement.scrollHeight,height:e.parentElement.clientHeight}));
  const bottomBar=await page.locator('.native-tabs').boundingBox();assert(tipRect&&tipRect.x>=0&&tipRect.x+tipRect.width<=390&&tipRect.y+tipRect.height<=bottomBar.y+1);assert.equal(layout.display,'block');assert(layout.text.includes('离线示例'));assert(layout.scrollHeight<=layout.height+1||layout.parentOverflow==='visible');
  visual.ticketDisclosure={...layout,detailBottom:tipRect.y+tipRect.height,navigationTop:bottomBar.y,pass:true};await shot('ticket-purchase-390.png');
  await tip.focus();await page.keyboard.press('Escape');await wait();assert.equal(await tip.getAttribute('aria-expanded'),'false');

  await page.locator('.native-tabs [data-route="court"]').click();await wait();
  const fieldMode=page.locator('.el-radio-button:has(input[value="field"])');await fieldMode.scrollIntoViewIfNeeded();await fieldMode.locator('.el-radio-button__inner').click({force:true});await wait();
  await page.locator('.field-box .item:not(:disabled)').first().click();await page.locator('#agreement').check();assert.equal(await page.locator('[data-action="submit"]').isDisabled(),false);
  await page.locator('[data-action="submit"]').click();await wait();assert((await page.locator('#screen').innerText()).includes('DEMO-2000'));assert((await page.locator('#screen').innerText()).includes('虚构订单'));
  await page.locator('[data-action="method"][data-value="wechat"]').click();await page.locator('[data-action="launch"]').click();await wait();assert((await page.locator('#modal').innerText()).includes('不打开真实应用'));await shot('payment-demo-390.png');
  await page.locator('[data-action="dismiss"]').click();await page.locator('.review-tools > summary').click();await wait();await page.locator('[data-action="reset"]').click();await wait();
  await page.waitForTimeout(2100);
  for(const width of [320,390]){
    await page.setViewportSize({width,height:width===320?640:844});
    for(const scenario of [
      {value:'empty',name:'empty',text:'当前没有可预约场地',role:'status'},
      {value:'loading',name:'loading',text:'正在加载演示场地',role:'status'},
      {value:'error',name:'error',text:'暂时无法连接',role:'alert'}
    ]){
      await page.locator('.review-tools').evaluate(e=>{e.open=true});
      await page.locator('#scenario').selectOption(scenario.value);
      await page.locator('.review-tools').evaluate(e=>{e.open=false});
      await page.evaluate(()=>{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;if(document.scrollingElement)document.scrollingElement.scrollTop=0});await wait();
      const status=await page.evaluate(()=>{const e=document.querySelector('.status-firstscreen'),r=e?.getBoundingClientRect(),nav=document.querySelector('.native-tabs')?.getBoundingClientRect(),header=document.querySelector('.native-header')?.getBoundingClientRect(),label=document.querySelector('.offline-label')?.getBoundingClientRect();return{visible:!!(r&&r.width&&r.height),text:e?.innerText||'',role:e?.getAttribute('role'),ariaBusy:e?.getAttribute('aria-busy'),rect:r?{top:r.top,bottom:r.bottom,height:r.height}:null,navigationTop:nav?.top,headerRect:header&&{top:header.top,bottom:header.bottom},offlineLabelRect:label&&{top:label.top,bottom:label.bottom},pageScrollY:window.scrollY,scrollTop:document.scrollingElement?.scrollTop,projectCount:document.querySelectorAll('.service-top-box .item').length,dateCount:document.querySelectorAll('.date-box .item').length,gridCount:document.querySelectorAll('.field-outer').length,orderCount:document.querySelectorAll('.order-wrapper').length,documentWidth:document.documentElement.scrollWidth}});
      assert(status.visible&&status.rect.top>=0&&status.rect.bottom<=status.navigationTop,`${scenario.name} status is visible above navigation at ${width}px: ${JSON.stringify(status)}`);
      assert.equal(status.pageScrollY,0,`${scenario.name} status screenshot starts at the page top`);assert.equal(status.scrollTop,0);
      assert(status.offlineLabelRect&&status.offlineLabelRect.top===0&&status.offlineLabelRect.bottom<=status.headerRect?.top&&status.headerRect.bottom<=status.rect.top,`${scenario.name} keeps the page header in the screenshot: ${JSON.stringify(status)}`);
      assert(status.text.includes(scenario.text));assert.equal(status.role,scenario.role);assert.equal(status.projectCount,0);assert.equal(status.dateCount,0);assert.equal(status.gridCount,0);assert.equal(status.orderCount,0);assert(status.documentWidth<=width+1);
      if(scenario.value==='loading')assert.equal(status.ariaBusy,'true');
      visual.firstScreenStateChecks.push({width,height:width===320?640:844,state:scenario.name,...status,pass:true});
      await shot(`${scenario.name}-${width}.png`);
    }
  }
  await page.setViewportSize({width:390,height:844});await page.locator('[data-action="normal"]').click();await wait();await page.locator('.review-tools').evaluate(e=>{e.open=true});
  for(let i=0;i<themes.length;i++)for(const mode of ['light','dark']){
    await page.locator('#palette').selectOption(String(i));await page.locator('#appearance').selectOption(mode);await wait();
    const colors=await page.evaluate(()=>Object.fromEntries(['paper','surface','input','ink','muted','line','primary','accent','wash'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue('--campus-'+k).trim()])));
    const muted=(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--sports-muted').trim()))||colors.muted;
    const accent=(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--sports-accent').trim()))||colors.accent;
    const ratio=(a,b)=>{const lum=x=>{let v=parseInt(x.replace('#',''),16);const q=[v>>16,(v>>8)&255,v&255].map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*q[0]+.7152*q[1]+.0722*q[2]};const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
    const contrast={inkPaper:ratio(colors.ink,colors.paper),inkSurface:ratio(colors.ink,colors.surface),mutedPaper:ratio(muted,colors.paper),mutedInput:ratio(muted,colors.input),mutedLine:ratio(muted,colors.line),whitePrimary:ratio('#ffffff',colors.primary),accentWash:ratio(accent,colors.wash),accentPaper:ratio(accent,colors.paper),accentSurface:ratio(accent,colors.surface),sourceAccentWash:ratio(colors.accent,colors.wash)};
    assert(contrast.inkPaper>=4.5&&contrast.inkSurface>=4.5);assert(contrast.mutedPaper>=4.5&&contrast.mutedInput>=4.5&&contrast.mutedLine>=4.5,`${themes[i]} ${mode} muted ${JSON.stringify(contrast)}`);
    assert(contrast.whitePrimary>=4.5);assert(contrast.accentWash>=4.5&&contrast.accentPaper>=4.5&&contrast.accentSurface>=4.5,`${themes[i]} ${mode} accent ${JSON.stringify(contrast)}`);
    visual.themeChecks.push({theme:themes[i],appearance:mode,colors,sportsMuted:muted,sportsAccent:accent,contrast:Object.fromEntries(Object.entries(contrast).map(([k,v])=>[k,Number(v.toFixed(2))])),pass:true});await shot(`theme-${themes[i]}-${mode}.png`);
  }
  await page.locator('#appearance').selectOption('dark');await wait();await shot('dark-390.png');await page.locator('.review-tools > summary').click();
  for(const scale of [1.3,1.5]){
    await load();await page.evaluate(scale=>{for(const e of document.querySelectorAll('body *')){const px=parseFloat(getComputedStyle(e).fontSize);if(Number.isFinite(px))e.style.setProperty('font-size',`${px*scale}px`,'important')}},scale);
    const m=await noOverflow(`text stress ${scale}`),toggleBox=await page.locator('#ams-project-toggle').boundingBox(),slotBox=await page.locator('.field-box .item:not(:disabled)').first().boundingBox();
    assert(toggleBox&&toggleBox.height>=44&&toggleBox.x>=0&&toggleBox.x+toggleBox.width<=m.viewport);assert(slotBox&&slotBox.width>=70&&slotBox.height>=44);
    visual.textScaleChecks.push({scale:Math.round(scale*100),pageWidth:m.documentWidth,viewport:m.viewport,projectToggleBox:toggleBox,slotBox,pass:true,note:'Browser-only enlarged-font stress style; does not emulate Android WebView setTextZoom.'});
  }
  await load();await page.setViewportSize({width:320,height:640});await page.locator('.native-header [data-action="help"]').click();await wait();
  const dialog320=await page.locator('#modal').boundingBox();assert(dialog320&&dialog320.x>=0&&dialog320.x+dialog320.width<=320&&dialog320.y>=0&&dialog320.y+dialog320.height<=640);
  await page.locator('[data-action="dismiss"]').click();await page.setViewportSize({width:390,height:844});await page.locator('.native-header [data-action="help"]').click();await wait();await shot('focused-390.png');
  assert.equal(visual.networkAttempts,0);assert.deepEqual(visual.pageErrors,[]);visual.viewportCount=visual.viewportChecks.length;visual.themeCombinationCount=visual.themeChecks.length;
  visual.result=visual.viewportCount===7&&visual.themeCombinationCount===18?'PASS':'FAIL';
  fs.writeFileSync(path.join(out,'visual-verification.json'),JSON.stringify(visual,null,2));await context.close();await browser.close();
  console.log(JSON.stringify({result:visual.result,viewportCount:visual.viewportCount,themeCombinationCount:visual.themeCombinationCount,cssRuleCount:visual.cssRuleCount,textScaleChecks:visual.textScaleChecks,networkAttempts:visual.networkAttempts,screenshots:visual.screenshots.map(s=>s.file),themeFails:visual.themeChecks.filter(t=>!t.pass)},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
