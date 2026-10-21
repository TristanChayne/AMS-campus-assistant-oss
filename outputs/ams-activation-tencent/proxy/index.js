// ADMIN-BE-001 cutover: the Tencent CloudBase function becomes a thin forwarder to the self-hosted AMS service, so
// installed apps that still call this domain keep activating, checking and reading the iOS configuration. The old
// database is no longer written. Deploy as function `ams-activation` (handler index.main, Node 20) with env
// AMS_TARGET=https://ams.tristanchayne.com and AMS_PROXY_KEY equal to the service's AMS_PROXY_KEY.
'use strict';
const MAX_BODY = 2 * 1024 * 1024;
const PASS_REQUEST = ['content-type', 'accept', 'user-agent'];
const PASS_RESPONSE = ['content-type', 'cache-control'];

exports.main = async function main(event) {
  const target = (process.env.AMS_TARGET || 'https://ams.tristanchayne.com').replace(/\/$/, '');
  const method = event.httpMethod || (event.requestContext && event.requestContext.httpMethod) || 'GET';
  const path = event.path || '/';
  // The old admin page moved: send people to the new console instead of proxying a cross-origin session.
  if (method === 'GET' && (path === '/' || path === '/admin' || path.startsWith('/admin'))) {
    return {statusCode: 302, headers: {Location: target + '/admin/', 'Cache-Control': 'no-store'}, body: '', isBase64Encoded: false};
  }
  if (!path.startsWith('/api/')) return json(404, {message: '找不到页面'});
  const query = event.queryStringParameters && Object.keys(event.queryStringParameters).length
    ? '?' + new URLSearchParams(event.queryStringParameters).toString() : '';
  const incoming = lower(event.headers || {});
  const headers = {};
  for (const name of PASS_REQUEST) if (incoming[name]) headers[name] = incoming[name];
  headers['x-ams-proxy-key'] = process.env.AMS_PROXY_KEY || '';
  headers['x-ams-client-ip'] = (event.requestContext && (event.requestContext.sourceIp || (event.requestContext.identity && event.requestContext.identity.sourceIp))) || 'unknown';
  let body;
  if (!['GET', 'HEAD'].includes(method)) {
    body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : Buffer.from(event.body || '', 'utf8');
    if (body.length > MAX_BODY) return json(413, {message: '请求过大'});
  }
  try {
    const response = await fetch(target + path + query, {method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(12000)});
    const out = {};
    for (const name of PASS_RESPONSE) { const v = response.headers.get(name); if (v) out[name] = v; }
    return {statusCode: response.status, headers: out, body: await response.text(), isBase64Encoded: false};
  } catch (e) {
    console.error('forward failed', path, e && (e.name || e.code));
    return json(503, {message: '服务暂时不可用，请稍后重试'});
  }
};

function lower(h) { const o = {}; for (const k of Object.keys(h)) o[k.toLowerCase()] = h[k]; return o; }
function json(status, data) {
  return {statusCode: status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}, body: JSON.stringify(data), isBase64Encoded: false};
}
