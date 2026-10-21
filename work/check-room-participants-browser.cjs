// Synthetic school controls only. Never contacts the school or submits a booking.
const fs=require('fs'),assert=require('assert/strict'),{chromium}=require('playwright');
const source=fs.readFileSync(process.argv[2]||'outputs/ams-android/app/src/main/assets/library-room-ui.js','utf8');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.AMS_TEST_BROWSER_CHANNEL?{channel:process.env.AMS_TEST_BROWSER_CHANNEL}:{})});
 try{
  for(const width of [390,430]){
   const page=await browser.newPage({viewport:{width,height:844}});
   await page.route('**/*',route=>route.request().url()==='https://roombookings.xjtlu.edu.cn/'?route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><div class="wrap"><div class="navigation"></div><div class="innerwrapp"><div class="tabBox"><div class="el-dialog__wrapper" style="position:fixed;inset:0;z-index:2020"><div class="el-dialog"><div class="el-dialog__body"><label>参与人<input aria-label="参与人"></label><div id="options" class="${width===390?'el-autocomplete-suggestion':'el-select-dropdown'}" style="position:absolute;top:160px;left:24px;width:300px;z-index:2001;display:none"></div><p id="selected" role="status"></p><button id="submit">提交预约</button></div></div></div></div></div></div><script>
   const selected=['synthetic-self'];let submissions=0;document.querySelector('#submit').onclick=()=>submissions++;
   document.querySelector('input').oninput=e=>{const popup=document.querySelector('#options');document.querySelector('.el-dialog__body').append(popup);popup.replaceChildren();const option=document.createElement('button');option.textContent=e.target.value;option.onclick=()=>{selected.push(option.textContent);document.querySelector('#selected').textContent=selected.join(',');popup.style.display='none';};popup.append(option);popup.style.display='block';};
   </script>`}):route.abort());
   await page.goto('https://roombookings.xjtlu.edu.cn/');
   await page.addScriptTag({content:source});
   await page.getByLabel('参与人',{exact:true}).fill('synthetic-guest-one');
   await page.waitForFunction(()=>document.querySelector('#options').parentElement===document.body);
   assert.equal(await page.locator('#options').evaluate(n=>getComputedStyle(n).visibility),'visible');
   assert(await page.locator('#options').evaluate(n=>Number(getComputedStyle(n).zIndex)>2020));
   await page.getByRole('button',{name:'synthetic-guest-one',exact:true}).click();
   await page.getByLabel('参与人',{exact:true}).fill('synthetic-guest-two');
   await page.waitForFunction(()=>document.querySelector('#options').parentElement===document.body);
   await page.getByRole('button',{name:'synthetic-guest-two',exact:true}).click();
   assert.equal(await page.evaluate(()=>selected.length),3);
   assert.equal(await page.evaluate(()=>submissions),0);
   assert.equal(await page.locator('#options').evaluate(n=>getComputedStyle(n).display),'none');
   await page.close();
  }
  console.log('PASS: 390/430px hidden timeline, scrolling dialog, candidate hit testing/z-order, three participants and original handlers; zero submissions');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
