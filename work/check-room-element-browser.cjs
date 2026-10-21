// Optional real-control regression. Fixtures: vue@2.7.16 dist/vue.js and
// element-ui@2.15.14 lib/index.js + lib/theme-chalk/index.css from npm registry,
// with archive integrity checked. Set AMS_ELEMENT_FIXTURE_DIR to their directory
// with names vue-dist-vue.js, element-ui-lib-index.js, element-ui-lib-theme-chalk-index.css.
// All page traffic is intercepted. No school accounts, queries or bookings are used.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright');
const root=process.env.AMS_ELEMENT_FIXTURE_DIR;assert(root,'Set AMS_ELEMENT_FIXTURE_DIR to the pinned public Vue/Element fixture directory');
const adapter=fs.readFileSync(process.argv[2]||'outputs/ams-android/app/src/main/assets/library-room-ui.js','utf8');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.AMS_TEST_BROWSER_CHANNEL?{channel:process.env.AMS_TEST_BROWSER_CHANNEL}:{})});try{
for(const kind of ['select','autocomplete']){
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url()==='https://roombookings.xjtlu.edu.cn/'?r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><div id="app"><div class="wrap"><div class="navigation"></div><div class="innerwrapp"><div class="tabBox"><el-dialog v-if="alive" title="Synthetic participants" :visible.sync="open" :append-to-body="false" :close-on-click-modal="false"><el-form><el-form-item label="参与人">${kind==='select'?'<el-select v-model="selected" multiple filterable remote :remote-method="search" :popper-append-to-body="false"><el-option v-for="item in options" :key="item" :label="item" :value="item"></el-option></el-select>':'<el-autocomplete v-model="query" :fetch-suggestions="suggest" :popper-append-to-body="false" @select="choose"></el-autocomplete>'}</el-form-item></el-form><p id="selection">{{selected.join(",")}}</p></el-dialog></div></div></div></div>`}):r.abort());
 await page.goto('https://roombookings.xjtlu.edu.cn/');await page.addStyleTag({path:path.join(root,'element-ui-lib-theme-chalk-index.css')});
 await page.addScriptTag({path:path.join(root,'vue-dist-vue.js')});await page.addScriptTag({path:path.join(root,'element-ui-lib-index.js')});
 await page.evaluate(()=>{window.fixture=new Vue({el:'#app',data:{alive:true,open:true,selected:['synthetic-self'],query:'',options:[]},methods:{search(q){this.options=q?[q]:[];},suggest(q,cb){cb(q?[{value:q}]:[]);},choose(item){this.selected.push(item.value);this.query='';}}});});
 await page.addScriptTag({content:adapter});
 const input=page.locator(kind==='select'?'.el-dialog .el-select__input':'.el-dialog .el-autocomplete input');
 for(const name of ['synthetic-guest-one','synthetic-guest-two']){
  await input.fill(name);
  const option=page.locator(kind==='select'?'.el-select-dropdown__item':'.el-autocomplete-suggestion li').filter({hasText:name});
  await option.click();
 }
 assert.equal(await page.evaluate(()=>fixture.selected.length),3);
 // Reopen the real dialog and exercise position and keyboard handling after repeated mounts.
 await page.evaluate(()=>fixture.open=false);await page.waitForTimeout(400);await page.evaluate(()=>fixture.open=true);
 await input.fill('synthetic-guest-three');
 const option=page.locator(kind==='select'?'.el-select-dropdown__item':'.el-autocomplete-suggestion li').filter({hasText:'synthetic-guest-three'});
 await option.waitFor({state:'visible'});
 const box=await option.boundingBox(),field=await page.locator(kind==='select'?'.el-dialog .el-select':'.el-dialog .el-autocomplete').boundingBox();assert(box&&field);assert(Math.abs(box.x-field.x)<80,'popup anchored horizontally');assert(box.y>=field.y,'popup below input');
 await input.press('ArrowDown');await input.press('Enter');
 await page.waitForFunction(()=>fixture.selected.length===4);
 await page.evaluate(()=>fixture.alive=false);await page.waitForTimeout(500);
 assert.equal(await page.locator('.el-dialog__wrapper,.el-select-dropdown,.el-autocomplete-suggestion').count(),0,'no orphaned popup after v-if destruction');assert.deepEqual(errors,[]);
 console.log('PASS real Element '+kind+': select/reopen/position/keyboard/destroy');await page.close();
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
