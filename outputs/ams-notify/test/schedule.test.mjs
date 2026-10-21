import test from 'node:test';
import assert from 'node:assert/strict';
import {cstMillis,normalizeCourse,normalizePrefs,chains,planEvents,startAlert,DEFAULT_PREFS} from '../src/schedule.mjs';

const course=(key,start,end,extra={})=>normalizeCourse({key,date:'2026-10-14',start,end,title:`T${key}`,code:`C${key}`,room:'SA101',...extra});
const at=hm=>cstMillis('2026-10-14',hm);
const prefs=(p={})=>normalizePrefs({...DEFAULT_PREFS,...p});

test('school times are China Standard Time',()=>{
 assert.equal(new Date(at('09:00')).toISOString(),'2026-10-14T01:00:00.000Z');
 assert.ok(Number.isNaN(cstMillis('10-14','09:00')));
 assert.equal(normalizeCourse({key:'a',date:'2026-10-14',start:'10:00',end:'09:00'}),null);
 assert.equal(normalizeCourse({key:'',date:'2026-10-14',start:'09:00',end:'10:00'}),null);
});

test('prefs only accept known values',()=>{
 const p=normalizePrefs({leadMin:7,merge:'yes',mutedCodes:['A','A',3],enabled:false});
 assert.equal(p.leadMin,15);assert.equal(p.merge,true);assert.deepEqual(p.mutedCodes,['A']);assert.equal(p.enabled,false);
});

test('single course: start lead, during, end with linger',()=>{
 const ev=planEvents([course('a','10:00','11:50')],prefs(),at('08:00'));
 assert.deepEqual(ev.map(e=>[e.kind,e.key]),[['start','a:start'],['update','a:during:0'],['end','a:end']]);
 assert.equal(ev[0].due,at('09:45'));
 assert.equal(ev[0].state.phase,'before');
 assert.equal(ev[1].due,at('10:00'));
 assert.equal(ev[2].due,at('11:50'));
 assert.equal(ev[2].dismissal,at('11:55')/1000);
 assert.equal(ev[0].stale,at('10:05')/1000);
});

test('late open starts in during phase immediately',()=>{
 const now=at('10:30'),ev=planEvents([course('a','10:00','11:50')],prefs(),now);
 assert.equal(ev[0].kind,'start');assert.equal(ev[0].due,now);assert.equal(ev[0].state.phase,'during');
 assert.deepEqual(ev.map(e=>e.kind),['start','end']);
});

test('finished courses produce nothing',()=>{
 assert.equal(planEvents([course('a','10:00','11:50')],prefs(),at('12:00')).length,0);
});

test('back-to-back courses merge and switch to next',()=>{
 const cs=[course('a','09:00','10:50'),course('b','11:00','12:50')];
 assert.equal(chains(cs,prefs()).length,1);
 const ev=planEvents(cs,prefs(),at('07:00'));
 assert.deepEqual(ev.map(e=>e.key),['a:start','a:during:0','a:before:1','a:during:1','a:end']);
 assert.equal(ev[0].state.next.title,'Tb');
 assert.equal(ev[0].state.left,1,'classes left today exclude the current one');
 assert.equal(ev.find(e=>e.key==='a:during:1').state.left,0);
 assert.equal(ev[2].state.phase,'before');assert.equal(ev[2].state.title,'Tb');
 assert.equal(chains(cs,prefs({merge:false})).length,2);
});

test('chain key stays the first class after it ends',()=>{
 const cs=[course('a','09:00','10:50'),course('b','11:00','12:50')];
 const ev=planEvents(cs,prefs(),at('11:30'));
 assert.ok(ev.length&&ev.every(e=>e.chain==='a'),JSON.stringify(ev.map(e=>e.key)));
 assert.equal(planEvents(cs,prefs(),at('11:30'),{endedChains:['a']}).length,0,'ending the chain also silences its second class');
});

test('gap over 30 minutes does not merge',()=>{
 assert.equal(chains([course('a','09:00','10:00'),course('b','10:31','11:00')],prefs()).length,2);
});

test('chain never exceeds 8 hours',()=>{
 const cs=[course('a','08:00','09:50'),course('b','10:00','11:50'),course('c','12:00','13:50'),course('d','14:00','15:50'),course('e','16:00','17:50')];
 for(const ch of chains(cs,prefs())){
  const span=ch.at(-1).endMs+5*60e3-(ch[0].startMs-15*60e3);
  assert.ok(span<=8*3600e3,`span ${span/3600e3}h`);
 }
 assert.ok(chains(cs,prefs()).length>=2);
});

test('muted, skipped, ended and local chains',()=>{
 const cs=[course('a','09:00','10:00'),course('b','14:00','15:00')];
 assert.deepEqual(planEvents(cs,prefs({mutedCodes:['Ca']}),at('07:00')).map(e=>e.chain),['b','b','b']);
 assert.deepEqual([...new Set(planEvents(cs,prefs({skipKeys:['b']}),at('07:00')).map(e=>e.chain))],['a']);
 assert.deepEqual([...new Set(planEvents(cs,prefs(),at('07:00'),{endedChains:['a']}).map(e=>e.chain))],['b']);
 const local=planEvents(cs,prefs(),at('07:00'),{localChains:['a']});
 assert.ok(!local.some(e=>e.key==='a:start'));assert.ok(local.some(e=>e.key==='a:end'));
 assert.equal(planEvents(cs,prefs({enabled:false}),at('07:00')).length,0);
});

test('alert text',()=>{
 const ev=planEvents([course('a','10:00','11:50')],prefs(),at('08:00'));
 assert.deepEqual(startAlert(ev[0].state),{title:'即将上课',body:'Ta · SA101 · 10:00 开始'});
});
