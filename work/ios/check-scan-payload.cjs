const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync('work/ios/scan-payload.js', 'utf8');
assert.equal(fs.readFileSync('outputs/ams-ios/Assets/ios-scan-payload.js', 'utf8'), source);
let calls = [];
const home = {$options:{name:'home'}, $route:{path:'/home'}, onSubmit(code){calls.push(code)}, $children:[]};
const context = {window:{}, location:{protocol:'https:', hostname:'ams.xjtlu.edu.cn', pathname:'/studenth5/'}, document:{querySelectorAll(){return [{__vue__:home}]}}};
vm.runInNewContext(fs.readFileSync('outputs/ams-ios/Assets/ams-submit-scan.js', 'utf8'), context);
vm.runInNewContext(source, context);
// Reproduce the old iOS bug: the shared handler accepts the entire URL unchanged.
const payload = 'https://ams.xjtlu.edu.cn/?code=MOCK_ONLY';
assert.equal(context.window.__amsSubmitScan(payload), 'submitted');
assert.deepEqual(calls, [payload]); calls = [];
const submit = context.window.__amsSubmitScanPayload;
assert.equal(submit(payload), 'submitted'); assert.deepEqual(calls, ['MOCK_ONLY']);
for (const invalid of ['', 'MOCK_ONLY', 'https://ams.xjtlu.edu.cn/', 'code=', null, 'code='+'x'.repeat(2049)]) {
    assert.equal(submit(invalid), 'invalid-payload');
}
assert.equal(calls.length, 1);
// Preserve the established school/Android extraction exactly, including extra '='.
assert.equal(submit('code=MOCK_ONLY=extra'), 'submitted'); assert.equal(calls[1], 'MOCK_ONLY');
home.$route.path = '/leave'; assert.equal(submit(payload), 'unavailable'); assert.equal(calls.length, 2);
home.$route.path = '/home'; home.onSubmit = () => {calls.push('throw'); throw Error('mock')};
assert.equal(submit(payload), 'handler-error'); assert.equal(calls.length, 3);
const native = fs.readFileSync('outputs/ams-ios/Sources/CampusController.swift', 'utf8');
assert(native.includes('"ios-scan-payload"'));
assert(native.includes('window.__amsSubmitScanPayload(\\(array)[0])'));
console.log('PASS: reproduced raw URL bug; extracted payload, invalid/oversize rejection, Android parity, route gating, one call on handler failure; no real submissions');
