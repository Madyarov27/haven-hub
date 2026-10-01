/* Haven Hub on your own server: runs apps-script/Code.gs unchanged on Node, plus the website, the Telegram webhook,
   the one-time import from a Google Sheet, a scheduler (reminders, weekly report, backups) and admin commands. */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync, rmSync, cpSync, createReadStream } from 'node:fs';
import { join, extname, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { openStore } from './store.mjs';
import { createRuntime } from './runtime.mjs';
import { createTelegram, createMailer, drainOutbox } from './outbox.mjs';
import { createAccounts, SESSION_RE, usernameProblem, passwordProblem } from './accounts.mjs';
import { createLibrary } from './library.mjs';
import { loadBackend } from '../dev/gas-fakes.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://raw.githubusercontent.com https://api.github.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const same = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && x.length > 0 && timingSafeEqual(x, y); };
const code24 = () => randomBytes(18).toString('base64url');

export async function createHub(opts = {}) {
  const dataDir = resolve(opts.dataDir || join(ROOT, 'data'));
  const filesDir = join(dataDir, 'files'), backupDir = resolve(opts.backupDir || join(dataDir, '..', 'backups'));
  [dataDir, filesDir].forEach(d => mkdirSync(d, { recursive: true }));
  const log = opts.log || ((...a) => console.log(new Date().toISOString(), ...a));
  const env = Object.assign({ TG_PATH: 'hook', TG_SECRET: '' }, opts.env || {});
  env.publicUrl = () => String(env.PUBLIC_URL || (env.PUBLIC_URL_FILE && existsSync(env.PUBLIC_URL_FILE) ? readFileSync(env.PUBLIC_URL_FILE, 'utf8').trim() : '')).replace(/\/+$/, '');
  const store = openStore(join(dataDir, 'hub.db'));
  if (!env.TG_SECRET) { env.TG_SECRET = store.getMeta('tg_secret') || code24(); store.setMeta('tg_secret', env.TG_SECRET); }
  if (env.TG_PATH === 'hook') { env.TG_PATH = store.getMeta('tg_path') || code24(); store.setMeta('tg_path', env.TG_PATH); }
  const telegram = createTelegram({ fetchImpl: opts.fetch || fetch, env, log });
  const mailer = createMailer({ env, transport: opts.mailTransport });
  const runtime = createRuntime({ store, filesDir, env, telegram });
  const accounts = createAccounts({ store });
  const library = opts.library || createLibrary({ dataDir, log });
  const started = Date.now();
  // the website may live elsewhere (e.g. GitHub Pages) and call this server's /api — allow those origins
  const origins = String(env.ALLOWED_ORIGINS || 'https://notazizelse.github.io').split(/[\s,]+/).filter(Boolean);
  const linkBase = () => String(env.SITE_URL || env.publicUrl() || '').replace(/\/+$/, '');
  const home = () => linkBase() + (env.HUB_NAME ? '/?hub=' + env.HUB_NAME : '');

  const hubServer = {
    publicUrl: () => env.publicUrl(),
    webhookUrl: () => telegram.webhookUrl(),
    setWebhook: () => { pendingWebhook = true; },
    checkSetupCode: c => { const ok = same(c, store.getMeta('setup_code')) && Number(store.getMeta('setup_code_exp', 0)) > Date.now(); if (ok) store.delMeta('setup_code'); return ok; },
    account: key => accounts.info(key),   // password sign-in (Code.gs: account_, dropAccount_)
    dropAccount: key => accounts.drop(key),
    stats: () => ({ uptimeMin: Math.round((Date.now() - started) / 6e4), outbox: store.outboxStats(), lastBackup: store.getMeta('last_backup', ''), publicUrl: env.publicUrl(), email: mailer.configured() }),
  };
  let pendingWebhook = false;
  const buckets = new Map(); // rate limits: what+ip → { n, t }
  const code = opts.code || readFileSync(join(ROOT, 'apps-script', 'Code.gs'), 'utf8');
  const be = loadBackend(code, runtime.gas, { HUB_SERVER: hubServer });

  // ------------------------------------------------------------------ one request at a time (Code.gs is synchronous, like Apps Script)
  let queue = Promise.resolve();
  const run = fn => { const p = queue.then(() => runtime.withTx(fn)); queue = p.catch(() => {}); return p.finally(afterRequest); };
  const afterRequest = () => {
    if (pendingWebhook) { pendingWebhook = false; telegram.setWebhook(store.getProp('BOT_TOKEN')).catch(e => log('webhook: ' + e.message)); }
    kick();
  };
  let draining = false;
  const kick = () => {
    if (draining) return; draining = true;
    setTimeout(async () => { try { while (await drainOutbox({ store, telegram, mailer, filesDir, log })) { /* keep going */ } } catch (e) { log('outbox: ' + e.message); } finally { draining = false; } }, 0);
  };
  const call = (fn, ...args) => run(() => { be.call('resetMemo_'); return be.call(fn, ...args); });

  // ------------------------------------------------------------------ API
  const PRE = { // things Code.gs reads synchronously that need a network call first
    'tg.setToken': async b => { if (b.token) await telegram.refresh(String(b.token).trim()).catch(() => {}); },
    botinfo: async () => telegram.refresh(store.getProp('BOT_TOKEN')).catch(() => {}),
  };
  async function api(method, params, ip = '') {
    if (ACCOUNT[params.action]) return method === 'POST' ? ACCOUNT[params.action](params, ip) : { ok: false, error: 'Use POST.' };
    if (PRE[params.action]) await PRE[params.action](params);
    const out = await run(() => { const no = signedIn(params); return no || (method === 'GET' ? be.get(params) : be.post(params)); });
    if (params.action === 'tg.setToken' && out.ok) pendingWebhook = true;
    if (params.action === 'files.list' && out.ok) { // the team files repo, from this server's mirror
      Object.assign(out, library.listing(out.files));
      if (!out.tree && out.files.repo) library.sync(out.files.repo, out.files.branch).catch(() => {});
    }
    return out;
  }

  // ------------------------------------------------------------------ password sign-in (server only; see accounts.mjs)
  const signedOut = { ok: false, code: 'auth', reason: 'session', error: 'You were signed out. Sign in again.' };
  const useYourPassword = username => ({ ok: false, code: 'auth', reason: 'password', username, error: 'You sign in with your password now — your old link was switched off.' });
  const person = (fn, arg) => { be.call('resetMemo_'); const p = be.call(fn, arg); return p && p.active !== 'no' ? p : null; };
  /** Runs inside the request: a session id becomes the person's token for Code.gs; the link of someone who made a password is refused. */
  function signedIn(params) {
    const t = String(params.t || '');
    if (!t) return null;
    if (SESSION_RE.test(t)) {
      const key = accounts.session(t), p = key && person('findPerson_', key);
      if (!p || !p.token || !accounts.info(p.key)) return signedOut;
      params.t = p.token; params.u = p.key;
      return null;
    }
    const p = person('person_', t), acc = p ? accounts.info(p.key) : accounts.retired(t);
    return acc ? useYourPassword(acc.username) : null;
  }
  const ACCOUNT = {
    /** From a working personal link: make a username + password. Every old link stops working; this device stays signed in. */
    async 'account.create'(b) {
      const username = String(b.username || '').trim().toLowerCase(), password = String(b.password || '');
      const who = await run(() => {
        const p = SESSION_RE.test(String(b.t || '')) ? null : person('person_', String(b.t || ''));
        return p && (!b.u || b.u === p.key) ? { key: p.key, viewer: be.call('access_', p) === 'viewer' } : null;
      });
      if (!who) return { ok: false, code: 'auth', error: 'Open your personal link first, then make your account.' };
      if (who.viewer) return { ok: false, error: "Guest links don't use passwords." };
      if (accounts.info(who.key)) return { ok: false, error: 'You already have an account — change your password in Profile.' };
      const bad = usernameProblem(username) || passwordProblem(password, username);
      if (bad) return { ok: false, error: bad };
      if (store.accountByName(username)) return { ok: false, error: 'That username is taken — pick another one.' };
      const save = await accounts.create(who.key, username, password, String(b.t));
      const err = await run(() => { const e = save(); if (!e) { be.call('resetMemo_'); be.call('rotateToken_', who.key); } return e; });
      if (err) return { ok: false, error: err };
      return { ok: true, u: who.key, t: accounts.newSession(who.key), username };
    },
    /** Username (or the email in People) + password → a session for this device. */
    async login(b, ip) {
      if (limited(ip, 'login', 30, 15 * 60e3)) return { ok: false, error: 'Too many tries from here — wait 15 minutes.' };
      const name = String(b.username || '').trim().toLowerCase(), password = String(b.password || '');
      if (!name || !password) return { ok: false, error: 'Write your username and your password.' };
      let a = store.accountByName(name);
      if (!a && name.includes('@')) {
        const key = await run(() => { be.call('resetMemo_'); const p = be.call('activePeople_').find(q => String(q.email || '').toLowerCase() === name); return p ? p.key : ''; });
        a = key ? store.getAccount(key) : null;
      }
      const r = await accounts.login(a, password);
      if (!r.ok) return r;
      const p = await run(() => { const x = person('findPerson_', r.key); if (x && x.token) be.call('log_', x.name, '', 'Signed in', 'password'); return x && x.token ? { key: x.key } : null; });
      if (!p) { accounts.drop(r.key); return { ok: false, error: 'Wrong username or password.' }; }
      return { ok: true, u: p.key, t: accounts.newSession(p.key) };
    },
    /** Signed in: current password + a new one. Every other device is signed out. */
    async 'account.password'(b) {
      const key = accounts.session(b.t);
      if (!key) return signedOut;
      const err = await accounts.setPassword(key, String(b.current || ''), String(b.password || ''));
      if (err) return { ok: false, error: err };
      accounts.endOtherSessions(key, b.t);
      await run(() => { const x = person('findPerson_', key); if (x) be.call('log_', x.name, '', 'Password changed', ''); });
      return { ok: true };
    },
    async logout(b) { accounts.endSession(b.t); return { ok: true }; },
    async 'logout.all'(b) { const key = accounts.session(b.t); if (!key) return signedOut; accounts.endOtherSessions(key, ''); return { ok: true }; },
  };

  // ------------------------------------------------------------------ one-time import from a Google Sheet (Haven Hub → Move this hub to my own server…)
  const importOk = c => same(c, store.getMeta('import_code')) && Number(store.getMeta('import_code_exp', 0)) > Date.now();
  const hasPeople = () => { const p = runtime.spreadsheet().getSheetByName('People'); return !!p && p.getLastRow() > 1; };
  async function importStart(b) {
    if (!importOk(b.code)) return { ok: false, error: 'Wrong or expired import code. On the server run: hubctl import-code' };
    if (hasPeople()) return { ok: false, error: 'This server already has a hub. Import only works into an empty one.' };
    if (!env.publicUrl()) return { ok: false, error: 'The server does not know its public address yet (PUBLIC_URL in .env).' };
    const bundle = b.bundle || {};
    if (!bundle.sheets || !bundle.sheets.People) return { ok: false, error: 'The import has no People tab.' };
    const id = code24();
    await run(() => {
      runtime.replaceSheets(bundle.sheets);
      Object.entries(bundle.props || {}).forEach(([k, v]) => { if (['BOT_TOKEN', 'BOT_USERNAME', 'GROUP_CHAT_ID', 'GROUP_THREAD_ID', 'PROOF_FOLDER_ID'].includes(k)) store.setProp(k, v); });
      if (bundle.props && bundle.props.PROOF_FOLDER_ID) store.addFolder(bundle.props.PROOF_FOLDER_ID, 'Team Hub proof files');
      store.setMeta('import_id', id);
    });
    log('import started: ' + Object.keys(bundle.sheets).join(', '));
    return { ok: true, importId: id };
  }
  async function importFiles(b) {
    if (!importOk(b.code) || !same(b.importId, store.getMeta('import_id'))) return { ok: false, error: 'Wrong import code.' };
    const folder = store.getProp('PROOF_FOLDER_ID');
    let n = 0;
    for (const f of b.files || []) {
      if (!/^[\w-]{10,}$/.test(String(f.id))) continue;
      const bytes = Buffer.from(String(f.data || ''), 'base64');
      writeFileSync(join(filesDir, f.id), bytes);
      store.addFile({ id: f.id, folder, name: String(f.name || f.id).slice(0, 120), mime: String(f.mime || 'application/octet-stream'), descr: String(f.desc || ''), size: bytes.length });
      n++;
    }
    return { ok: true, count: n };
  }
  async function importFinish(b) {
    if (!importOk(b.code) || !same(b.importId, store.getMeta('import_id'))) return { ok: false, error: 'Wrong import code.' };
    const res = await run(() => {
      be.call('upgrade');
      be.call('saveSettingsRaw_', { site_url: linkBase(), hub_id: env.HUB_NAME || '', moved_to: '' });
      be.call('refreshLinks');
      const people = be.call('activePeople_').length, tasks = be.call('rows_', 'Tasks').length;
      be.call('log_', 'system', '', 'Imported from Google Sheets', `${people} people, ${tasks} tasks`);
      return { people, tasks, bot: store.getProp('BOT_USERNAME') || '' };
    });
    ['import_code', 'import_code_exp', 'import_id'].forEach(k => store.delMeta(k));
    if (store.getProp('BOT_TOKEN')) await telegram.setWebhook(store.getProp('BOT_TOKEN')).catch(e => log('webhook: ' + e.message));
    log(`import finished: ${res.people} people, ${res.tasks} tasks`);
    return Object.assign({ ok: true, home: home() }, res);
  }

  // ------------------------------------------------------------------ Telegram webhook
  async function webhook(update) {
    await run(() => { be.call('resetMemo_'); try { be.call('handleUpdate_', update); } catch (e) { be.call('botLog_', 'handler', String(e)); } });
  }

  // ------------------------------------------------------------------ scheduler: reminders, weekly report, weekly export, nightly backup, bot check
  let lastBotCheck = 0;
  async function tick(now = new Date()) {
    let S, tz, ready;
    await run(() => { be.call('resetMemo_'); ready = be.call('hasAdmin_'); tz = be.call('tz_'); S = be.call('S_'); });
    const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(now).forEach(x => { p[x.type] = x.value; });
    const day = `${p.year}-${p.month}-${p.day}`, hour = Number(p.hour), sunday = p.weekday === 'Sun', done = [];
    const once = async (key, when, fn) => { if (when && store.getMeta(key) !== day) { store.setMeta(key, day); await fn(); done.push(key); } };
    if (ready) {
      await once('sched_reminders', hour === (Number(S.reminder_hour) || 18), () => call('eveningReminders'));
      await once('sched_weekly', sunday && hour >= 19 && S.weekly_report !== 'no', () => call('weeklyReport'));
      await once('sched_export', sunday && hour >= 20, () => emailExport());
    }
    await once('sched_backup', hour >= 3, async () => { backup(); store.pruneSessions(); });
    const pulled = await library.maybeSync(S.files_repo || env.TEAM_REPO || '', S.files_branch || 'main', Number(env.TEAM_REPO_PULL_MIN) || 5);
    if (pulled && pulled.changed && pulled.before) log(`team files: ${(pulled.added || []).length} new or changed, ${(pulled.removed || []).length} removed`);
    if (ready) await call('flushChanges', false); // task-change alerts wait until nobody edited for a minute
    const old = Date.now() - 3600e3; buckets.forEach((b, k) => { if (b.t < old) buckets.delete(k); });
    if (Date.now() - lastBotCheck > 60e3 && store.getProp('BOT_TOKEN')) {
      lastBotCheck = Date.now();
      const c = await telegram.refresh(store.getProp('BOT_TOKEN')).catch(() => null);
      const want = telegram.webhookUrl();
      if (c && want && c.getMe && c.getMe.ok && c.getWebhookInfo && c.getWebhookInfo.ok && c.getWebhookInfo.result.url !== want) await telegram.setWebhook(store.getProp('BOT_TOKEN')); // self-heal
    }
    store.pruneOutbox();
    kick();
    return done;
  }
  async function emailExport() {
    const data = await call('apiExport_');
    const gz = gzipSync(Buffer.from(JSON.stringify(data, null, 1))).toString('base64'), day = String(data.exported).slice(0, 10);
    await run(() => {
      be.call('resetMemo_');
      be.call('activePeople_').filter(p => be.call('isAdmin_', p) && p.email).forEach(p => store.enqueue('mail', {
        to: p.email, name: be.call('event_') + ' Team Hub', subject: `[${be.call('event_')}] Weekly backup ${day}`,
        body: 'Attached: this week\'s export of your Team Hub (people, tasks, log — no personal links). Keep it; you can rebuild the hub from it.',
        attachments: [{ filename: `team-hub-export-${day}.json.gz`, mime: 'application/gzip', b64: gz }] }));
    });
  }
  function backup() {
    mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10), file = join(backupDir, `hub-${stamp}.db`);
    if (existsSync(file)) rmSync(file);
    store.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    cpSync(filesDir, join(backupDir, 'files'), { recursive: true, force: false, errorOnExist: false });
    readdirSync(backupDir).filter(f => /^hub-\d{4}-\d\d-\d\d\.db$/.test(f)).sort().slice(0, -14).forEach(f => rmSync(join(backupDir, f)));
    store.setMeta('last_backup', new Date().toISOString());
    log('backup written: ' + file);
    return file;
  }

  // ------------------------------------------------------------------ admin commands (hubctl → local socket only)
  const admin = {
    async status() {
      const r = await run(() => { be.call('resetMemo_'); return { ready: be.call('hasAdmin_'), event: be.call('event_'), people: be.call('activePeople_').length, tasks: be.call('rows_', 'Tasks').length }; });
      return Object.assign(r, hubServer.stats(), { version: be.call('__eval', 'HUB_VERSION'), bot: store.getProp('BOT_USERNAME') || '', webhook: telegram.webhookUrl() });
    },
    async 'admin-links'() { return run(() => { be.call('resetMemo_'); return be.call('activePeople_').filter(p => be.call('isAdmin_', p)).map(p => ({ name: p.name, link: be.call('linkFor_', p) })); }); },
    async 'reset-link'(key) { return run(() => { be.call('resetMemo_'); const r = be.call('resetLink_', { name: 'server admin' }, { key }); if (!r.ok) throw new Error(r.error); return { link: r.link }; }); },
    async 'import-code'() { const c = code24(); store.setMeta('import_code', c); store.setMeta('import_code_exp', Date.now() + 2 * 3600e3); return { code: c, validFor: '2 hours', empty: !hasPeople(), server: env.publicUrl(), linksWillBe: home() }; },
    async 'setup-code'() { const c = code24(); store.setMeta('setup_code', c); store.setMeta('setup_code_exp', Date.now() + 2 * 3600e3); return { code: c, validFor: '2 hours' }; },
    async export() { return call('apiExport_'); },
    async backup() { return { file: backup() }; },
    async 'set-webhook'() { return telegram.setWebhook(store.getProp('BOT_TOKEN')); },
    /** Pull the team files repo now. */
    async 'files-sync'() { const S = await run(() => { be.call('resetMemo_'); return be.call('S_'); }); const r = await library.sync(S.files_repo || env.TEAM_REPO || '', S.files_branch || 'main'); const st = library.state(); return { repo: st.repo, head: st.head.slice(0, 7), files: st.tree.length, error: st.error || r.error || '' }; },
    /** Links for the Files page from a JSON file: [{ id?, title, url, section, private, note, thumb }]. Same ids are updated, so it can be run again. */
    async 'import-resources'(file) { const list = JSON.parse(readFileSync(String(file), 'utf8')); return run(() => { be.call('resetMemo_'); const r = be.call('saveResources_', { name: 'server admin', key: '' }, { resources: list }); if (!r.ok) throw new Error((r.errors || [r.error]).join('; ')); return { links: r.resources.length }; }); },
    /** Move task links that point into an old GitHub repo (JSON: { prefix, branch, map }). Without --apply it only shows what would change. */
    async relink(file, apply) { const b = JSON.parse(readFileSync(String(file), 'utf8')); return run(() => { be.call('resetMemo_'); const r = be.call('relinkTasks_', { name: 'server admin', key: '' }, Object.assign({}, b, { dryRun: apply !== '--apply' })); if (!r.ok) throw new Error((r.errors || [r.error]).join('; ')); return r; }); },
    /** One setting (as in Dashboard → Settings, plus site_url / hub_id), then personal links are rebuilt. */
    async 'set-setting'(key, value = '') {
      key = String(key || ''); value = String(value);
      return run(() => {
        be.call('resetMemo_');
        const known = be.call('__eval', 'SETTINGS').some(d => d[0] === key);
        if (!known) throw new Error('Unknown setting: ' + key);
        if (/_url$/.test(key) && value && !/^https:\/\/[^\s<>"']+$/.test(value)) throw new Error(key + ' must start with https://');
        be.call('saveSettingsRaw_', { [key]: value.replace(/\/+$/, '') });
        be.call('refreshLinks');
        be.call('log_', 'server admin', '', 'Setting changed', key + ' = ' + value);
        return { [key]: be.call('S_')[key] };
      });
    },
    async 'notify-admins'(text) { return run(() => { be.call('resetMemo_'); const to = be.call('activePeople_').filter(p => be.call('isAdmin_', p) && p.chat_id); to.forEach(p => be.call('tg_', p.chat_id, text)); return to.length; }); },
    async remind() { return call('eveningReminders'); },
    async 'weekly-report'() { return call('weeklyReport'); },
  };

  // ------------------------------------------------------------------ HTTP
  const limited = (ip, key, max, perMs) => { const k = key + ip, now = Date.now(), b = buckets.get(k) || { n: 0, t: now }; if (now - b.t > perMs) { b.n = 0; b.t = now; } b.n++; buckets.set(k, b); return b.n > max; };
  const readBody = (req, max) => new Promise((ok, bad) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > max) { bad(Object.assign(new Error('Too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8'))); req.on('error', bad);
  });
  const clientIp = req => {
    const sock = String(req.socket.remoteAddress || ''), local = /^(::1|127\.|::ffff:127\.)/.test(sock);
    const fwd = String(req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0]).trim();
    return local && fwd ? fwd : sock;
  };
  const send = (res, status, body, type = 'application/json; charset=utf-8', extra = {}) => {
    res.writeHead(status, Object.assign({ 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' }, extra));
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const docs = join(ROOT, 'docs');
  const configJs = () => `// Generated by the Haven Hub server.\nwindow.HUB_CONFIG = ${JSON.stringify({ api: '/api', selfHosted: true, repo: 'https://github.com/notazizelse/haven-hub', latestBackend: be.call('__eval', 'HUB_VERSION'), templateSheet: '' })};\n`;

  async function handle(req, res) {
    const url = new URL(req.url, 'http://x'), path = url.pathname, ip = clientIp(req);
    const origin = String(req.headers.origin || '');
    // www.yourdomain → yourdomain (one address, so a sign-in saved in the browser is always found)
    const host = String(req.headers.host || '').toLowerCase(), pub = env.publicUrl();
    if (host.startsWith('www.') && pub && new URL(pub).host === host.slice(4) && (req.method === 'GET' || req.method === 'HEAD')) return send(res, 301, '', 'text/plain', { Location: pub + req.url, 'Cache-Control': 'public, max-age=3600' });
    if (path === '/api' && origins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    try {
      if (path === '/api' && req.method === 'OPTIONS') return send(res, 204, '', 'text/plain', { 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' });
      if (path === '/api') {
        if (req.method === 'GET') return send(res, 200, await api('GET', Object.fromEntries(url.searchParams), ip));
        if (req.method === 'POST') {
          if (limited(ip, 'post', 240, 60e3)) return send(res, 429, { ok: false, error: 'Too many requests — wait a minute.' });
          let b; try { b = JSON.parse(await readBody(req, 12e6)); } catch (e) { return send(res, e.status || 400, { ok: false, error: e.status === 413 ? 'Too large (max ~9 MB).' : 'Bad request' }); }
          return send(res, 200, await api('POST', b || {}, ip));
        }
        return send(res, 405, { ok: false, error: 'Use GET or POST' });
      }
      if (path === '/tg/' + env.TG_PATH && req.method === 'POST') {
        if (!same(req.headers['x-telegram-bot-api-secret-token'], env.TG_SECRET)) return send(res, 403, { ok: false });
        const u = JSON.parse(await readBody(req, 1e6) || '{}');
        webhook(u).catch(e => log('webhook update: ' + e.message));
        return send(res, 200, { ok: true });
      }
      if (path.startsWith('/admin/import') && req.method === 'POST') {
        if (limited(ip, 'import', 30, 3600e3)) return send(res, 429, { ok: false, error: 'Too many tries — wait an hour.' });
        const b = JSON.parse(await readBody(req, 12e6) || '{}');
        const fn = { '/admin/import': importStart, '/admin/import/files': importFiles, '/admin/import/finish': importFinish }[path];
        return fn ? send(res, 200, await fn(b)) : send(res, 404, { ok: false });
      }
      if (path === '/healthz') return send(res, 200, { ok: true, version: be.call('__eval', 'HUB_VERSION'), uptimeMin: Math.round((Date.now() - started) / 6e4) });
      if (path.startsWith('/file/d/')) return send(res, 302, '', 'text/plain', { Location: '/' }); // proof files open inside the hub (Show file)
      if (path.startsWith('/files/raw/') && (req.method === 'GET' || req.method === 'HEAD')) { let rel; try { rel = decodeURIComponent(path.slice(11)); } catch (e) { return send(res, 400, 'Bad path', 'text/plain'); } return library.serve(rel, req, res); }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
      // the website
      if (path === '/config.js') return send(res, 200, configJs(), MIME['.js'], { 'Cache-Control': 'no-cache' });
      const rel = normalize(decodeURIComponent(path === '/' ? '/index.html' : path)).replace(/^([/\\])+/, '');
      const file = resolve(docs, rel);
      if (!file.startsWith(docs) || !existsSync(file) || statSync(file).isDirectory()) return send(res, 404, 'Not found', 'text/plain');
      const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream', asset = /[/\\]assets[/\\]/.test(file);
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': asset ? 'public, max-age=604800' : 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': CSP, 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' });
      if (req.method === 'HEAD') return res.end();
      createReadStream(file).pipe(res);
    } catch (e) {
      log('request error: ' + (e.stack || e));
      if (!res.headersSent) send(res, 500, { ok: false, error: 'Server error' });
    }
  }

  return { handle, admin, tick, api, webhook, accounts, library, importStart, importFiles, importFinish, backup, store, runtime, be, telegram, env, drain: async () => kick(), drainNow: () => drainOutbox({ store, telegram, mailer, filesDir, log }),
    close: () => store.close() };
}
