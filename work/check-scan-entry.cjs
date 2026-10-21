const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const script = fs.readFileSync('outputs/ams-android/app/src/main/assets/ams-scan-entry.js', 'utf8');
function setup(host = 'ams.xjtlu.edu.cn', path = '/studenth5/') {
  const listeners = [];
  const location = { protocol: 'https:', hostname: host, pathname: path, href: 'unchanged' };
  const context = { location, window: {}, document: { addEventListener: (...args) => listeners.push(args) } };
  vm.runInNewContext(script, context);
  return { context, listeners, location };
}
assert.equal(setup('uim.xjtlu.edu.cn').listeners.length, 0);
assert.equal(setup('example.com').listeners.length, 0);
assert.equal(setup('ams.xjtlu.edu.cn', '/studentpc/').listeners.length, 0);
const env = setup();
vm.runInNewContext(script, env.context);
assert.equal(env.listeners.length, 1);
assert.equal(env.listeners[0][2], true);
function click(trusted, scan) {
  let prevented = false, stopped = false;
  env.location.href = 'unchanged';
  env.listeners[0][1]({ isTrusted: trusted,
    target: { closest(selector) { assert.equal(selector, '.buttonbox.left-cancel');
      return scan ? { querySelector(selector) { assert.equal(selector, '.icon-erweima'); return {}; } } : null; } },
    preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
  return [env.location.href, prevented, stopped];
}
assert.deepEqual(click(false, true), ['unchanged', false, false]);
assert.deepEqual(click(true, false), ['unchanged', false, false]);
assert.deepEqual(click(true, true), ['ams-local://scan', true, true]);
console.log('PASS: origin/path gates, single installation, capture phase, trusted scan routing, unrelated clicks');
