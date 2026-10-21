const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const nodes=new Map();
const el=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,value:'',textContent:'',type:'password',className:'',removeAttribute(k){delete this[k];}});return nodes.get(id);};
const calls=[];
const context={document:{getElementById:el,body:{classList:{toggle(){}},style:{setProperty(){}}},documentElement:{style:{setProperty(){}}}},window:{scrollTo(){},addEventListener(){}},HhtBridge:{ready(){calls.push('ready')},close(){calls.push('close')},bind(...args){calls.push(args)},edit(){calls.push('edit')},unbind(){calls.push('unbind')},refresh(){calls.push('refresh')}},Date,Object};
vm.createContext(context);vm.runInContext(fs.readFileSync('work/hht-product.js','utf8'),context);
const result=data=>context.window.hhtResult(data);
assert.deepEqual(calls,['ready']);
result({kind:'session',bound:false});assert(!el('binding').hidden);assert(el('pass').hidden);
el('bind').onclick();assert.equal(calls.length,1);assert(el('feedback').textContent.includes('请先'));
el('credential').value='test-only-openid';el('bind').onclick();assert.deepEqual(calls[1],['openid','test-only-openid']);
result({kind:'loading',binding:true});assert(el('bind').disabled);
el('switchMode').onclick();assert.equal(el('credential').value,'test-only-openid');
result({kind:'error',message:'验证失败',expired:false});assert(!el('bind').disabled);assert.equal(el('credential').value,'test-only-openid');assert(el('qrImage').hidden);
result({kind:'code',name:'测试用户',image:'TEST-NOT-A-QR',updated:0});assert.equal(el('credential').value,'');assert(!el('qrImage').hidden);assert(!el('pass').hidden);assert.equal(el('passName').textContent,'测试用户');
result({kind:'loading',binding:false});assert(el('qrImage').hidden);assert.equal(el('qrImage').src,undefined);assert(el('refresh').disabled);
result({kind:'error',message:'失效',expired:true});assert(!el('rebind').hidden);assert(el('qrImage').hidden);
el('rebind').onclick();assert.equal(calls.at(-1),'edit');assert(!el('binding').hidden);
el('switchMode').onclick();el('credential').value='test-only-token';el('bind').onclick();assert.deepEqual(calls.at(-1),['token','test-only-token']);
result({kind:'session',bound:false});assert.equal(el('credential').value,'');assert(el('qrImage').hidden);
const assets='outputs/ams-android/app/src/main/assets/hht/';
for(const file of ['hht.html','tutorial.html']){
 const html=fs.readFileSync(assets+file,'utf8');for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
 assert(!html.includes('preview-tools'));assert(!html.includes('当前 HTML 仅演示'));assert(!html.includes('示例用户'));assert(!html.includes('深色预览'));
}
const tutorial=fs.readFileSync(assets+'tutorial.html','utf8');assert(tutorial.includes('双击这一行'));assert(tutorial.includes('text-decoration:underline'));assert(!tutorial.includes('查看登录返回 JSON'));
for(const match of tutorial.matchAll(/src="(assets\/[^\"]+)"/g))assert(fs.existsSync(assets+match[1]));
const java=fs.readFileSync('outputs/ams-android/app/src/main/java/cn/local/ams/HhtActivity.java','utf8');
assert(java.includes('revision!=generation'));assert(java.includes('active=false;cancel()'));assert(java.includes('setInstanceFollowRedirects(false)'));assert(java.includes('setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW)'));assert(!java.includes('addFlags(WindowManager.LayoutParams.FLAG_SECURE)'));assert(java.includes('openRawResource(id)'));assert(java.includes('ui.post(()->showLoadError())'));assert(!java.includes('Log.'));assert(!java.includes('setHostnameVerifier'));assert(!java.includes('setSSLSocketFactory'));
console.log('PASS HHT empty validation, both binding modes, failed binding retention, success clearing, stale-code masking, expired/rebind/edit, local tutorial assets, JS syntax and native boundary checks.');

for(const [asset,raw] of [['hht.html','hht_page.html'],['tutorial.html','hht_tutorial.html'],...['options','https','capture','credentials'].map(n=>['assets/'+n+'.png','hht_'+n+'.png'])])assert(fs.readFileSync(assets+asset).equals(fs.readFileSync('outputs/ams-android/app/src/main/res/raw/'+raw)));
