const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
// Runs the whole room script against a minimal DOM and a fake school page, then drives refresh(), the date picker and the confirm button.
class El{
  constructor(tag,cls=''){this.tagName=tag.toUpperCase();this.cls=new Set(cls.split(' ').filter(Boolean));this.children=[];this.parent=null;this.style={};this.attrs={};this.value='';this.textContent='';this.disabled=false;this.hidden=false;this.id='';
    const s=this.cls;this.classList={add:(...c)=>c.forEach(x=>s.add(x)),remove:(...c)=>c.forEach(x=>s.delete(x)),toggle:(c,f)=>((f===undefined?!s.has(c):f)?s.add(c):s.delete(c)),contains:c=>s.has(c)}}
  set className(v){this.cls.clear();String(v).split(' ').filter(Boolean).forEach(x=>this.cls.add(x))}
  get className(){return [...this.cls].join(' ')}
  set innerHTML(html){this.children=[];for(const m of html.matchAll(/<(\w+)([^>]*)>/g)){const cls=/class="([^"]+)"/.exec(m[2]);const el=new El(m[1],cls?cls[1]:'');el.disabled=/\sdisabled/.test(m[2]);this.append(el)}}
  append(...n){for(const x of n){if(typeof x!=='object')continue;x.remove();x.parent=this;this.children.push(x)}}
  prepend(...n){for(const x of n.reverse()){x.remove();x.parent=this;this.children.unshift(x)}}
  replaceChildren(...n){this.children.forEach(x=>x.parent=null);this.children=[];this.append(...n)}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null}}
  get isConnected(){let n=this;while(n.parent)n=n.parent;return n.tagName==='BODY'}
  setAttribute(k,v){this.attrs[k]=String(v)}
  click(){this.onclick?.()}
  all(){return this.children.flatMap(x=>[x,...x.all()])}
  querySelector(sel){return this.all().find(x=>x.cls.has(sel.slice(1)))||null}
}
function run(file,{tabs=[],stubborn=false}={}){
  const source=fs.readFileSync(file,'utf8');
  const view={loading:false,day:'2099/01/01',get activeName(){return this.day},set activeName(v){if(!stubborn)this.day=v},changeMon(){},reserveDay(){this.day='2099/01/01'}};
  const items=tabs.map(d=>{const el=new El('div','el-tabs__item');el.id='tab-'+d;el.onclick=()=>{if(!stubborn)view.day=d};return el});
  let ups=0;const room={config:{openStart:'08:00',openEnd:'22:00',resvRule:{minResvTime:30,maxResvTime:180}},resInfo:{devId:1,devName:'Room 1',labName:'Lab',onlyView:false},isShowAll:false,selectDay:'2099/01/01',boxWidth:840,errorArr:[],disArr:[],$refs:{showLatestRT:{style:{left:'0%',width:'0%'}}},up(){ups++}};
  const body=new El('body'),head=new El('head'),wrap=new El('div','wrap');body.append(wrap);
  const document={head,body,createElement:t=>new El(t),
    querySelector:s=>({'.wrap':wrap,'.tabBox':{__vue__:view}})[s]||null,
    querySelectorAll:s=>s==='.time-wrapp'?[{__vue__:room}]:s==='.tabBox .el-tabs__item'?items:[],
    getElementById:id=>body.all().find(x=>x.id===id)||items.find(x=>x.id===id)||null};
  let tick;const ctx={document,location:{protocol:'https:',hostname:'roombookings.xjtlu.edu.cn',hash:'#/ic/room'},setInterval:f=>{tick=f;return 1},clearInterval(){}};
  ctx.window={addEventListener(){}};vm.createContext(ctx);vm.runInContext(source,ctx);
  const panel=wrap.children.find(x=>x.id==='campus-room-panel');assert(panel,'panel created');
  const q=s=>panel.querySelector(s);
  const pick=d=>{q('.room-date').value=d;q('.room-date').onchange({target:q('.room-date')})};
  const confirm=()=>{const before=ups;q('.room-confirm').click();return ups>before};
  return {view,room,tick,q,pick,confirm,load:()=>{room.selectDay=view.day}};
}
for(const file of ['outputs/ams-android/app/src/main/assets/library-room-ui.js','outputs/ams-ios/Assets/library-room-ui.js']){
  // Native date tab: chosen day sticks, confirmation waits for the room data of that day.
  let t=run(file,{tabs:['2099/01/01','2099/01/02','2099/01/03']});
  assert.equal(t.q('.room-confirm').disabled,false,'initial day is ready');
  assert.equal(t.q('.room-date').min,'2099-01-01');assert.equal(t.q('.room-date').max,'2099-01-03');
  t.pick('2099-01-03');assert.equal(t.view.activeName,'2099/01/03');assert.equal(t.q('.room-confirm').disabled,true);assert.equal(t.confirm(),false,'no confirm while switching');
  t.tick();assert.equal(t.q('.room-confirm').disabled,true);assert.equal(t.confirm(),false,'activeName switched but timeline still on old day');
  t.load();t.tick();assert.equal(t.q('.room-date').value,'2099-01-03');assert.equal(t.q('.room-confirm').disabled,false);assert.equal(t.confirm(),true);
  // Out-of-range day is refused and keeps the current day.
  t=run(file,{tabs:['2099/01/01','2099/01/02']});t.pick('2099-02-01');assert.equal(t.view.activeName,'2099/01/01');assert.equal(t.q('.room-date').value,'2099-01-01');assert.match(t.q('.room-feedback').textContent,/学校只开放/);
  // No tabs: reserveDay() resets to the default day; the chosen day is restored and never written back as today.
  t=run(file);t.pick('2099-01-03');assert.equal(t.view.activeName,'2099/01/03');t.tick();assert.equal(t.confirm(),false);t.load();t.tick();
  assert.equal(t.q('.room-date').value,'2099-01-03');assert.equal(t.confirm(),true);
  // School page refuses the day: bounded retries, then confirmation stays blocked and the picker is cleared.
  t=run(file,{stubborn:true});t.pick('2099-01-03');for(let i=0;i<3;i++){t.tick();assert.equal(t.confirm(),false)}
  t.tick();assert.match(t.q('.room-feedback').textContent,/未能切换到 2099-01-03/);assert.equal(t.q('.room-date').value,'');assert.equal(t.q('.room-confirm').disabled,true);assert.equal(t.confirm(),false);
  t.tick();t.tick();assert.equal(t.confirm(),false,'failure stays blocked across refreshes');
  t.pick('2099-01-01');t.tick();assert.equal(t.q('.room-confirm').disabled,false);assert.equal(t.confirm(),true,'re-picking the shown day recovers');
  // Room data never follows the new day: times out and stays blocked.
  t=run(file,{tabs:['2099/01/01','2099/01/03']});t.pick('2099-01-03');for(let i=0;i<9;i++){t.tick();assert.equal(t.confirm(),false)}
  t.tick();assert.match(t.q('.room-feedback').textContent,/已暂停确认/);assert.equal(t.confirm(),false);
  // School page loading: confirmation blocked.
  t=run(file);t.view.loading=true;t.tick();assert.equal(t.q('.room-confirm').disabled,true);assert.equal(t.confirm(),false);
}
console.log('PASS: room date on Android and iOS — native tab, reserveDay reset restored, selectDay must match before confirm, bounded retries and data timeout block confirm, out-of-range guard, loading guard.');
