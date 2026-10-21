const fs=require('fs'),vm=require('vm'),assert=require('assert');
const s=fs.readFileSync('work/build-live-ui.py','utf8');
const start=s.indexOf('const themes='),end=s.indexOf('function scan()',start);
const values={};const context={settingsData:{},document:{documentElement:{style:{setProperty:(k,v)=>values[k]=v}}}};vm.createContext(context);vm.runInContext(s.slice(start,end),context);
for(const k of ['blue','green','dusk','teal','sage','smoke','graphite','rose','wheat']){vm.runInContext(`applyTheme('${k}')`,context);assert.equal(context.settingsData.theme,k);assert(/^#[0-9a-f]{6}$/i.test(values['--campus-blue']));assert(s.includes("['blue','green','dusk','teal','sage','smoke','graphite','rose','wheat'].includes(e.data.theme)"));}
vm.runInContext("applyTheme('orange')",context);assert.equal(context.settingsData.theme,'smoke');
const css=fs.readFileSync('work/managed-ui-polish.css','utf8');assert(css.includes('.home-layout header{margin-bottom:8px}'));assert(!css.includes('#homeScreen .week'));assert(!css.includes('#homeScreen .actions'));assert(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
console.log('PASS nine themes, theme persistence allowlist, legacy orange fallback, home-only spacing, three-column theme grid.');
