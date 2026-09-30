/* Haven Hub — talks to one Haven's Apps Script backend.
   Which hub: ?hub=<deployment id>  →  HUB_CONFIG.defaultHub (forks)  →  the last hub used in this browser.
   Personal links (?u=&t=) are stored per hub and then removed from the address bar, so a copied URL never leaks a key. */
import { store, browserTz } from './ui.js';

const CFG = window.HUB_CONFIG || {};
export const HUB_RE = /^AKfy[\w-]{30,}$/;
export const params = new URLSearchParams(location.search);
export const DEMO = params.has('demo');
export const DEMO_HUB = 'AKfycbDEMOdemoDEMOdemoDEMOdemoDEMOdemo00000';
let hubId = '', demoSession = null, demoReady = null;

/** Accepts a deployment ID, a Web-app URL (…/macros/s/<id>/exec) or any hub link. */
export function hubFrom(s) {
  s = String(s || '').trim();
  const m = s.match(/\/macros\/s\/([\w-]+)\/(exec|dev)/);
  if (m && HUB_RE.test(m[1])) return m[1];
  try { const h = new URL(s).searchParams.get('hub'); if (h && HUB_RE.test(h)) return h; } catch (e) { /* not a URL */ }
  return HUB_RE.test(s) ? s : '';
}
/** A pasted personal link → { hub, u, t } (or null). */
export function parseLink(s) {
  try {
    const u = new URL(String(s || '').trim());
    const t = u.searchParams.get('t') || '';
    return t ? { hub: hubFrom(u.searchParams.get('hub') || '') || (CFG.defaultHub || ''), u: u.searchParams.get('u') || '', t } : null;
  } catch (e) { return null; }
}

export function resolve() {
  const q = params.get('hub') || params.get('api');
  if (DEMO) hubId = DEMO_HUB;
  else if (q && hubFrom(q)) hubId = hubFrom(q);
  else if (CFG.defaultHub && HUB_RE.test(CFG.defaultHub)) hubId = CFG.defaultHub;
  else hubId = store.get('hh:last') || '';
  if (!HUB_RE.test(hubId)) hubId = '';
  if (hubId && params.get('t')) setSession({ u: params.get('u') || '', t: params.get('t') });
  if (hubId && !DEMO) store.set('hh:last', hubId);
  // Clean address bar: keep ?hub= (so a copied URL opens the public page), drop the key.
  const want = new URLSearchParams(params);
  want.delete('t'); want.delete('u'); want.delete('api');
  if (hubId && !DEMO && !CFG.defaultHub) want.set('hub', hubId);
  const qs = want.toString();
  if (qs !== location.search.replace(/^\?/, '')) history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  return hubId;
}
export const hub = () => hubId;
export const urlFor = id => 'https://script.google.com/macros/s/' + id + '/exec';
export const siteUrl = () => (location.origin + location.pathname).replace(/\/index\.html$/, '').replace(/\/$/, '');
export const publicUrl = () => siteUrl() + '/' + (CFG.defaultHub && hubId === CFG.defaultHub ? '' : '?hub=' + hubId);

export function session() { return DEMO ? demoSession : store.json('hh:s:' + hubId, null); }
export function setSession(s) { if (DEMO) { demoSession = s; return; } store.set('hh:s:' + hubId, JSON.stringify(s)); store.del('hh:c:' + hubId); }
export function signOut() { if (DEMO) { demoSession = null; return; } store.del('hh:s:' + hubId); store.del('hh:c:' + hubId); }
export function forgetHub() { signOut(); store.del('hh:last'); }
/** Last dashboard payload for this hub + person, shown instantly while fresh data loads. */
export function cached() { const s = session(), c = !DEMO && store.json('hh:c:' + hubId, null); return c && s && c.me && c.me.key === s.u ? c : null; }
export function cache(D) { if (!DEMO) store.set('hh:c:' + hubId, JSON.stringify(D)); }

async function parse(r) {
  const txt = await r.text();
  try { return JSON.parse(txt); }
  catch (e) { return { ok: false, code: 'network', error: /<html/i.test(txt) ? 'The hub answered with a web page instead of data. Check that the web app is deployed with access "Anyone".' : 'Unexpected answer from the hub.' }; }
}
const offline = { ok: false, code: 'network', error: 'Could not reach the hub. Check your internet connection and try again.' };

export async function getFrom(id, action, extra) {
  const q = Object.assign({ action }, extra || {});
  if (DEMO) return demoCall('GET', q);
  try { return await parse(await fetch(urlFor(id) + '?' + new URLSearchParams(q), { cache: 'no-store' })); } catch (e) { return offline; }
}
export async function postTo(id, action, body) {
  const b = Object.assign({ action }, body || {});
  if (DEMO) return demoCall('POST', b);
  try { return await parse(await fetch(urlFor(id), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(b) })); } catch (e) { return offline; }
}
const withKey = o => { const s = session(); return Object.assign({}, o, s ? { u: s.u, t: s.t } : {}); };
export const get = (action, extra) => getFrom(hubId, action, withKey(extra));
export const post = (action, body) => postTo(hubId, action, withKey(body));
export const getPublic = (action, extra) => getFrom(hubId, action, extra);
export const postPublic = (action, body) => postTo(hubId, action, body);

// ------------------------------------------------------------------ dev mock: ?demo=1 runs the REAL Code.gs in the browser
// Only works when the repo root is served (it loads ../apps-script/Code.gs and ../dev/*). ?demo=fresh starts un-set-up.
export async function ready() { if (DEMO) await demo(); }
async function demo() {
  if (demoReady) return demoReady;
  demoReady = (async () => {
    const [fakes, code, data] = await Promise.all([import('../../dev/gas-fakes.js'), fetch('../apps-script/Code.gs').then(r => r.text()), import('../../dev/demo-data.js')]);
    const gas = fakes.createGas({ tz: browserTz() }), be = fakes.loadBackend(code, gas);
    const people = params.get('demo') === 'fresh' ? {} : data.seed(be, gas, DEMO_HUB);
    demoSession = people[params.get('as') || 'admin'] || null;
    window.__hub = { be, gas, people, sheetUrl: gas._ss.getUrl() };
    return be;
  })();
  return demoReady;
}
async function demoCall(method, q) {
  const be = await demo();
  await new Promise(r => setTimeout(r, 150));
  return JSON.parse(JSON.stringify(method === 'GET' ? be.get(q) : be.post(q)));
}
export const demoSheetUrl = () => (window.__hub && window.__hub.sheetUrl) || '';
