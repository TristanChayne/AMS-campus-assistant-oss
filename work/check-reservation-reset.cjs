const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync('outputs/ams-android/app/src/main/assets/reservation-reset-ui.js','utf8');
async function scenario(records,path,loggedIn=true){
  const routes=[],events=[];
  const router={currentRoute:{path},replace(next){routes.push(next);this.currentRoute.path=next;return Promise.resolve();}};
  const school={$router:router,$store:{state:{isLogin:loggedIn}}};
  const context={Promise,window:{scrollTo(){events.push('scroll');}},document:{querySelector(){return {__vue__:school};},querySelectorAll(){return [{click(){events.push('close');}}];}}};
  vm.runInNewContext(script,context);
  await context.window.__campusResetReservation(records);
  return {routes,events};
}
(async()=>{
  assert.deepEqual((await scenario(false,'/ic/seatPredetermine/11')).routes,['/ic/home']);
  assert.deepEqual((await scenario(false,'/ic/researchSpace/2/5/5')).routes,['/ic/home']);
  assert.deepEqual((await scenario(true,'/ic/userinfo')).routes,['/ic/home','/ic/userinfo']);
  assert.deepEqual((await scenario(false,'/ic/home')).routes,[]);
  assert.deepEqual(await scenario(true,'/login',false),{routes:[],events:[]});
  assert.deepEqual((await scenario(false,'/ic/home')).events,['close','scroll']);
  console.log('PASS: reset seat/room to home, reset record query through fresh route, preserve login, no document reload or booking submission.');
})().catch(error=>{console.error(error);process.exitCode=1;});
