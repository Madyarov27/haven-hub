/* Haven Hub — boot, routing and the app shell (sidebar + top bar). */
import * as api from './api.js';
import { $, $$, esc, icon, toast, avatar, first, layerOpen, daysTo, skeleton, store } from './ui.js';
import { landing } from './views/landing.js';
import { setup } from './views/setup.js';
import { publicPage, signin } from './views/public.js';
import * as member from './views/member.js';
import { overview } from './views/admin-overview.js';
import { tasksAdmin } from './views/admin-tasks.js';
import { people } from './views/admin-people.js';
import { review } from './views/admin-review.js';
import { timeline, scores } from './views/admin-timeline.js';
import { applications } from './views/admin-applications.js';
import { content } from './views/admin-content.js';
import { settings } from './views/admin-settings.js';

const CFG = window.HUB_CONFIG || {};
const root = $('#root');
const ALL = ['admin', 'lead', 'member', 'viewer'], DOERS = ['admin', 'lead', 'member'], LEADS = ['admin', 'lead'];
const NAV = [
  { g: 'Dashboard', r: 'admin', t: 'Overview', i: 'grid', roles: ['admin', 'lead', 'viewer'], v: overview },
  { g: 'Dashboard', r: 'admin/tasks', t: 'All tasks', i: 'list', roles: LEADS, v: tasksAdmin },
  { g: 'Dashboard', r: 'admin/review', t: 'Review', i: 'image', roles: LEADS, v: review, n: D => (D.all || []).filter(t => t.status === 'Done' && !t.review && t.proof && t.owner !== D.me.key).length },
  { g: 'Dashboard', r: 'admin/timeline', t: 'Timeline', i: 'clock', roles: ['admin', 'lead', 'viewer'], v: timeline },
  { g: 'Dashboard', r: 'admin/scores', t: 'Scorecards', i: 'award', roles: ['admin', 'lead', 'viewer'], v: scores },
  { g: 'Me', r: 'tasks', t: 'My tasks', i: 'check', roles: DOERS, v: member.myTasks, n: D => (D.tasks || []).filter(t => !['Done', 'Dropped'].includes(t.status) && t.due < D.now).length },
  { g: 'Me', r: 'calendar', t: 'Calendar', i: 'calendar', roles: ALL, v: member.calendar },
  { g: 'Me', r: 'team', t: 'Team', i: 'users', roles: ALL, v: member.team },
  { g: 'Me', r: 'rules', t: 'Rules', i: 'book', roles: DOERS, v: member.rules },
  { g: 'Me', r: 'profile', t: 'Profile', i: 'user', roles: ALL, v: member.profile },
  { g: 'Manage', r: 'admin/people', t: 'People', i: 'userPlus', roles: ['admin'], v: people },
  { g: 'Manage', r: 'admin/applications', t: 'Applications', i: 'inbox', roles: ['admin'], v: applications, n: D => (D.applications || []).filter(a => a.status === 'new').length },
  { g: 'Manage', r: 'admin/content', t: 'Meetings, rules & sponsors', i: 'file', roles: ['admin'], v: content },
  { g: 'Manage', r: 'admin/settings', t: 'Settings', i: 'settings', roles: ['admin'], v: settings },
];

let loading = false;
const route = () => location.hash.replace(/^#\/?/, '').split('?')[0].replace(/\/$/, '');
const role = () => (ctx.D && ctx.D.me && ctx.D.me.access) || 'member';
const vcmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

export const ctx = {
  D: null, api, cfg: CFG, el: null, dirty: false, loadedAt: 0,
  get tz() { return (this.D && this.D.tz) || 'UTC'; },
  get me() { return this.D && this.D.me; },
  get isLead() { return LEADS.includes(role()); },
  get isAdmin() { return role() === 'admin'; },
  get isViewer() { return role() === 'viewer'; },
  go(r) { if (route() === r) render(); else location.hash = '#/' + r; },
  render: () => render(),
  refresh: (o) => load(o),
  nameOf(k) { const p = ((this.D && (this.D.people || this.D.team)) || []).find(x => x.key === k); return p ? p.name : k; },
  /** Replace a task in every local list after the server returns it. */
  patchTask(t) {
    const D = this.D;
    [D.tasks, D.all].forEach(list => { if (!list) return; const i = list.findIndex(x => x.id === t.id); if (i >= 0) list[i] = t; else if (list === D.all) list.push(t); });
    if (D.tasks && t.owner === D.me.key && !D.tasks.some(x => x.id === t.id)) D.tasks.push(t);
    if (D.tasks && t.owner !== D.me.key) D.tasks = D.tasks.filter(x => x.id !== t.id);
    api.cache(D);
  },
  removeTasks(ids) { const D = this.D; D.all = (D.all || []).filter(t => !ids.includes(t.id)); D.tasks = D.tasks.filter(t => !ids.includes(t.id)); api.cache(D); },
  setActions(html) { const a = $('#top-actions'); if (a) a.innerHTML = html || ''; return a; },
};

// ------------------------------------------------------------------ boot + data
async function boot() {
  window.addEventListener('hashchange', () => { closeNav(); render(); window.scrollTo(0, 0); });
  window.addEventListener('focus', () => { if (ctx.D && Date.now() - ctx.loadedAt > 60e3) load({ silent: true }); });
  try { await api.ready(); } catch (e) { root.innerHTML = `<div class="boot">Demo mode needs the repo root served (npx serve .) — ${esc(e.message)}</div>`; return; }
  api.resolve();
  if (api.hub() && api.session()) ctx.D = api.cached();
  render(); // with no data yet, render() starts the load itself
  if (ctx.D) await load({ silent: true });
}
async function load(opts = {}) {
  if (!api.session()) return render();
  const D = await api.get('me', { hub: api.hub() });
  if (!D.ok) {
    if (D.code === 'auth') { api.signOut(); ctx.D = null; return signin(root, ctx, { error: D.error, username: D.username, password: D.reason === 'password' || D.reason === 'session' }); }
    if (ctx.D) { if (!opts.silent) toast(D.error, 'err'); return; }
    return fatal(D.error, D.code);
  }
  if (!D.version) return outdated();
  ctx.D = D; ctx.loadedAt = Date.now(); api.cache(D);
  if (layerOpen()) { ctx.dirty = true; return; } // don't redraw under an open drawer; redraw when it closes
  if (opts.keepScroll !== false) { const y = window.scrollY; render(); window.scrollTo(0, y); } else render();
}
function fatal(msg, code) {
  root.innerHTML = `<div class="wiz"><div class="card"><h2>Can't open the Team Hub</h2><p class="muted">${esc(msg)}</p>
    ${code === 'network' ? '<p class="small muted">If this keeps happening, the hub\'s owner should check that the web app is deployed with access <b>Anyone</b>.</p>' : ''}
    <div class="row"><button class="btn primary" id="retry">${icon('refresh')} Try again</button><button class="btn ghost" id="other">Sign in differently</button></div></div></div>`;
  $('#retry').onclick = () => location.reload();
  $('#other').onclick = () => { api.signOut(); ctx.D = null; location.hash = '#/signin'; render(); };
}
function outdated() {
  root.innerHTML = `<div class="wiz"><div class="card"><h2>This hub needs an update</h2>
    <p>The website was updated, but this hub's backend (Code.gs in the Google Sheet) is still the old version.</p>
    <p class="muted">Ask your hub admin to paste the new <b>Code.gs</b> and deploy a new version — it takes two minutes and keeps all your data and links.</p>
    <a class="btn primary" href="${esc(CFG.repo || '')}/blob/main/setup.md#updating" target="_blank" rel="noopener">How to update ${icon('external')}</a></div></div>`;
}

// ------------------------------------------------------------------ render
function render() {
  const r = route();
  if (r === 'setup') return setup(root, ctx);
  if (!api.hub()) return landing(root, ctx);
  if (!api.session()) return r === 'signin' ? signin(root, ctx) : publicPage(root, ctx, { join: r === 'join' });
  if (r === 'signin') { history.replaceState(null, '', location.pathname + location.search + '#/'); return render(); } // already signed in: messages link here
  if (!ctx.D) {
    root.innerHTML = `<div class="app"><aside class="side"></aside><div class="main"><div class="top"><h1>Loading…</h1></div><div class="content">${skeleton(4)}</div></div></div>`;
    if (!loading) { loading = true; load().finally(() => { loading = false; }); }
    return;
  }
  const me = role(), home = me === 'member' ? 'tasks' : 'admin';
  let item = NAV.find(n => n.r === (r || home));
  if (!item || !item.roles.includes(me)) item = NAV.find(n => n.r === home);
  shell(item);
  ctx.el = $('#view');
  ctx.setActions('');
  try { item.v(ctx); }
  catch (e) { console.error(e); ctx.el.innerHTML = `<div class="banner bad">${icon('alert')}<div>Something broke on this page: ${esc(e.message)}. Reload, and tell your hub admin if it keeps happening.</div></div>`; }
}

function shell(item) {
  const D = ctx.D, me = D.me, ev = D.event || {}, r = role();
  const groups = [...new Set(NAV.map(n => n.g))];
  const nav = groups.map(g => {
    const items = NAV.filter(n => n.g === g && n.roles.includes(r));
    if (!items.length) return '';
    return `<div class="nav-g">${esc(g === 'Me' && r === 'viewer' ? 'Info' : g)}</div>` + items.map(n => {
      const c = n.n ? n.n(D) : 0;
      return `<a class="nav-i ${n === item ? 'on' : ''}" href="#/${n.r}" ${n === item ? 'aria-current="page"' : ''}>${icon(n.i)}<span>${esc(n.t)}</span>${c ? `<span class="cnt">${c}</span>` : ''}</a>`;
    }).join('');
  }).join('');
  const days = daysTo(ev.start, ctx.tz), chip = days == null ? '' : days > 1 ? `${days} days to go` : days === 1 ? 'Tomorrow!' : days === 0 ? 'It\'s today!' : (daysTo(ev.end, ctx.tz) >= 0 ? 'Event weekend!' : 'Event finished');
  const banners = [];
  if (r === 'admin' && CFG.latestBackend && vcmp(D.version, CFG.latestBackend) < 0) banners.push(`<div class="banner info">${icon('zap')}<div>Backend update available: you run v${esc(D.version)}, the latest is v${esc(CFG.latestBackend)}. <a href="${esc(CFG.repo)}/blob/main/setup.md#updating" target="_blank" rel="noopener">How to update (2 min)</a></div></div>`);
  if (r === 'admin' && D.settings && (!D.settings.hub_id || /^Haven$/i.test(D.settings.event_name || ''))) banners.push(`<div class="banner">${icon('alert')}<div>Finish your setup: give the event its name and check the dates in <a href="#/admin/settings">Settings</a>.</div></div>`);
  if (D.accounts && !D.me.account && r !== 'viewer' && !api.passwordSession() && !(route() === 'profile') && Number(store.get('hh:nudge:' + api.hub()) || 0) < Date.now())
    banners.push(`<div class="banner info" id="nudge">${icon('user')}<div><b>Make your password</b> — then you can sign in on any phone or computer with a username and password. <a href="#/profile">Make it now</a> <button class="linkbtn" id="nudge-x">later</button></div></div>`);
  if (api.DEMO) banners.push(`<div class="banner info">${icon('eye')}<div>Demo mode — made-up data, nothing is saved. Try <a href="?demo=1&as=admin">admin</a> · <a href="?demo=1&as=lead">lead</a> · <a href="?demo=1&as=member">member</a> · <a href="?demo=1&as=viewer">guest viewer</a> · <a href="?demo=1&as=guest">public page</a> · <a href="?demo=fresh#/setup">setup</a></div></div>`);
  root.innerHTML = `<div class="app" id="app">
    <aside class="side" aria-label="Main navigation">
      <a class="side-brand" href="#/"><img src="assets/logo-white.png" alt="Hack Club Haven" width="118" height="76"><span class="ev">${esc(ev.name || 'Haven')} · Team Hub</span></a>
      <nav>${nav}</nav>
      <div class="side-foot">${avatar(me.name)}<div class="who"><b>${esc(me.name)}</b><span>${esc(me.role || me.access)}</span></div>
        <button class="icon-btn" id="signout" title="Sign out" aria-label="Sign out">${icon('logout')}</button></div>
    </aside>
    <div class="main">
      <header class="top">
        <button class="icon-btn burger" id="burger" aria-label="Open menu">${icon('menu')}</button>
        <h1>${esc(item.t)}</h1>
        <div class="top-r"><span id="top-actions" class="row"></span>${chip ? `<span class="chip" title="${esc(ev.name)} starts ${esc(ev.start)}">${icon('flag')} ${esc(chip)}</span>` : ''}
          <div class="rel"><button class="icon-btn" id="usermenu" aria-haspopup="true" aria-expanded="false" aria-label="Account menu">${avatar(me.name, 'sm')}</button></div></div>
      </header>
      <main class="content" id="content" tabindex="-1">${banners.join('')}<div id="view"></div></main>
    </div></div>`;
  $('#burger').onclick = () => $('#app').classList.toggle('nav-open');
  $('#app').addEventListener('click', e => { if (e.target === $('#app') && $('#app').classList.contains('nav-open')) closeNav(); });
  $('#signout').onclick = signOut;
  const nx = $('#nudge-x'); if (nx) nx.onclick = () => { store.set('hh:nudge:' + api.hub(), String(Date.now() + 3 * 864e5)); $('#nudge').remove(); };
  $('#usermenu').onclick = e => { e.stopPropagation(); userMenu(e.currentTarget); };
}
function closeNav() { const a = $('#app'); if (a) a.classList.remove('nav-open'); }
function userMenu(btn) {
  const old = $('.menu'); if (old) { old.remove(); btn.setAttribute('aria-expanded', 'false'); return; }
  const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu');
  m.innerHTML = `<div class="small muted" style="padding:6px 10px">${esc(ctx.me.name)} · ${esc(ctx.me.access)}</div><hr>
    <a href="#/profile" role="menuitem">${icon('user')} Profile & notifications</a>
    <a href="${esc(api.publicUrl())}" target="_blank" rel="noopener" role="menuitem">${icon('globe')} Public page</a>
    <button role="menuitem" data-m="refresh">${icon('refresh')} Refresh data</button><hr>
    <button role="menuitem" class="danger" data-m="out">${icon('logout')} Sign out</button>`;
  btn.parentElement.appendChild(m); btn.setAttribute('aria-expanded', 'true');
  const off = e => { if (!m.contains(e.target)) { m.remove(); btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', off); } };
  setTimeout(() => document.addEventListener('click', off));
  m.onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; m.remove(); if (b.dataset.m === 'out') signOut(); if (b.dataset.m === 'refresh') load({ silent: false }).then(() => toast('Up to date.')); };
}
function signOut() {
  const pw = api.passwordSession();
  api.signOut(); ctx.D = null;
  toast(pw ? 'Signed out.' : 'Signed out. Your personal link still works — open it again to come back.');
  location.hash = '#/'; render();
}
// redraw after a drawer closes if fresh data arrived meanwhile
document.addEventListener('hh:layerclose', () => { if (ctx.dirty && !layerOpen()) { ctx.dirty = false; const y = window.scrollY; render(); window.scrollTo(0, y); } });

boot();
