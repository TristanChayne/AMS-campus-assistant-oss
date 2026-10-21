const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const html = fs.readFileSync('work/live-ui.html', 'utf8');
const child = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const asset = fs.readFileSync('outputs/ams-android/app/src/main/assets/ams-modern-ui.js', 'utf8');
new vm.Script(child);
new vm.Script(asset);
const buttons = ['system', 'light', 'dark'].map(mode => ({dataset: {appearance: mode}, setAttribute(k, v) {this[k] = v;}}));
let dark = false;const select={textContent:''};
const ctx = {settingsData: {}, document: {
  documentElement: {classList: {toggle(name, value) {assert.equal(name, 'ams-dark'); dark = value;}}},
  querySelectorAll() {return buttons;}, getElementById() {return select;}
}};
vm.createContext(ctx);
vm.runInContext(child.slice(child.indexOf('const appearanceNames='), child.indexOf('function scan()')), ctx);
for (const [mode, value] of [['system', true], ['system', false], ['dark', true], ['light', false]]) {
  ctx.applyAppearance(mode, value);
  assert.equal(dark, value);
  assert.equal(ctx.settingsData.appearance, mode);
  assert.equal(select.textContent,{system:'跟随系统',light:'浅色',dark:'深色'}[mode]);for(const button of buttons)assert.equal(button['aria-pressed'],String(button.dataset.appearance===mode));
}
assert(child.includes('if(!data.route)return;'));
assert(child.includes("send('appearance',{appearance:b.dataset.appearance})"));
assert(asset.includes("['system','light','dark'].includes(e.data.appearance)"));
assert(asset.includes("if(window.__amsAppearance)window.__amsSetAppearance"));
const css = fs.readFileSync('work/managed-ui-polish.css', 'utf8');
assert(css.includes('background-color 300ms ease'));
assert(css.includes('prefers-reduced-motion:no-preference'));
assert(!css.includes('@media(prefers-color-scheme:dark)'));
const java = fs.readFileSync('outputs/ams-android/app/src/main/java/cn/local/ams/MainActivity.java', 'utf8');
const handler = java.slice(java.indexOf('@Override public void onConfigurationChanged'), java.indexOf('private boolean schoolPage'));
assert(handler.includes('updateAppearance(true)'));
assert(!/loadUrl|recreate|reload|new WebView/.test(handler));
assert(java.includes('getSharedPreferences("amsAppearance", MODE_PRIVATE).edit().putString("mode", mode).apply()'));
assert(fs.readFileSync('outputs/ams-android/app/src/main/AndroidManifest.xml', 'utf8').includes('android:configChanges="uiMode"'));
assert(html.includes('AMS 校园助手 · 0.14.1'));
console.log('PASS appearance selection, live class/pressed-state updates, appearance-only messages, native persistence, no recreation/reload, transition and current version.');
