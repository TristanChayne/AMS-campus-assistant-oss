const fs=require('fs'),assert=require('assert/strict');
const main=fs.readFileSync('outputs/ams-ios/Assets/ams-modern-ui.js','utf8');
let document;
for(const match of main.matchAll(/"(?:[^"\\]|\\.)*"/g)){
 const value=JSON.parse(match[0]);if(value.includes('function renderSettings(screen){')){document=value;break;}
}
assert(document);
for(const value of ["function dayLabel(","function dayTitle(","return '下'+week[target.getDay()]",'回到今天',"key==='fb'?'room':{seat:'seat',room:'room',sports:'sports',bus:'bus',records:'bookings'}",'appearance-chevron" aria-hidden="true">›',"typeof latin==='function'",'html.ams-dark .day.selected{box-shadow:inset 0 0 0 2px','.about-app a{display:inline-flex;align-items:center;justify-content:center;min-height:48px']) assert(document.includes(value),value);
assert(!document.includes('回到今天 ↗'));
assert(!document.includes('id="checkUpdateBtn"'));
assert(document.includes("['sports','体育馆预约'"));
const chrome=fs.readFileSync('outputs/ams-ios/Assets/ios-chrome.html','utf8');
assert(chrome.includes('.home-layout header{padding-right:156px}'));
assert(document.includes('爱发电') && document.includes('afdian.com/a/tristanchayne'));
const tutorial=fs.readFileSync('outputs/ams-ios/Assets/hht/tutorial.html','utf8');assert(tutorial.includes('Mac'));
console.log('PASS: iOS B/C shared UI, sports entry, native header spacing, creator link and Mac tutorial; manual update excluded');
