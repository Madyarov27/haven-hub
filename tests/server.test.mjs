// Self-hosted server: the real Code.gs on SQLite, over real HTTP.   node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createHub } from '../server/app.mjs';
import { createGas, loadBackend } from '../dev/gas-fakes.js';

const CODE = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const PUB = 'https://hub.example.xyz';

function fakeTelegram() {
  const calls = []; let webhook = '';
  const fetchImpl = async (url, opts) => {
    const method = url.split('/').pop(), body = opts.body instanceof FormData ? Object.fromEntries(opts.body) : JSON.parse(opts.body || '{}');
    calls.push({ method, body });
    let r = { ok: true, result: true };
    if (method === 'getMe') r = { ok: true, result: { username: 'test_hub_bot', can_join_groups: true, can_read_all_group_messages: true } };
    if (method === 'getWebhookInfo') r = { ok: true, result: { url: webhook, pending_update_count: 0 } };
    if (method === 'setWebhook') webhook = body.url;
    return { status: 200, json: async () => r };
  };
  return { calls, fetchImpl, webhook: () => webhook };
}
async function boot(extra = {}) {
  const dataDir = extra.dataDir || mkdtempSync(join(tmpdir(), 'hub-')), tg = extra.tg || fakeTelegram(), mails = [];
  const hub = await createHub({ dataDir, backupDir: join(dataDir, 'bk'), code: CODE, fetch: tg.fetchImpl, log: () => {},
    env: Object.assign({ PUBLIC_URL: PUB, HUB_TZ: 'Asia/Tashkent', TG_SECRET: 'sekret', TG_PATH: 'p4th' }, extra.env || {}), mailTransport: { sendMail: async m => { mails.push(m); } } });
  const srv = createServer(hub.handle); await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const post = async (body, path = '/api') => (await fetch(base + path, { method: 'POST', body: JSON.stringify(body) })).json();
  const get = async q => (await fetch(base + '/api?' + new URLSearchParams(q))).json();
  const stop = async () => { await new Promise(r => srv.close(r)); hub.close(); };
  return { hub, base, post, get, stop, dataDir, tg, mails };
}
async function setUp(s) {
  const { code } = await s.hub.admin['setup-code']();
  const r = await s.post({ action: 'setup', sheet: code, site: PUB, name: 'Ada Admin', email: 'ada@example.com', event: { name: 'Haven Test', city: 'Test', start: '2026-11-14', end: '2026-11-15', timezone: 'Asia/Tashkent' }, starter: false });
  assert.equal(r.ok, true, r.error);
  return { u: r.key, t: r.token, link: r.link };
}

test('setup needs the one-time setup code, links point at the server, data survives a restart', async () => {
  let s = await boot();
  assert.equal((await s.post({ action: 'setup', sheet: 'nope', name: 'X', event: { name: 'X', timezone: 'UTC' } })).code, 'proof');
  const admin = await setUp(s);
  assert.equal(admin.link, `${PUB}/?u=${admin.u}&t=${admin.t}`, 'no ?hub= on your own domain');
  const p = await s.post(Object.assign({ action: 'person.add', person: { name: 'Bob', email: 'bob@example.com' } }, admin));
  assert.equal(p.ok, true, p.error);
  await s.post(Object.assign({ action: 'task.add', task: { title: 'Posters', owner: p.person.key, due: '2026-10-20' } }, admin));
  const me = await s.get(Object.assign({ action: 'me' }, admin));
  assert.equal(me.hosting, 'server'); assert.equal(me.sheetUrl, ''); assert.equal(me.all.length, 1);
  const dir = s.dataDir; await s.stop();
  s = await boot({ dataDir: dir });
  const again = await s.get(Object.assign({ action: 'me' }, admin));
  assert.equal(again.ok, true); assert.equal(again.all[0].title, 'Posters'); assert.equal(again.team.length, 2);
  await s.stop(); rmSync(dir, { recursive: true, force: true });
});

test('a request that throws is rolled back', async () => {
  const s = await boot(); const admin = await setUp(s);
  assert.throws(() => s.hub.runtime.withTx(() => { s.hub.be.call('resetMemo_'); s.hub.be.call('log_', 'x', '', 'half-done', ''); throw new Error('boom'); }), /boom/);
  const me = await s.get(Object.assign({ action: 'me' }, admin));
  assert.ok(!me.log.some(l => l.action === 'half-done'));
  await s.stop();
});

test('emails go out through the outbox with the app password transport', async () => {
  const s = await boot(); await setUp(s);
  await s.hub.drainNow();
  assert.ok(s.mails.some(m => m.to === 'ada@example.com' && /Team Hub/.test(m.subject)), 'admin link emailed');
  await s.stop();
});

test('telegram: token from the dashboard sets a webhook; updates need the secret; replies are queued and sent', async () => {
  const s = await boot(); const admin = await setUp(s);
  const r = await s.post(Object.assign({ action: 'tg.setToken', token: '123456789:AAEabcdefghijklmnopqrstuvwxyz0123456' }, admin));
  assert.equal(r.ok, true, r.error); assert.equal(r.bot, 'test_hub_bot');
  await new Promise(res => setTimeout(res, 50));
  assert.equal(s.tg.webhook(), PUB + '/tg/p4th');
  const hook = s.tg.calls.find(c => c.method === 'setWebhook');
  assert.equal(hook.body.secret_token, 'sekret');
  const upd = { update_id: 1, message: { text: '/start ' + admin.t, from: { id: 42 }, chat: { id: 42, type: 'private' } } };
  assert.equal((await fetch(s.base + '/tg/p4th', { method: 'POST', body: JSON.stringify(upd) })).status, 403, 'no secret → refused');
  const ok = await fetch(s.base + '/tg/p4th', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'sekret' }, body: JSON.stringify(upd) });
  assert.equal(ok.status, 200);
  await new Promise(res => setTimeout(res, 50));
  assert.equal((await s.get(Object.assign({ action: 'me' }, admin))).me.telegram, true);
  await s.hub.drainNow();
  assert.ok(s.tg.calls.some(c => c.method === 'sendMessage' && String(c.body.chat_id) === '42' && /Connected/.test(c.body.text)));
  const info = await s.get(Object.assign({ action: 'botinfo' }, admin));
  assert.equal(info.info.mode, 'webhook'); assert.equal(info.info.polling, true, 'webhook points at us');
  await s.stop();
});

test('proof photo upload + show on the server', async () => {
  const s = await boot(); const admin = await setUp(s);
  const t = (await s.post(Object.assign({ action: 'task.add', task: { title: 'Photo task', owner: admin.u, due: '2026-10-20' } }, admin))).task;
  const up = await s.post(Object.assign({ action: 'upload', id: t.id, mime: 'image/png', fname: 'x.png', data: Buffer.from('fake-png').toString('base64') }, admin));
  assert.equal(up.ok, true, up.error); assert.match(up.url, /^https:\/\/hub\.example\.xyz\/file\/d\/[\w-]+$/);
  const ph = await s.get(Object.assign({ action: 'photo', id: up.id }, admin));
  assert.equal(ph.ok, true); assert.match(ph.data, /^data:image\/png;base64,/);
  await s.stop();
});

test('import from a Google Sheet: one-time code, empty server only, tokens + bot + files move; the Sheet then forwards', async () => {
  // the Google side (Apps Script fakes) with a v4 hub in it
  const gas = createGas(); const g = loadBackend(CODE, gas);
  const sheet = 'https://docs.google.com/spreadsheets/d/' + gas._ss.getId() + '/edit';
  const st = g.post({ action: 'setup', sheet, name: 'Azizbek', event: { name: 'Haven Tashkent', timezone: 'Asia/Tashkent', start: '2026-11-14', end: '2026-11-15' }, starter: true });
  const adm = { u: st.key, t: st.token };
  const lina = g.post(Object.assign({ action: 'person.add', person: { name: 'Lina', email: 'lina@example.com' } }, adm));
  const task = g.post(Object.assign({ action: 'task.add', task: { title: 'Poster', owner: lina.person.key, due: '2026-10-20' } }, adm)).task;
  const q = new URL(lina.link).searchParams, linaKey = { u: q.get('u'), t: q.get('t') };
  const up = g.post(Object.assign({ action: 'upload', id: task.id, mime: 'image/jpeg', fname: 'p.jpg', data: Buffer.from('jpeg!').toString('base64') }, linaKey));
  g.post(Object.assign({ action: 'status', id: task.id, status: 'Done', proof: 'Photo: ' + up.url }, linaKey));
  gas._props.BOT_TOKEN = '1:x'; gas._props.BOT_USERNAME = 'haven_tashkent_bot'; gas._props.GROUP_CHAT_ID = '-100';

  const s = await boot();
  const bundle = g.call('moveBundle_');
  assert.equal((await s.post({ code: 'wrong', bundle }, '/admin/import')).ok, false);
  const { code } = await s.hub.admin['import-code']();
  const start = await s.post({ code, bundle }, '/admin/import');
  assert.equal(start.ok, true, start.error);
  const files = []; const it = gas.DriveApp.getFolderById(gas._props.PROOF_FOLDER_ID).getFiles();
  while (it.hasNext()) { const f = it.next(); files.push({ id: f.getId(), name: f.getName(), mime: f.getBlob().getContentType(), desc: f.getDescription(), data: Buffer.from(f.getBlob().getBytes()).toString('base64') }); }
  assert.equal((await s.post({ code, importId: start.importId, files }, '/admin/import/files')).count, 1);
  const fin = await s.post({ code, importId: start.importId }, '/admin/import/finish');
  assert.equal(fin.ok, true, fin.error); assert.equal(fin.people, 2); assert.equal(fin.bot, 'haven_tashkent_bot');
  assert.equal((await s.post({ code, bundle }, '/admin/import')).ok, false, 'code is single-use');
  // same personal links work on the server; proof photo still opens; links now use the domain
  const me = await s.get(Object.assign({ action: 'me' }, linaKey));
  assert.equal(me.ok, true, me.error); assert.equal(me.tasks[0].status, 'Done');
  const ph = await s.get(Object.assign({ action: 'photo', id: up.id }, linaKey));
  assert.equal(ph.ok, true, ph.error);
  const al = await s.hub.admin['admin-links']();
  assert.equal(al[0].link, `${PUB}/?u=${adm.u}&t=${adm.t}`);
  await s.stop();

  // the Google side: moveToServer_ switches the Sheet off (fake server answers)
  const posted = [];
  gas.UrlFetchApp.fetch = (url, o) => { posted.push(url); const path = url.replace('https://hub.example.xyz', '');
    const j = path === '/admin/import' ? { ok: true, importId: 'i1' } : path === '/admin/import/files' ? { ok: true, count: 1 } : { ok: true, people: 2, tasks: 14, bot: 'haven_tashkent_bot' };
    return { getContentText: () => JSON.stringify(j), getResponseCode: () => 200 }; };
  gas._triggers.push({ fn: 'pollTelegram', getHandlerFunction: () => 'pollTelegram' });
  const msg = g.call('moveToServer_', PUB, 'code123');
  assert.match(msg, /Moved to https:\/\/hub\.example\.xyz/);
  assert.deepEqual(posted.map(u => u.replace(PUB, '')), ['/admin/import', '/admin/import/files', '/admin/import/finish']);
  assert.equal(gas._triggers.filter(t => ['pollTelegram', 'eveningReminders', 'weeklyReport'].includes(t.fn)).length, 0, 'old timers removed');
  const moved = g.get(Object.assign({ action: 'me' }, linaKey));
  assert.equal(moved.code, 'moved'); assert.equal(moved.url, PUB);
});

test('scheduler: reminders once a day at the reminder hour (hub time zone)', async () => {
  const s = await boot(); const admin = await setUp(s);
  const p = await s.post(Object.assign({ action: 'person.add', person: { name: 'Bob', email: 'bob@example.com' } }, admin));
  await s.post(Object.assign({ action: 'task.add', task: { title: 'Late thing', owner: p.person.key, due: '2020-01-01 10:00' } }, admin));
  await s.hub.drainNow(); s.mails.length = 0;
  const at18 = new Date('2026-10-05T13:00:00Z'); // 18:00 in Tashkent
  const done = await s.hub.tick(at18);
  assert.ok(done.includes('sched_reminders'));
  assert.ok(done.includes('sched_backup'), 'nightly backup ran');
  await s.hub.drainNow();
  assert.ok(s.mails.some(m => m.to === 'bob@example.com' && /overdue/i.test(m.subject)));
  const second = await s.hub.tick(new Date('2026-10-05T13:20:00Z'));
  assert.ok(!second.includes('sched_reminders'), 'only once a day'); assert.ok(!second.includes('sched_backup'), 'backup only once a day');
  assert.ok(!(await s.hub.tick(new Date('2026-10-05T09:00:00Z'))).includes('sched_reminders'));
  await s.stop();
});

test('website: security headers, generated config, no path traversal, health', async () => {
  const s = await boot();
  const home = await fetch(s.base + '/');
  assert.equal(home.status, 200); assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(home.headers.get('referrer-policy'), 'no-referrer');
  assert.match(await (await fetch(s.base + '/config.js')).text(), /"api":"\/api"/);
  assert.equal((await fetch(s.base + '/..%2fpackage.json')).status, 404);
  assert.equal((await fetch(s.base + '/%2e%2e/%2e%2e/package.json')).status, 404);
  assert.equal((await (await fetch(s.base + '/healthz')).json()).ok, true);
  await s.stop();
});

test('website on GitHub Pages, server does the work: CORS for the site only, links use ?hub=name', async () => {
  const SITE = 'https://notazizelse.github.io/haven-hub';
  const s = await boot({ env: { SITE_URL: SITE, HUB_NAME: 'tashkent', ALLOWED_ORIGINS: 'https://notazizelse.github.io' } });
  const ok = await fetch(s.base + '/api?action=ping', { headers: { Origin: 'https://notazizelse.github.io' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://notazizelse.github.io');
  const bad = await fetch(s.base + '/api?action=ping', { headers: { Origin: 'https://evil.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
  const pre = await fetch(s.base + '/api', { method: 'OPTIONS', headers: { Origin: 'https://notazizelse.github.io', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(pre.status, 204); assert.match(pre.headers.get('access-control-allow-methods'), /POST/);
  // import from the Google Sheet → links point at the GitHub site with ?hub=tashkent
  const gas = createGas(); const g = loadBackend(CODE, gas);
  const st = g.post({ action: 'setup', sheet: 'https://docs.google.com/spreadsheets/d/' + gas._ss.getId() + '/edit', name: 'Azizbek', event: { name: 'Haven Tashkent', timezone: 'Asia/Tashkent', start: '2026-11-14', end: '2026-11-15' }, starter: false });
  const { code } = await s.hub.admin['import-code']();
  const start = await s.post({ code, bundle: g.call('moveBundle_') }, '/admin/import');
  const fin = await s.post({ code, importId: start.importId }, '/admin/import/finish');
  assert.equal(fin.ok, true, fin.error); assert.equal(fin.home, SITE + '/?hub=tashkent');
  const links = await s.hub.admin['admin-links']();
  assert.equal(links[0].link, `${SITE}/?hub=tashkent&u=${st.key}&t=${st.token}`);
  // the Sheet then forwards to the GitHub link
  gas.UrlFetchApp.fetch = (url) => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(url.endsWith('/finish') ? fin : url.endsWith('/files') ? { ok: true, count: 0 } : { ok: true, importId: 'x' }) });
  g.call('moveToServer_', PUB, 'c');
  const moved = g.get({ action: 'me', u: st.key, t: st.token });
  assert.equal(moved.code, 'moved'); assert.equal(moved.url, SITE + '/?hub=tashkent');
  await s.stop();
});

test('change alerts on the server wait until the edits stop, then go out as one message per person', async () => {
  const s = await boot(); const admin = await setUp(s);
  const p = await s.post(Object.assign({ action: 'person.add', person: { name: 'Bob', email: 'bob@example.com' } }, admin));
  const t = (await s.post(Object.assign({ action: 'task.add', task: { title: 'Posters', owner: p.person.key, due: '2026-10-14 20:00' } }, admin))).task;
  await s.post(Object.assign({ action: 'task.edit', task: { id: t.id, due: '2026-10-15 20:00' } }, admin));
  await s.post(Object.assign({ action: 'task.edit', task: { id: t.id, due: '2026-10-16 18:00' } }, admin));
  const at = new Date('2026-10-05T09:00:00Z'); // 14:00 in Tashkent: no reminders
  await s.hub.tick(at); await s.hub.drainNow();
  assert.equal(s.mails.filter(m => m.to === 'bob@example.com').length, 0, 'still inside the quiet minute');
  const q = JSON.parse(s.hub.store.getProp('PENDING_CHANGES'));
  assert.equal(q.length, 3);
  s.hub.store.setProp('PENDING_CHANGES', JSON.stringify(q.map(x => Object.assign(x, { at: x.at - 120e3 })))); // a minute and more passed
  await s.hub.tick(at); await s.hub.drainNow();
  const bob = s.mails.filter(m => m.to === 'bob@example.com');
  assert.equal(bob.length, 1, 'one message for the whole burst');
  assert.match(bob[0].text, /Posters — due Fri 16 Oct 18:00/);
  assert.equal(s.hub.store.getProp('PENDING_CHANGES'), null, 'queue emptied');
  assert.ok(s.mails.some(m => m.to === 'ada@example.com' && /Task changes by you/.test(m.text)), 'the admin summary');
  await s.stop();
});

test('password sign-in: made from a link (the link then stops working), sessions, lockout, reset by an admin', async () => {
  const s = await boot(); const admin = await setUp(s);
  const p = await s.post(Object.assign({ action: 'person.add', person: { name: 'Bob', email: 'bob@example.com' } }, admin));
  const bob = { u: p.person.key, t: new URL(p.link).searchParams.get('t') };
  const create = (extra, who = bob) => s.post(Object.assign({ action: 'account.create' }, who, extra));
  assert.match((await create({ username: 'bob', password: 'short' })).error, /8 characters/);
  assert.match((await create({ username: 'Bob!', password: 'a good long one' })).error, /Username/);
  assert.match((await create({ username: 'bobby', password: 'bobby rocks 1' })).error, /username in your password/);
  assert.equal((await create({ username: 'bob', password: 'a good long one' }, { t: 'x'.repeat(32) })).code, 'auth');
  assert.equal((await s.get(Object.assign({ action: 'account.create', username: 'bob', password: 'a good long one' }, bob))).ok, false, 'POST only');
  const made = await create({ username: 'Bob.K', password: 'purple otter 42' });
  assert.equal(made.ok, true, made.error); assert.match(made.t, /^hs_/); assert.equal(made.username, 'bob.k');
  assert.equal((await create({ username: 'bob2', password: 'purple otter 42' }, { t: made.t })).ok, false, 'one account per person');

  const old = await s.get(Object.assign({ action: 'me' }, bob));
  assert.equal(old.code, 'auth'); assert.equal(old.reason, 'password'); assert.equal(old.username, 'bob.k', 'the old link says: use your password');
  const me = await s.get({ action: 'me', u: made.u, t: made.t });
  assert.equal(me.ok, true, me.error); assert.equal(me.me.account.username, 'bob.k'); assert.equal(me.accounts, true);
  assert.equal((await s.get({ action: 'me', t: me.me.tg_start })).reason, 'password', 'the new secret is no link either');
  s.hub.be.call('resetMemo_');
  const link = s.hub.be.call('linkFor_', s.hub.be.call('findPerson_', bob.u));
  assert.equal(link, PUB + '/#/signin', 'messages carry no key any more');
  const ppl = (await s.get(Object.assign({ action: 'me' }, admin))).people;
  assert.equal(ppl.find(x => x.key === bob.u).password, true);
  assert.equal((await s.post(Object.assign({ action: 'person.link', key: bob.u }, admin))).code, 'password');

  assert.equal((await s.post({ action: 'login', username: 'bob.k', password: 'nope nope' })).error, 'Wrong username or password.');
  assert.equal((await s.post({ action: 'login', username: 'nobody', password: 'nope nope' })).error, 'Wrong username or password.');
  const li = await s.post({ action: 'login', username: 'BOB.K', password: 'purple otter 42' });
  assert.equal(li.ok, true, li.error); assert.equal(li.u, bob.u);
  assert.equal((await s.post({ action: 'login', username: 'bob@example.com', password: 'purple otter 42' })).ok, true, 'the email works as a username');
  const t = (await s.post(Object.assign({ action: 'task.add', task: { title: 'Posters', owner: bob.u, due: '2026-10-20' } }, admin))).task;
  assert.equal((await s.post({ action: 'status', id: t.id, status: 'In progress', u: li.u, t: li.t })).ok, true, 'a session can do everything the link could');

  const row = s.hub.store.getAccount(bob.u);
  assert.match(row.hash, /^scrypt\$15\$8\$1\$[\w-]{22}\$[\w-]{43}$/); assert.ok(!JSON.stringify(row).includes('purple'), 'only the hash is stored');
  assert.ok(!JSON.stringify(await s.hub.admin.export()).includes('scrypt'), 'hashes are not in exports');

  assert.equal((await s.post({ action: 'account.password', t: li.t, current: 'wrong one', password: 'green heron 77' })).ok, false);
  assert.equal((await s.post({ action: 'account.password', t: li.t, current: 'purple otter 42', password: 'green heron 77' })).ok, true);
  assert.equal((await s.get({ action: 'me', t: made.t })).reason, 'session', 'other devices are signed out');
  assert.equal((await s.get({ action: 'me', t: li.t })).ok, true, 'this device stays signed in');

  for (let i = 0; i < 5; i++) await s.post({ action: 'login', username: 'bob.k', password: 'wrong wrong ' + i });
  assert.match((await s.post({ action: 'login', username: 'bob.k', password: 'green heron 77' })).error, /Too many wrong passwords/, 'locked after 5');

  const reset = await s.post(Object.assign({ action: 'person.resetLink', key: bob.u }, admin));
  assert.equal(reset.ok, true, reset.error); assert.match(reset.link, /t=[0-9a-f]{32}$/);
  assert.equal((await s.get({ action: 'me', t: li.t })).code, 'auth', 'sessions end');
  assert.equal(s.hub.store.getAccount(bob.u), undefined, 'the password is gone');
  assert.equal((await s.get({ action: 'me', u: bob.u, t: new URL(reset.link).searchParams.get('t') })).ok, true, 'the fresh link works');
  await s.stop();
});
