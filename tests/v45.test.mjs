// v4.5: sponsors with uploaded logos, profile photos, profiles, "already on the team" applications, Google sign-in, password reset links.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { generateKeyPairSync, createSign, randomBytes } from 'node:crypto';
import { createGas, loadBackend } from '../docs/demo/gas-fakes.js';
import { createHub } from '../server/app.mjs';

const CODE = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const HUB = 'AKfycbTESTdeployment0000000000000000000000000000';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; // 1×1 px
const CID = '1234-test.apps.googleusercontent.com';

function setupHub(opts = {}) {
  const gas = createGas({ tz: 'Asia/Tashkent' }), be = loadBackend(CODE, gas);
  const r = be.post({ action: 'setup', sheet: 'https://docs.google.com/spreadsheets/d/' + gas._ss.getId() + '/edit', hub: HUB, name: 'Ada Lovelace', email: 'ada@example.com',
    event: { name: 'Haven Springfield', city: 'Springfield', start: '2026-11-14', end: '2026-11-15', timezone: 'Asia/Tashkent' }, starter: false });
  assert.equal(r.ok, true, r.error);
  const h = { gas, be, admin: { u: r.key, t: r.token } };
  h.as = (who, body) => be.post(Object.assign({}, body, { u: who.u, t: who.t }));
  h.get = (who, q) => be.get(Object.assign({}, q, { u: who.u, t: who.t }));
  h.add = person => { const x = h.as(h.admin, { action: 'person.add', person }); assert.equal(x.ok, true, x.error); const q = new URL(x.link).searchParams; return { u: q.get('u'), t: q.get('t'), key: x.person.key }; };
  if (opts.google) h.as(h.admin, { action: 'settings.save', values: { google_client_id: CID } });
  return h;
}

test('sponsors: add with an uploaded logo, edit, order, hide, delete; the public page shows only public ones, without notes', () => {
  const h = setupHub();
  assert.match(h.as(h.admin, { action: 'sponsor.save', sponsor: { name: '' } }).error, /name/);
  assert.match(h.as(h.admin, { action: 'sponsor.save', sponsor: { name: 'X', link: 'javascript:alert(1)' } }).error, /https/);
  assert.match(h.as(h.admin, { action: 'sponsor.save', sponsor: { name: 'X' }, logo: { data: PNG, mime: 'image/svg+xml' } }).error, /PNG, JPG or WebP/);
  const a = h.as(h.admin, { action: 'sponsor.save', sponsor: { name: 'PCB Co', link: 'https://pcb.example', tier: 'In-kind', blurb: 'Badges for everyone who ships', note: 'contact: Ava' }, logo: { data: PNG, mime: 'image/png' } });
  assert.equal(a.ok, true, a.error);
  assert.match(a.sponsor.logo, /^https:\/\/drive\.google\.com\/thumbnail\?id=file\w+/, 'an uploaded logo becomes a public picture');
  const b = h.as(h.admin, { action: 'sponsor.save', sponsor: { name: 'Domains Inc', logo_url: 'https://example.com/logo.png', public: false } });
  const c = h.as(h.admin, { action: 'sponsor.save', sponsor: { name: 'Pizza Place', tier: 'Food' } });
  assert.equal(h.as(h.admin, { action: 'sponsor.save', sponsor: { id: a.sponsor.id, name: 'PCB Co.', tier: 'Prize sponsor' } }).sponsor.logo, a.sponsor.logo, 'editing keeps the logo');
  const o = h.as(h.admin, { action: 'sponsor.order', ids: [c.sponsor.id, a.sponsor.id, b.sponsor.id] });
  assert.deepEqual(o.sponsors.map(s => s.name), ['Pizza Place', 'PCB Co.', 'Domains Inc']);
  const pub = h.be.get({ action: 'public' }).sponsors;
  assert.deepEqual(pub.map(s => s.name), ['Pizza Place', 'PCB Co.'], 'hidden sponsors stay off the public page');
  assert.equal(pub[1].note, undefined); assert.equal(pub[1].blurb, 'Badges for everyone who ships');
  const me = h.get(h.admin, { action: 'me' });
  assert.equal(me.sponsors.length, 3); assert.equal(me.sponsors[1].note, 'contact: Ava'); assert.ok(me.features.includes('sponsors')); assert.ok(me.sponsorTiers.includes('Venue'));
  assert.equal(h.as(h.admin, { action: 'sponsor.delete', id: c.sponsor.id }).sponsors.length, 2);
  const m = h.add({ name: 'Mo Member' });
  assert.equal(h.as(m, { action: 'sponsor.save', sponsor: { name: 'Mine' } }).code, 'forbidden');
  assert.equal(h.as(h.admin, { action: 'list.save', tab: 'Sponsors', rows: [] }).ok, false, 'the old list editor cannot wipe sponsors');
});

test('sponsors: when Google forbids public files, a small logo is kept in the Sheet instead', () => {
  const h = setupHub();
  const fold = h.gas.DriveApp.createFolder; // every new file refuses to be shared
  h.gas.DriveApp.createFolder = name => { const f = fold(name), cf = f.createFile; f.createFile = b => { const x = cf(b); x.setSharing = () => { throw new Error('Sharing is restricted by your admin'); }; return x; }; return f; };
  const a = h.as(h.admin, { action: 'sponsor.save', sponsor: { name: 'Small Logo' }, logo: { data: PNG, mime: 'image/png' } });
  assert.equal(a.ok, true, a.error); assert.equal(a.sponsor.logo, 'data:image/png;base64,' + PNG);
});

test('photos: everyone sets their own, admins anyone\'s; too big is refused; never on the public page', () => {
  const h = setupHub();
  const bob = h.add({ name: 'Bob Builder', email: 'bob@example.com' }), cy = h.add({ name: 'Cy Lead', access: 'lead' });
  const pic = 'data:image/jpeg;base64,' + PNG;
  assert.equal(h.as(bob, { action: 'photo.save', photo: pic }).ok, true);
  assert.match(h.as(bob, { action: 'photo.save', photo: 'data:image/jpeg;base64,' + 'A'.repeat(60000) }).error, /too big/);
  assert.match(h.as(bob, { action: 'photo.save', photo: 'https://evil.example/x.png' }).error, /too big|not a JPG/);
  assert.equal(h.as(bob, { action: 'photo.save', key: cy.key, photo: pic }).code, 'forbidden');
  assert.equal(h.as(h.admin, { action: 'photo.save', key: cy.key, photo: pic }).ok, true);
  const me = h.get(bob, { action: 'me' });
  assert.equal(me.me.photo, pic); assert.equal(me.team.find(p => p.key === cy.key).photo, pic);
  assert.equal(me.team[0].email, undefined, 'members do not see emails');
  assert.equal(h.get(cy, { action: 'me' }).team.find(p => p.key === bob.key).email, 'bob@example.com', 'leads see how to reach people');
  h.as(h.admin, { action: 'settings.save', values: { public_show_team: true } });
  assert.ok(!JSON.stringify(h.be.get({ action: 'public' })).includes('base64'), 'no photos of minors on the public page');
  assert.equal(h.as(bob, { action: 'photo.save', photo: '' }).photo, '', 'photo removed');
});

test('applications: someone already on the team is recognised (email, Telegram, name; a first name alone is a maybe), and can be closed as theirs', () => {
  const h = setupHub();
  const mar = h.add({ name: 'Marco Rossi', role: 'Media Leader', area: 'Growth', handle: '@marco_k', email: 'marco@example.com' });
  h.add({ name: 'Lina Petrova', email: 'lina@example.com' });
  const ap = (name, contact) => assert.equal(h.be.post({ action: 'apply', name, contact, age_group: '13-18', interest: 'Social media & video' }).ok, true);
  ap('Marco', '@marco_k'); ap('M. K.', 'Marco@Example.com'); ap('Lina Petrova', '@someone_else'); ap('Marco', '@another_one'); ap('Nora Kim', '@nora_draws');
  const apps = h.get(h.admin, { action: 'me' }).applications, by = n => apps.filter(a => a.name === n);
  assert.equal(by('Marco').find(a => a.contact === '@marco_k').match.how, 'Telegram');
  assert.equal(by('M. K.')[0].match.key, mar.key); assert.equal(by('M. K.')[0].match.how, 'email');
  assert.equal(by('Lina Petrova')[0].match.how, 'name'); assert.equal(by('Lina Petrova')[0].match.maybe, false);
  const maybe = by('Marco').find(a => a.contact === '@another_one').match;
  assert.equal(maybe.maybe, true); assert.equal(maybe.how, 'first name');
  assert.equal(by('Nora Kim')[0].match, null);
  assert.ok(h.gas._mails.some(m => /Already on the team: Marco Rossi/.test(m.body)), 'the admin is told right away');
  const id = by('Marco').find(a => a.contact === '@marco_k').id;
  const done = h.as(h.admin, { action: 'application.update', id, status: 'accepted', person: mar.key });
  assert.equal(done.ok, true, done.error); assert.equal(done.application.person, mar.key);
  const act = h.get(h.admin, { action: 'person.activity', key: mar.key });
  assert.equal(act.ok, true); assert.ok(act.applications.some(a => a.id === id), 'their page lists what they offered to help with');
  assert.ok(act.log.some(l => l.action === 'Person added'));
});

test('profiles: leads read anyone\'s activity, members cannot', () => {
  const h = setupHub();
  const bob = h.add({ name: 'Bob Builder' }), cy = h.add({ name: 'Cy Lead', access: 'lead' });
  const t = h.as(h.admin, { action: 'task.add', task: { title: 'Posters', owner: bob.key, due: '2026-10-20' } }).task;
  h.as(bob, { action: 'status', id: t.id, status: 'In progress' });
  const a = h.get(cy, { action: 'person.activity', key: bob.key });
  assert.equal(a.ok, true); assert.ok(a.log.some(l => l.action === 'In progress' && l.task === t.id)); assert.deepEqual(a.applications, [], 'applications are for admins');
  assert.equal(h.get(bob, { action: 'person.activity', key: cy.key }).code, 'forbidden');
});

// ------------------------------------------------------------------ Google sign-in on a Google Sheet hub (Apps Script checks the token with Google's tokeninfo)
function fakeGoogle(gas) {
  const tokens = {};
  gas._google = tok => tokens[tok] || null;
  let n = 0;
  return (claims, nonce) => { const tok = 'h.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.s' + (n++); tokens[tok] = Object.assign({ iss: 'https://accounts.google.com', aud: CID, exp: String(Math.floor(Date.now() / 1000) + 600), nonce, email_verified: 'true' }, claims); return tok; };
}
const nonce = () => randomBytes(16).toString('hex');

test('Google (Sheet hub): not on the team → ticket → verified application → accepted with Google → signs in; email match binds; replays and wrong client refused', () => {
  const h = setupHub({ google: true }), tok = fakeGoogle(h.gas);
  assert.equal(h.be.get({ action: 'public' }).google, CID);
  let n = nonce();
  const out = h.be.post({ action: 'auth.google', idToken: tok({ sub: 'g-nora', email: 'nora@gmail.com', name: 'Nora Kim' }, n), nonce: n });
  assert.equal(out.ok, false); assert.equal(out.code, 'not_on_team'); assert.equal(out.email, 'nora@gmail.com'); assert.match(out.ticket, /^[0-9a-f]{32}$/);
  const ap = h.be.post({ action: 'apply', ticket: out.ticket, age_group: '13-18', interest: 'Design & posters' });
  assert.equal(ap.ok, true, ap.error);
  const app = h.get(h.admin, { action: 'me' }).applications[0];
  assert.equal(app.name, 'Nora Kim'); assert.equal(app.email, 'nora@gmail.com'); assert.equal(app.verified, true);
  assert.equal(h.as(h.admin, { action: 'person.add', person: { name: app.name, email: app.email }, fromApplication: app.id }).ok, true);
  n = nonce();
  const t1 = tok({ sub: 'g-nora', email: 'nora@gmail.com' }, n), inn = h.be.post({ action: 'auth.google', idToken: t1, nonce: n });
  assert.equal(inn.ok, true, inn.error); assert.equal(inn.u, 'nora'); assert.match(inn.t, /^[0-9a-f]{32}$/);
  assert.equal(h.get({ u: inn.u, t: inn.t }, { action: 'me' }).me.google, true);
  assert.match(h.be.post({ action: 'auth.google', idToken: t1, nonce: n }).error, /already used/, 'a sign-in works once');
  // someone the admin added by email: their first Google sign-in connects the account
  const bob = h.add({ name: 'Bob Builder', email: 'bob@school.org' });
  n = nonce();
  const b1 = h.be.post({ action: 'auth.google', idToken: tok({ sub: 'g-bob', email: 'BOB@school.org', picture: 'https://lh3.googleusercontent.com/a/bob=s96' }, n), nonce: n });
  assert.equal(b1.ok, true, b1.error); assert.equal(b1.u, bob.key);
  const bm = h.get(bob, { action: 'me' }).me;
  assert.equal(bm.google_email, 'bob@school.org'); assert.equal(bm.photo, 'https://lh3.googleusercontent.com/a/bob=s96', 'their Google picture becomes the photo');
  n = nonce();
  assert.equal(h.be.post({ action: 'auth.google', idToken: tok({ sub: 'g-x', email: 'x@x.org', email_verified: 'false' }, n), nonce: n }).code, 'not_on_team', 'unverified emails never match');
  n = nonce();
  assert.match(h.be.post({ action: 'auth.google', idToken: tok({ sub: 'g-bob', aud: 'someone-else.apps.googleusercontent.com' }, n), nonce: n }).error, /failed/, 'a token for another website is refused');
  n = nonce();
  assert.match(h.be.post({ action: 'auth.google', idToken: tok({ sub: 'g-bob' }, 'another-nonce-0000'), nonce: n }).error, /failed/, 'the nonce must match');
  // connect from Profile, disconnect, reset sign-in forgets Google
  const cy = h.add({ name: 'Cy Lead', access: 'lead' });
  n = nonce();
  assert.equal(h.as(cy, { action: 'auth.google.link', idToken: tok({ sub: 'g-bob', email: 'bob@school.org' }, n), nonce: n }).ok, false, 'one Google account per person');
  n = nonce();
  assert.equal(h.as(cy, { action: 'auth.google.link', idToken: tok({ sub: 'g-cy', email: 'cy@gmail.com' }, n), nonce: n }).google_email, 'cy@gmail.com');
  assert.equal(h.as(cy, { action: 'auth.google.unlink' }).ok, true);
  assert.equal(h.get(cy, { action: 'me' }).me.google, false);
  h.as(h.admin, { action: 'person.resetLink', key: bob.key });
  assert.equal(h.get(h.admin, { action: 'me' }).people.find(p => p.key === bob.key).google, false, 'reset sign-in forgets the Google account');
});

// ------------------------------------------------------------------ own server: Google tokens checked against Google's keys, sessions, password reset links, public logos
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const JWK = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k1', alg: 'RS256', use: 'sig' });
function idToken(claims, nonceV, kid = 'k1', key = privateKey) {
  const head = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(Object.assign({ iss: 'https://accounts.google.com', aud: CID, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600, nonce: nonceV, email_verified: true }, claims))).toString('base64url');
  const sig = createSign('RSA-SHA256').update(head + '.' + body).sign(key).toString('base64url');
  return head + '.' + body + '.' + sig;
}
async function boot(env = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'hub45-')), tg = [];
  const googleFetch = async () => ({ ok: true, status: 200, headers: new Headers({ 'cache-control': 'public, max-age=3600' }), json: async () => ({ keys: [JWK] }) });
  const fetchImpl = async (url, opts) => { tg.push({ method: url.split('/').pop(), body: opts.body instanceof FormData ? {} : JSON.parse(opts.body || '{}') }); return { status: 200, json: async () => ({ ok: true, result: { username: 'test_bot' } }) }; };
  const hub = await createHub({ dataDir, backupDir: join(dataDir, 'bk'), code: CODE, fetch: fetchImpl, googleFetch, log: () => {},
    env: Object.assign({ PUBLIC_URL: 'https://hub.example.xyz', HUB_TZ: 'Asia/Tashkent', TG_SECRET: 's', TG_PATH: 'p', GOOGLE_CLIENT_ID: CID }, env), mailTransport: { sendMail: async () => {} } });
  const srv = createServer(hub.handle); await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const post = async body => (await fetch(base + '/api', { method: 'POST', body: JSON.stringify(body) })).json();
  const get = async q => (await fetch(base + '/api?' + new URLSearchParams(q))).json();
  const { code } = await hub.admin['setup-code']();
  const r = await post({ action: 'setup', sheet: code, site: 'https://hub.example.xyz', name: 'Ada Admin', email: 'ada@example.com', event: { name: 'Haven Test', start: '2026-11-14', end: '2026-11-15', timezone: 'Asia/Tashkent' }, starter: false });
  assert.equal(r.ok, true, r.error);
  const admin = { u: r.key, t: r.token };
  const add = async person => { const x = await post(Object.assign({ action: 'person.add', person }, admin)); assert.equal(x.ok, true, x.error); return { u: x.person.key, t: new URL(x.link).searchParams.get('t') }; };
  return { hub, base, post, get, admin, add, tg, stop: async () => { await new Promise(x => srv.close(x)); hub.close(); } };
}

test('Google (own server): signature checked, a session is made, the old link then says "use Google", connect from a link, replays refused', async () => {
  const s = await boot();
  assert.match(await (await fetch(s.base + '/config.js')).text(), /"googleClientId":"1234-test/);
  const bob = await s.add({ name: 'Bob Builder', email: 'bob@school.org' });
  let n = nonce();
  const sig = await s.post({ action: 'auth.google', idToken: idToken({ sub: 'g-bob', email: 'bob@school.org', name: 'Bob' }, n), nonce: n });
  assert.equal(sig.ok, true, sig.error); assert.match(sig.t, /^hs_/); assert.equal(sig.u, bob.u);
  assert.equal((await s.get({ action: 'me', t: sig.t })).me.google, true);
  const old = await s.get(Object.assign({ action: 'me' }, bob));
  assert.equal(old.code, 'auth'); assert.equal(old.reason, 'google'); assert.match(old.error, /bob@school\.org/);
  assert.match((await s.post({ action: 'auth.google', idToken: idToken({ sub: 'g-bob' }, n), nonce: n })).error, /already used/);
  n = nonce();
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  assert.match((await s.post({ action: 'auth.google', idToken: idToken({ sub: 'g-bob' }, n, 'k1', other), nonce: n })).error, /bad signature/);
  n = nonce();
  assert.match((await s.post({ action: 'auth.google', idToken: idToken({ sub: 'g-bob', aud: 'x.apps.googleusercontent.com' }, n), nonce: n })).error, /another website/);
  n = nonce();
  assert.match((await s.post({ action: 'auth.google', idToken: idToken({ sub: 'g-bob', exp: 1 }, n), nonce: n })).error, /expired/);
  n = nonce();
  const stranger = await s.post({ action: 'auth.google', idToken: idToken({ sub: 'g-new', email: 'new@gmail.com', name: 'New Person' }, n), nonce: n });
  assert.equal(stranger.code, 'not_on_team'); assert.ok(stranger.ticket);
  assert.equal((await s.post({ action: 'apply', ticket: stranger.ticket, age_group: '13-18' })).ok, true, 'the join form takes the ticket');
  // a link user connects Google from Profile → gets a session (their link stops working)
  const cy = await s.add({ name: 'Cy Lead', access: 'lead' });
  n = nonce();
  const lk = await s.post(Object.assign({ action: 'auth.google.link', idToken: idToken({ sub: 'g-cy', email: 'cy@gmail.com' }, n), nonce: n }, cy));
  assert.equal(lk.ok, true, lk.error); assert.match(lk.t, /^hs_/);
  assert.equal((await s.get(Object.assign({ action: 'me' }, cy))).reason, 'google');
  assert.equal((await s.get({ action: 'me', t: lk.t })).ok, true);
  assert.equal((await s.post({ action: 'auth.google.unlink', t: lk.t })).ok, true);
  assert.equal((await s.get(Object.assign({ action: 'me' }, cy))).ok, true, 'without Google the link works again');
  assert.equal((await s.post({ action: 'auth.google', idToken: 'x', nonce: 'n', _google: { sub: 'g-bob' } })).ok, false, 'callers cannot smuggle in claims');
  await s.stop();
});

test('password reset link (own server): admin makes it, it can go by Telegram, works once, keeps the username, signs out every device', async () => {
  const s = await boot();
  const bob = await s.add({ name: 'Bob Builder', email: 'bob@example.com' });
  const made = await s.post(Object.assign({ action: 'account.create', username: 'bob', password: 'purple otter 42' }, bob));
  assert.equal(made.ok, true, made.error);
  const cy = await s.add({ name: 'Cy Lead', access: 'lead' });
  assert.equal((await s.post(Object.assign({ action: 'account.resetLink', key: bob.u }, cy))).code, 'forbidden');
  assert.equal((await s.post(Object.assign({ action: 'account.resetLink', key: cy.u }, s.admin))).code, 'no_password');
  s.hub.store.getProp('x'); // (nothing)
  const r = await s.post(Object.assign({ action: 'account.resetLink', key: bob.u, send: 'email' }, s.admin));
  assert.equal(r.ok, true, r.error); assert.match(r.link, /^https:\/\/hub\.example\.xyz\/#\/reset\?k=pr_[\w-]{40,}$/); assert.equal(r.sent, 'email'); assert.equal(r.username, 'bob');
  const k = r.link.split('k=')[1];
  assert.deepEqual(await s.post({ action: 'account.resetCheck', k }), { ok: true, username: 'bob', name: 'Bob Builder' });
  assert.match((await s.post({ action: 'account.resetFinish', k, password: 'short' })).error, /8 characters/);
  const fin = await s.post({ action: 'account.resetFinish', k, password: 'green heron 77' });
  assert.equal(fin.ok, true, fin.error); assert.match(fin.t, /^hs_/); assert.equal(fin.username, 'bob');
  assert.equal((await s.get({ action: 'me', t: made.t })).reason, 'session', 'old sessions end');
  assert.equal((await s.post({ action: 'login', username: 'bob', password: 'purple otter 42' })).ok, false);
  assert.equal((await s.post({ action: 'login', username: 'bob', password: 'green heron 77' })).ok, true);
  assert.equal((await s.post({ action: 'account.resetFinish', k, password: 'another one 99' })).code, 'expired', 'works once');
  const r2 = await s.post(Object.assign({ action: 'account.resetLink', key: bob.u }, s.admin)), r3 = await s.post(Object.assign({ action: 'account.resetLink', key: bob.u }, s.admin));
  assert.equal((await s.post({ action: 'account.resetCheck', k: r2.link.split('k=')[1] })).ok, false, 'a newer link replaces the older one');
  assert.equal((await s.post({ action: 'account.resetCheck', k: r3.link.split('k=')[1] })).ok, true);
  await s.stop();
});

test('public logos (own server): uploaded sponsor logos are served at /files/pub/<id>; proof files are not', async () => {
  const s = await boot();
  const a = await s.post(Object.assign({ action: 'sponsor.save', sponsor: { name: 'PCB Co' }, logo: { data: PNG, mime: 'image/png' } }, s.admin));
  assert.equal(a.ok, true, a.error); assert.match(a.sponsor.logo, /^https:\/\/hub\.example\.xyz\/files\/pub\/[\w-]+$/);
  const res = await fetch(s.base + new URL(a.sponsor.logo).pathname);
  assert.equal(res.status, 200); assert.equal(res.headers.get('content-type'), 'image/png'); assert.match(res.headers.get('content-security-policy'), /sandbox/);
  assert.equal(Buffer.from(await res.arrayBuffer()).toString('base64'), PNG);
  const t = (await s.post(Object.assign({ action: 'task.add', task: { title: 'X', owner: s.admin.u, due: '2026-10-20' } }, s.admin))).task;
  const up = await s.post(Object.assign({ action: 'upload', id: t.id, mime: 'image/png', data: PNG }, s.admin));
  assert.equal((await fetch(s.base + '/files/pub/' + up.id)).status, 404, 'proof photos stay private');
  assert.equal((await fetch(s.base + '/files/pub/..%2Fhub.db')).status, 404);
  const pub = await s.get({ action: 'public' });
  assert.equal(pub.sponsors[0].logo, a.sponsor.logo);
  await s.stop();
});
