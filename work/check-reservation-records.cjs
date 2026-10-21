const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('outputs/ams-android/app/src/main/assets/reservation-records-ui.js','utf8');
function node(text=''){return {textContent:text,children:[],value:'',isConnected:true,style:{},classList:{add(){},remove(){},contains(){return false}},append(...x){this.children.push(...x)},replaceChildren(){this.children=[]},remove(){this.isConnected=false},querySelector(){return null},querySelectorAll(){return []}}}
const parts=Object.fromEntries(['.record-from','.record-to','.record-status','.record-search','.record-feedback','.record-list','.record-pages span','.record-prev','.record-next'].map(k=>[k,node()]));
const panel=node();panel.querySelector=s=>parts[s];panel.querySelectorAll=()=>parts['.record-status'].children.map(label=>label.children[0]).filter(n=>n.checked);
let actionCount=0,queryCount=0;const original=node('Cancel');original.click=()=>actionCount++;
const row=node('1 Room 314 09:00–10:00 Effective Cancel');row.children=['','1','Room 314','09:00–10:00','Effective','Cancel'].map(node);row.querySelectorAll=s=>s==='button'?[original]:[];original.closest=()=>null;
const table=node();table.nodeType=1;table.querySelectorAll=s=>s.includes('tbody')?(adapter.tableData.length?[row]:[]):['','No.','Room No.','Time','Status','Action'].map(node);
const adapter={$data:{},tableData:[{}],$el:table,pageDate:{page:1,pageNum:10,count:1},search:{date:['2026-10-04','2026-10-10'],check:[2,4,128,256,8192]},checkOption:[{label:'Ineffective',value:2},{label:'Effective',value:4},{label:'Complete',value:128}],handleSearch(){queryCount++},handleCurrentChange(){}};
let tick;const inner=node();inner.prepend=()=>{};inner.querySelector=()=>table;const ctx={window:{},location:{hostname:'roombookings.xjtlu.edu.cn',hash:'#/ic/userinfo'},document:{head:{append(){}},body:node(),querySelector:s=>s==='#app'?{__vue__:{ $children:[adapter]}}:inner,querySelectorAll(){return []},createElement:tag=>tag==='section'?panel:node()},setInterval(fn){tick=fn},setTimeout(fn){fn()}};
vm.runInNewContext(source,ctx);const card=parts['.record-list'].children[0];assert.equal(card.children[0].textContent,'Room 314');assert.equal(queryCount,0);assert.equal(actionCount,0);
const actions=card.children.find(n=>n.className==='record-actions');assert.equal(actions.children[0].textContent,'取消预约');actions.children[0].onclick();assert.equal(actionCount,1);
parts['.record-from'].value='2026-10-07';parts['.record-to'].value='2026-10-09';parts['.record-search'].onclick();assert.equal(queryCount,1);assert.deepEqual(Array.from(adapter.search.date),['2026-10-07','2026-10-09']);assert(adapter.search.check.includes(256)&&adapter.search.check.includes(8192));
parts['.record-from'].value='2026-10-12';parts['.record-search'].onclick();assert.equal(queryCount,1);assert(parts['.record-feedback'].textContent.includes('正确'));
adapter.tableData=[{uuid:'fixture-2'}];tick();assert.equal(parts['.record-search'].disabled,false);assert(parts['.record-feedback'].textContent.includes('已显示'));// Reproduce the supplied seat card, including five empty controls and duplicate details.
let detailCount=0,expandCount=0;
const detail=node('Detail');detail.closest=()=>null;detail.click=()=>detailCount++;
const duplicate=node('Detail');duplicate.closest=()=>null;duplicate.click=()=>{throw Error('duplicate action used')};
const history=node('Action History');history.closest=()=>null;history.click=()=>{};
const hidden=node('Cancel');hidden.closest=()=>null;hidden.nodeType=1;hidden.getAttribute=()=>null;hidden.computedDisplay='none';
const blanks=Array.from({length:5},()=>{const n=node();n.closest=()=>null;return n});
row.textContent='seat regression';row.children=['','349350','7F7F7F-111','Start: 2026-05-19 11:12End: 2026-05-19 22:00Actual End: 2026-05-19 22:00','Complete',''].map(node);
row.querySelectorAll=s=>s==='button'?[detail,...blanks,duplicate,history,hidden]:[];
row.querySelector=s=>s==='.el-table__expand-icon'?{click(){expandCount++}}:null;
ctx.getComputedStyle=n=>({display:n.computedDisplay||'block'});
tick();const seatCard=parts['.record-list'].children[0];
assert.equal(seatCard.children[0].textContent,'7F · 座位 111');
const time=seatCard.children[1].children.find(n=>n.children[0].textContent==='时间').children[1].textContent;
assert.equal(time,'开始： 2026-05-19 11:12\n结束： 2026-05-19 22:00\n实际结束： 2026-05-19 22:00');
const seatActions=seatCard.children.find(n=>n.className==='record-actions');
assert.deepEqual(seatActions.children.map(n=>n.textContent),['详情','操作记录']);
seatActions.children[0].onclick();assert.equal(detailCount,1);assert.equal(expandCount,0);
// Hidden duplicate floor nodes are ignored, while inherited visibility:hidden is harmless.
function element(children,display='block'){const n=node();n.nodeType=1;n.childNodes=children;n.getAttribute=()=>null;n.computedDisplay=display;for(const c of children)c.parentElement=n;return n}
const text=t=>({nodeType:3,textContent:t});
row.children[2]=element([element([text('7F')],'none'),element([text('7F')],'none'),text('7F-043')]);
row.textContent='hidden floor regression';tick();assert.equal(parts['.record-list'].children[0].children[0].textContent,'7F · 座位 043');
// A hidden dropdown container must not suppress its valid menu actions.
const menu=node();menu.nodeType=1;menu.classList.contains=c=>c==='el-dropdown-menu';menu.computedDisplay='none';
history.nodeType=1;history.getAttribute=()=>null;history.parentElement=menu;
row.textContent='dropdown regression';row.querySelectorAll=s=>s==='button'?[]:s==='.el-dropdown'?[{__vue__:{dropdownElm:{querySelectorAll:()=>[history]}}}]:[];
row.querySelector=()=>null;tick();assert.equal(parts['.record-list'].children[0].children.find(n=>n.className==='record-actions').children[0].textContent,'操作记录');
adapter.pageDate.count=null;adapter.tableData=[];tick();assert(parts['.record-list'].children[0].textContent.includes('尚未取得'));assert(parts['.record-feedback'].textContent.includes('尚未返回'));
console.log('PASS: record cards, translated actions, explicit action delegation, valid date search, preserved school-only status flags; no real cancellation.');
