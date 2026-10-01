// Runs the real apps-script/Code.gs against in-memory fakes.   node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGas, loadBackend } from '../dev/gas-fakes.js';

const CODE = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const HUB = 'AKfycbTESTdeployment0000000000000000000000000000';

function fresh(opts) {
  const gas = createGas(opts);
  const be = loadBackend(CODE, gas);
  return { gas, be, sheet: 'https://docs.google.com/spreadsheets/d/' + gas._ss.getId() + '/edit#gid=0' };
}
function setupHub(opts = {}) {
  const h = fresh(opts);
  const r = h.be.post({ action: 'setup', sheet: h.sheet, hub: HUB, name: 'Ada Lovelace', email: 'ada@example.com',
    event: { name: 'Haven Springfield', city: 'Springfield', start: '2026-11-14', end: '2026-11-15', timezone: 'Asia/Tashkent' }, starter: opts.starter !== false });
  assert.equal(r.ok, true, r.error);
  h.admin = { t: r.token, u: r.key };
  h.as = (who, body) => h.be.post(Object.assign({}, body, who));
  h.get = (who, params) => h.be.get(Object.assign({}, params, who));
  h.addPerson = (person, extra) => { const x = h.as(h.admin, Object.assign({ action: 'person.add', person }, extra)); assert.equal(x.ok, true, x.error); const q = new URL(x.link).searchParams; return { t: q.get('t'), u: q.get('u'), key: x.person.key, res: x }; };
  return h;
}
const future = days => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10) + ' 20:00';

test('ping before setup says not ready', () => {
  const { be } = fresh();
  const r = be.get({ action: 'ping' });
  assert.equal(r.ok, true); assert.equal(r.ready, false); assert.match(r.version, /^4./);
});

test('setup: wrong sheet rejected, right sheet works, second setup rejected', () => {
  const h = fresh();
  const bad = h.be.post({ action: 'setup', sheet: 'https://docs.google.com/spreadsheets/d/1SomeoneElsesSheet000000000000/edit', name: 'X', event: { name: 'Haven X', timezone: 'Europe/London' } });
  assert.equal(bad.ok, false); assert.equal(bad.code, 'proof');
  const ok = h.be.post({ action: 'setup', sheet: h.sheet, hub: HUB, name: 'Ada', email: 'ada@example.com', event: { name: 'Haven X', timezone: 'Europe/London', start: '2026-11-14', end: '2026-11-15' } });
  assert.equal(ok.ok, true, ok.error);
  assert.match(ok.link, /\?hub=AKfy.*&u=ada&t=[0-9a-f]{32}$/);
  assert.equal(ok.emailed, true);
  assert.equal(h.gas._mails.length, 1);
  const again = h.be.post({ action: 'setup', sheet: h.sheet, name: 'Mallory', event: { name: 'Mine', timezone: 'UTC' } });
  assert.equal(again.ok, false);
  assert.equal(h.be.get({ action: 'ping' }).ready, true);
  assert.ok(h.gas._triggers.some(t => t.fn === 'eveningReminders'), 'reminder trigger installed');
});

test('starter pack creates tasks, rules and milestones relative to the event', () => {
  const h = setupHub();
  const me = h.get(h.admin, { action: 'me' });
  assert.equal(me.ok, true);
  assert.equal(me.me.admin, true); assert.equal(me.me.lead, true);
  assert.equal(me.tasks.length, 13);
  assert.ok(me.rules.length >= 7);
  assert.ok(me.milestones.some(m => m.date === '2026-11-14' && m.public));
  assert.ok(me.all.every(t => /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(t.due)));
  assert.equal(me.event.name, 'Haven Springfield');
  assert.equal(me.settings.hub_id, HUB);
  assert.ok(Array.isArray(me.people) && me.people[0].token === undefined, 'no tokens in the people list');
});

test('role matrix: member, lead, viewer, admin', () => {
  const h = setupHub({ starter: false });
  const mem = h.addPerson({ name: 'Bob Member', access: 'member', email: 'bob@example.com' });
  const lead = h.addPerson({ name: 'Lee Lead', access: 'lead' });
  const view = h.addPerson({ name: 'Vera Viewer', access: 'viewer' });
  const task = { title: 'Put up posters', owner: mem.key, due: future(3) };

  assert.equal(h.as(mem, { action: 'task.add', task }).code, 'forbidden');
  assert.equal(h.as(view, { action: 'task.add', task }).code, 'forbidden');
  const added = h.as(lead, { action: 'task.add', task });
  assert.equal(added.ok, true, added.error);
  assert.equal(h.as(lead, { action: 'person.add', person: { name: 'Nope' } }).code, 'forbidden');
  assert.equal(h.as(view, { action: 'status', id: added.task.id, status: 'In progress' }).code, 'forbidden');

  // member sees only own tasks, no dashboard data
  const mMe = h.get(mem, { action: 'me' });
  assert.equal(mMe.tasks.length, 1); assert.equal(mMe.all, undefined); assert.equal(mMe.people, undefined);
  // member finishes with proof
  assert.equal(h.as(mem, { action: 'status', id: added.task.id, status: 'Done', proof: '' }).ok, false);
  assert.equal(h.as(mem, { action: 'status', id: added.task.id, status: 'Done', proof: 'Photo of 3 posters: https://example.com/p.jpg' }).ok, true);

  // viewer: read-only dashboard, stripped
  const vMe = h.get(view, { action: 'me' });
  assert.equal(vMe.me.access, 'viewer');
  assert.equal(vMe.tasks.length, 0);
  assert.equal(vMe.all.length, 1);
  assert.equal(vMe.all[0].proof, '');
  assert.ok(vMe.log.every(l => l.note === ''));
  assert.ok(vMe.team.every(p => p.handle === ''));
  assert.equal(vMe.people, undefined); assert.equal(vMe.settings, undefined);
  assert.equal(h.get(view, { action: 'photo', id: 'x' }).code, 'forbidden');

  // someone else's task
  const other = h.as(h.admin, { action: 'task.add', task: { title: 'Admin thing', owner: h.admin.u, due: future(2) } });
  assert.equal(h.as(mem, { action: 'status', id: other.task.id, status: 'In progress' }).ok, false);
  // wrong name in the link
  assert.equal(h.get({ t: mem.t, u: 'lee' }, { action: 'me' }).code, 'auth');
});

test('multi-owner add, bulk shift/reassign/status, import validation, delete', () => {
  const h = setupHub({ starter: false });
  const a = h.addPerson({ name: 'Ann' }), b = h.addPerson({ name: 'Ben' });
  const r = h.as(h.admin, { action: 'task.add', task: { title: 'Hang 3 posters', owners: [a.key, b.key], due: '2026-10-20', steps: ['Print', 'Hang'], links: 'Poster | https://example.com/p.pdf' } });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.tasks.length, 2);
  assert.equal(r.tasks[0].due, '2026-10-20 20:00');
  assert.deepEqual(r.tasks[0].links, [{ label: 'Poster', url: 'https://example.com/p.pdf' }]);
  const ids = r.tasks.map(t => t.id);

  const bad = h.as(h.admin, { action: 'task.add', task: { title: 'x', owner: a.key, due: '2026-10-20', links: 'javascript:alert(1)' } });
  assert.equal(bad.ok, false);

  const s = h.as(h.admin, { action: 'task.bulk', ids, op: 'shift', days: 3 });
  assert.equal(s.ok, true); assert.ok(s.tasks.every(t => t.due === '2026-10-23 20:00'));
  const re = h.as(h.admin, { action: 'task.bulk', ids, op: 'reassign', owner: b.key });
  assert.ok(re.tasks.every(t => t.owner === b.key));
  const st = h.as(h.admin, { action: 'task.bulk', ids, op: 'status', status: 'Dropped' });
  assert.ok(st.tasks.every(t => t.status === 'Dropped'));
  assert.equal(h.as(h.admin, { action: 'task.bulk', ids, op: 'status', status: 'Done' }).ok, false);

  const dry = h.as(h.admin, { action: 'task.import', dryRun: true, rows: [
    { title: 'Call school 1', owner: 'ann', due: '2026-10-10 18:00' },
    { title: 'Call school 2', owner: 'Nobody', due: '2026-10-10 18:00' },
    { title: '', owner: 'Ben', due: 'soon' }] });
  assert.equal(dry.ok, false); assert.equal(dry.errors.length, 2); assert.equal(dry.errors[0].row, 2);
  const imp = h.as(h.admin, { action: 'task.import', rows: [{ title: 'Call school 1', owner: 'Ann', due: '2026-10-10 18:00', steps: ['a', 'b'] }, { title: 'Call school 2', owner: 'ben', due: '2026-10-11' }] });
  assert.equal(imp.ok, true, imp.error); assert.equal(imp.count, 2);

  const all = h.get(h.admin, { action: 'me' }).all;
  assert.equal(all.length, 4);
  assert.equal(new Set(all.map(t => t.id)).size, 4, 'ids are unique');
  const lead = h.addPerson({ name: 'Lia', access: 'lead' });
  assert.equal(h.as(lead, { action: 'task.delete', ids: [ids[0]] }).code, 'forbidden');
  assert.equal(h.as(h.admin, { action: 'task.delete', ids: [ids[0]] }).ok, true);
  assert.equal(h.get(h.admin, { action: 'me' }).all.length, 3);
});

test('status rules, review saved, redo tells the owner', () => {
  const h = setupHub({ starter: false });
  const a = h.addPerson({ name: 'Ann', email: 'ann@example.com', notify: 'email' });
  const t = h.as(h.admin, { action: 'task.add', task: { title: 'Get a quote', owner: a.key, due: future(4) } }).task;
  assert.equal(h.as(a, { action: 'status', id: t.id, status: 'Blocked', reason: 'no' }).ok, false);
  assert.equal(h.as(a, { action: 'status', id: t.id, status: 'Blocked', reason: 'Need the printer phone number from Ben' }).ok, true);
  assert.equal(h.as(h.admin, { action: 'review', id: t.id, verdict: 'ok' }).ok, false, 'cannot approve an unfinished task');
  h.as(a, { action: 'status', id: t.id, status: 'Done', proof: 'Quote: 120 000 sum, Print shop Ali +998 90 000 00 00' });
  const ok = h.as(h.admin, { action: 'review', id: t.id, verdict: 'ok' });
  assert.equal(ok.task.review, 'approved'); assert.equal(ok.task.reviewed_by, 'Ada Lovelace');
  assert.equal(h.get(h.admin, { action: 'me' }).all.find(x => x.id === t.id).review, 'approved', 'approval is stored in the Sheet');
  const before = h.gas._mails.length;
  const redo = h.as(h.admin, { action: 'review', id: t.id, verdict: 'redo', note: 'Need two quotes' });
  assert.equal(redo.task.status, 'In progress'); assert.equal(redo.task.review, 'redo');
  assert.ok(h.gas._mails.slice(before).some(m => m.to === 'ann@example.com' && /redo/i.test(m.subject)));
});

test('people: invite email, reset link, deactivate with reassign, last admin protected', () => {
  const h = setupHub({ starter: false });
  const a = h.addPerson({ name: 'Ann', email: 'ann@example.com' }, { });
  const b = h.addPerson({ name: 'Ben', email: 'ben@example.com' });
  assert.equal(h.addPerson({ name: 'Ann Two' }).key, 'ann2');
  const dup = h.as(h.admin, { action: 'person.add', person: { name: 'X', email: 'ann@example.com' } });
  assert.equal(dup.ok, false);
  const inv = h.as(h.admin, { action: 'person.invite', key: a.key });
  assert.equal(inv.ok, true);
  assert.ok(h.gas._mails.some(m => m.to === 'ann@example.com' && m.htmlBody.includes(a.t)));

  h.as(h.admin, { action: 'task.add', task: { title: 'Open task', owner: a.key, due: future(5) } });
  const reset = h.as(h.admin, { action: 'person.resetLink', key: a.key });
  assert.equal(reset.ok, true);
  assert.equal(h.get(a, { action: 'me' }).code, 'auth', 'old link stops working');

  const d = h.as(h.admin, { action: 'person.deactivate', key: a.key, reassignTo: b.key });
  assert.equal(d.ok, true); assert.equal(d.moved, 1);
  assert.equal(h.get(b, { action: 'me' }).tasks.length, 1);

  assert.equal(h.as(h.admin, { action: 'person.deactivate', key: h.admin.u }).ok, false);
  assert.equal(h.as(h.admin, { action: 'person.edit', person: { key: h.admin.u, access: 'member' } }).ok, false);
  const re = h.as(h.admin, { action: 'person.reactivate', key: a.key });
  assert.equal(re.ok, true); assert.match(re.link, /t=[0-9a-f]{32}/);
});

test('join form: honeypot, validation, rate limit, accept creates a person', () => {
  const h = setupHub({ starter: false });
  assert.equal(h.be.post({ action: 'apply', name: 'Bot', contact: 'bot@x.com', age_group: '13-18', company: 'spam inc' }).ok, true);
  assert.equal(h.get(h.admin, { action: 'me' }).applications.length, 0, 'honeypot is dropped silently');
  assert.equal(h.be.post({ action: 'apply', name: 'Z', contact: '@zz', age_group: '13-18' }).ok, false);
  assert.equal(h.be.post({ action: 'apply', name: 'Zara', contact: '@zara_x', age_group: '40' }).ok, false);
  const ok = h.be.post({ action: 'apply', name: 'Zara', contact: '@zara_x', age_group: '13-18', interest: 'Design' });
  assert.equal(ok.ok, true);
  const again = h.be.post({ action: 'apply', name: 'Zara', contact: '@zara_x', age_group: '13-18' });
  assert.match(again.message, /already/);
  const apps = h.get(h.admin, { action: 'me' }).applications;
  assert.equal(apps.length, 1); assert.equal(apps[0].status, 'new');
  const p = h.as(h.admin, { action: 'person.add', person: { name: 'Zara', handle: '@zara_x' }, fromApplication: apps[0].id });
  assert.equal(p.ok, true);
  assert.equal(h.get(h.admin, { action: 'me' }).applications[0].status, 'accepted');
  for (let i = 0; i < 40; i++) h.be.post({ action: 'apply', name: 'Person ' + i, contact: 'p' + i + '@x.com', age_group: '13-18' });
  assert.match(h.be.post({ action: 'apply', name: 'Late', contact: 'late@x.com', age_group: '13-18' }).error, /Too many/);
  h.as(h.admin, { action: 'settings.save', values: { join_form: false } });
  assert.equal(h.be.post({ action: 'apply', name: 'After', contact: 'after@x.com', age_group: '19+' }).ok, false);
});

test('requestLink: same answer always, emails only a matching person', () => {
  const h = setupHub({ starter: false });
  h.addPerson({ name: 'Ann', email: 'ann@example.com' });
  const n = h.gas._mails.length;
  const r1 = h.be.post({ action: 'requestLink', email: 'nobody@example.com' });
  const r2 = h.be.post({ action: 'requestLink', email: 'ANN@example.com' });
  assert.equal(r1.message, r2.message);
  assert.equal(h.gas._mails.length, n + 1);
  assert.equal(h.gas._mails[n].to, 'ann@example.com');
  h.be.post({ action: 'requestLink', email: 'ann@example.com' });
  assert.equal(h.gas._mails.length, n + 1, 'rate-limited per email');
});

test('settings validation + public page privacy', () => {
  const h = setupHub();
  assert.equal(h.as(h.admin, { action: 'settings.save', values: { timezone: 'Mars/Olympus Mons!' } }).ok, false);
  assert.equal(h.as(h.admin, { action: 'settings.save', values: { signup_url: 'javascript:alert(1)' } }).ok, false);
  assert.equal(h.as(h.admin, { action: 'settings.save', values: { event_start: '2026-11-20', event_end: '2026-11-15' } }).ok, false);
  const ok = h.as(h.admin, { action: 'settings.save', values: { timezone: 'Europe/Berlin', reminder_hour: '19', signup_url: 'https://haven.hackclub.com/springfield' } });
  assert.equal(ok.ok, true, ok.error); assert.equal(ok.settings.timezone, 'Europe/Berlin');

  let pub = h.be.get({ action: 'public' });
  assert.equal(pub.enabled, true);
  assert.equal(pub.team, null, 'team hidden by default');
  assert.equal(pub.progress.total, 13);
  assert.ok(pub.progress.milestones.every(m => ['Event day 1', 'Event day 2 — everyone ships'].includes(m.label)), 'only public milestones');
  assert.equal(JSON.stringify(pub).includes('@example.com'), false);
  assert.equal(JSON.stringify(pub).includes('Ada'), false, 'no organizer names on the public page by default');
  h.as(h.admin, { action: 'settings.save', values: { public_show_team: true } });
  pub = h.be.get({ action: 'public' });
  assert.deepEqual(pub.team.map(p => p.name), ['Ada']);
  h.as(h.admin, { action: 'settings.save', values: { public_page: 'no' } });
  pub = h.be.get({ action: 'public' });
  assert.equal(pub.enabled, false); assert.equal(pub.progress, undefined);
});

test('lists: meetings/rules/milestones saved and validated', () => {
  const h = setupHub({ starter: false });
  assert.equal(h.as(h.admin, { action: 'list.save', tab: 'Meetings', rows: [{ date: 'Sun 4 Oct', time: '19:00', what: 'Kickoff' }] }).ok, false);
  const r = h.as(h.admin, { action: 'list.save', tab: 'Meetings', rows: [{ date: '2026-10-11', time: '19:00', where: 'Call', what: 'Two' }, { date: '2026-10-04', time: '19:00', where: 'Call', what: 'One' }, { what: '' }] });
  assert.equal(r.ok, true); assert.deepEqual(r.rows.map(x => x.what), ['One', 'Two']);
  h.as(h.admin, { action: 'list.save', tab: 'Milestones', rows: [{ date: '2026-11-14', label: 'Day 1', kind: 'event', public: true, done: false }] });
  const me = h.get(h.admin, { action: 'me' });
  assert.equal(me.meetings.length, 2); assert.equal(me.milestones[0].public, true);
  assert.equal(h.as(h.admin, { action: 'list.save', tab: 'People', rows: [] }).ok, false);
});

test('telegram: token saved from the dashboard, /start connects, group report works', () => {
  const h = setupHub({ starter: false });
  const a = h.addPerson({ name: 'Ann' });
  assert.equal(h.as(h.admin, { action: 'tg.setToken', token: 'nope' }).ok, false);
  const r = h.as(h.admin, { action: 'tg.setToken', token: '123456789:AAEabcdefghijklmnopqrstuvwxyz012345' });
  assert.equal(r.ok, true, r.error); assert.equal(r.bot, 'demo_hub_bot');
  assert.ok(h.gas._triggers.some(t => t.fn === 'pollTelegram'));
  const t = h.as(h.admin, { action: 'task.add', task: { title: 'Poster run', owner: a.key, due: future(2) } }).task;
  h.gas._updates.push({ update_id: 1, message: { text: '/start ' + a.t, from: { id: 555, username: 'ann' }, chat: { id: 555, type: 'private' } } });
  h.gas._updates.push({ update_id: 2, message: { text: '/start ' + h.admin.t, from: { id: 777 }, chat: { id: 777, type: 'private' } } });
  h.gas._updates.push({ update_id: 3, message: { text: '/setgroup', from: { id: 777 }, chat: { id: -100, type: 'supergroup', title: 'Team' } } });
  h.be.call('pollTelegram');
  h.gas._updates.push({ update_id: 4, message: { text: `${t.id} done — https://example.com/photo`, from: { id: 555 }, chat: { id: -100, type: 'supergroup' } } });
  h.be.call('pollTelegram');
  const me = h.get(a, { action: 'me' });
  assert.equal(me.me.telegram, true);
  assert.equal(me.tasks[0].status, 'Done');
  assert.ok(h.gas._telegram.some(x => x.method === 'sendMessage' && String(x.payload.chat_id) === '-100' && /finished/.test(x.payload.text)));
});

test('reminders + weekly report go to the right channel', () => {
  const h = setupHub({ starter: false });
  const a = h.addPerson({ name: 'Ann', email: 'ann@example.com' });
  const tomorrow = new Date(Date.now() + 864e5 + 3600e3).toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' }).slice(0, 10);
  h.as(h.admin, { action: 'task.add', task: { title: 'Due soon', owner: a.key, due: tomorrow + ' 23:00' } });
  h.as(h.admin, { action: 'task.add', task: { title: 'Late one', owner: a.key, due: '2020-01-01 10:00' } });
  const n = h.gas._mails.length;
  h.be.call('eveningReminders');
  const mail = h.gas._mails.slice(n).find(m => m.to === 'ann@example.com');
  assert.ok(mail, 'email reminder for someone without Telegram');
  assert.match(mail.body, /Due tomorrow/); assert.match(mail.body, /Overdue/);
  const rep = h.be.call('weeklyReport');
  assert.match(rep, /Weekly report/);
});

test('v3 sheet upgrades in place: tokens kept, is_lead → admin, v3 fields still there', () => {
  const gas = createGas();
  const ss = gas._ss;
  const people = ss.insertSheet('People');
  people.getRange(1, 1, 1, 14).setValues([['key', 'name', 'role', 'area', 'handle', 'token', 'is_lead', 'chat_id', 'active', 'backup', 'works', 'weekend', 'one', 'ask']]);
  const tokA = 'a'.repeat(32), tokB = 'b'.repeat(32);
  people.getRange(2, 1, 3, 14).setValues([
    ['azizbek', 'Azizbek', 'Event Lead (POC)', 'Lead', '', tokA, 'yes', '111', 'yes', '', '', '', 'Three jobs', ''],
    ['abbos', 'Abbos', 'Tech Lead', 'Tech', '', tokB, 'no', '', 'yes', 'Kamal', '', '', 'Referral', 'Ask Dilmurod'],
    ['kumush', 'Kumush', 'Media', 'Media', '', '', 'no', '', 'no', '', '', '', '', '']]);
  const tasks = ss.insertSheet('Tasks');
  tasks.getRange(1, 1, 1, 16).setValues([['id', 'owner', 'title', 'due', 'mins', 'why', 'steps', 'done_when', 'links', 'ask', 'status', 'proof', 'blocked_reason', 'started_at', 'done_at', 'updated_at']]);
  tasks.getRange(2, 1, 2, 16).setValues([
    ['T001', 'abbos', 'Build referral page', '2026-10-09 20:00', '120', 'Why', 'Step 1\nStep 2', 'Live URL', 'Guide | https://example.com', '', 'In progress', '', '', '2026-09-29 10:00', '', '2026-09-29 10:00'],
    ['T002', 'azizbek', 'Venue', new Date('2026-10-12T15:00:00Z'), '60', '', '', '', '', '', 'Not started', '', '', '', '', '']]);
  ss.insertSheet('Log').getRange(1, 1, 1, 5).setValues([['time', 'who', 'task', 'action', 'note']]);
  gas._props.SITE_URL = 'https://notazizelse.github.io/haven-tashkent_files';
  gas._props.BOT_TOKEN = '1:x'; gas._props.BOT_USERNAME = 'haven_tashkent_bot'; gas._props.GROUP_CHAT_ID = '-1';

  const be = loadBackend(CODE, gas);
  // v3 frontend call shape
  const r = be.get({ action: 'me', u: 'azizbek', t: tokA });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.me.lead, true); assert.equal(r.me.admin, true); assert.equal(r.me.telegram, true);
  ['now', 'me', 'bot', 'team', 'tasks', 'rules', 'meetings', 'all', 'lastSeen', 'log', 'telegram', 'group'].forEach(k => assert.ok(k in r, 'v3 field ' + k));
  assert.equal(r.bot, 'haven_tashkent_bot');
  assert.equal(r.all.find(t => t.id === 'T002').due, '2026-10-12 20:00', 'hand-formatted date cell read in the hub time zone');
  assert.equal(r.team.length, 2, 'inactive person hidden');
  const b = be.get({ action: 'me', u: 'abbos', t: tokB });
  assert.equal(b.me.access, 'member'); assert.equal(b.tasks[0].steps.length, 2);
  const hdr = people.getRange(1, 1, 1, 18).getValues()[0];
  assert.ok(['email', 'access', 'notify', 'joined_at'].every(k => hdr.includes(k)), 'new People columns appended');
  assert.equal(people.getRange(2, 6).getValue(), tokA, 'token column untouched');
  assert.ok(ss.getSheetByName('Settings'));
  assert.equal(r.publicLink, 'https://notazizelse.github.io/haven-tashkent_files/');
  // v3 POST names still work
  const add = be.post({ action: 'add', t: tokA, u: 'azizbek', task: { owner: 'abbos', title: 'New thing', due: '2026-10-15 18:00', mins: 30, steps: [] } });
  assert.equal(add.ok, true, add.error); assert.equal(add.task.id, 'T003');
  const st = be.post({ action: 'status', t: tokB, u: 'abbos', id: 'T001', status: 'Done', proof: 'https://referral.example' });
  assert.equal(st.ok, true);
});

test('unknown actions and GET on write actions are refused', () => {
  const h = setupHub({ starter: false });
  assert.equal(h.get(h.admin, { action: 'nope' }).ok, false);
  assert.equal(h.get(h.admin, { action: 'task.add' }).error, 'Use POST.');
  assert.equal(h.get(h.admin, { action: 'constructor' }).ok, false);
});

test('change alerts: owners hear about new dates, removals and moves; admins get one summary; the switch off = silence', () => {
  const h = setupHub({ starter: false });
  const a = h.addPerson({ name: 'Ann', email: 'ann@example.com' }), b = h.addPerson({ name: 'Ben', email: 'ben@example.com' });
  const mailsTo = (to, from) => h.gas._mails.slice(from).filter(m => m.to === to);
  const t = h.as(h.admin, { action: 'task.add', task: { title: 'Posters', owner: a.key, due: '2026-10-14 20:00' } }).task;
  assert.ok(mailsTo('ann@example.com', 0).some(m => /New task: Posters/.test(m.subject)), 'no Telegram → email');

  let n = h.gas._mails.length;
  assert.equal(h.as(h.admin, { action: 'task.edit', task: { id: t.id, due: '2026-10-16 18:00' } }).ok, true);
  const ann = mailsTo('ann@example.com', n);
  assert.equal(ann.length, 1); assert.match(ann[0].subject, /New date: Posters/);
  assert.match(ann[0].body, /now Fri 16 Oct 18:00 \(was Wed 14 Oct 20:00\)/);
  const rc = mailsTo('ada@example.com', n);
  assert.equal(rc.length, 1, 'the admin gets one summary'); assert.match(rc[0].body, /Task changes by you/); assert.match(rc[0].body, /Ann — told by email/);

  n = h.gas._mails.length;
  h.as(h.admin, { action: 'task.edit', task: { id: t.id, title: 'Posters', due: '2026-10-16 18:00' } });
  assert.equal(h.gas._mails.length, n, 'nothing changed → nothing sent');
  h.as(h.admin, { action: 'task.edit', task: { id: t.id, due: '2026-10-17 18:00' }, notify: false });
  assert.equal(h.gas._mails.length, n, '"Tell people" off → silent');

  h.as(h.admin, { action: 'task.bulk', ids: [t.id], op: 'reassign', owner: b.key });
  assert.ok(mailsTo('ann@example.com', n).some(m => /moved to Ben/.test(m.body)), 'the old owner is told');
  assert.ok(mailsTo('ben@example.com', n).some(m => /was Ann's/.test(m.body)), 'the new owner is told');

  n = h.gas._mails.length;
  h.as(h.admin, { action: 'task.delete', ids: [t.id] });
  assert.ok(mailsTo('ben@example.com', n).some(m => /Posters — removed/.test(m.body)));

  const more = ['Call school', 'Print flyers', 'Book room'].map((title, i) => h.as(h.admin, { action: 'task.add', task: { title, owner: b.key, due: `2026-10-2${i} 18:00` } }).task);
  n = h.gas._mails.length;
  h.as(b, { action: 'status', id: more[0].id, status: 'In progress' });
  assert.equal(mailsTo('ben@example.com', n).length, 0, 'your own status change is not an alert');
  h.as(h.admin, { action: 'task.bulk', ids: more.map(x => x.id), op: 'shift', days: 2 });
  const shifted = mailsTo('ben@example.com', n);
  assert.equal(shifted.length, 1, 'one message for the whole bulk change'); assert.equal((shifted[0].body.match(/📅/g) || []).length, 3);

  h.as(h.admin, { action: 'settings.save', values: { change_alerts: 'no' } });
  n = h.gas._mails.length;
  h.as(h.admin, { action: 'task.bulk', ids: [more[1].id], op: 'status', status: 'Dropped' });
  assert.equal(h.gas._mails.length, n, 'setting off → no alerts');
});

test('update the whole plan: dry run changes nothing, apply keeps status + proof, drops missing open tasks (never done ones), renumbers by date', () => {
  const h = setupHub({ starter: false });
  const a = h.addPerson({ name: 'Ann', email: 'ann@example.com' }), b = h.addPerson({ name: 'Ben', email: 'ben@example.com' });
  const add = (title, owner, due) => h.as(h.admin, { action: 'task.add', task: { title, owner, due } }).task;
  const late = add('Late thing', a.key, '2026-10-20 18:00'), early = add('Early thing', a.key, '2026-10-05 18:00');
  const done = add('Done thing', b.key, '2026-10-01 18:00'), old = add('Old idea', b.key, '2026-10-10 18:00');
  h.as(b, { action: 'status', id: done.id, status: 'Done', proof: 'Photo: https://example.com/p.jpg' });
  const rows = [
    { id: late.id, title: 'Late thing', owner: 'ann', due: '2026-10-21 18:00' },
    { id: early.id.toLowerCase(), title: 'Early thing, renamed', owner: 'Ben', due: '2026-10-05 18:00' },
    { title: 'Brand new', owner: 'Ann', due: '2026-10-03 12:00', steps: ['One', 'Two'] },
  ];
  let n = h.gas._mails.length;
  const dry = h.as(h.admin, { action: 'task.sync', rows, dryRun: true, dropMissing: true, renumber: true });
  assert.equal(dry.ok, true, dry.error);
  assert.deepEqual([dry.added, dry.updated, dry.dropped], [1, 2, 1]);
  assert.ok(dry.changes.some(c => c.who === 'Ben' && /Old idea — dropped/.test(c.text)));
  assert.equal(h.gas._mails.length, n, 'a dry run sends nothing');
  assert.equal(h.get(h.admin, { action: 'me' }).all.find(t => t.id === old.id).status, 'Not started', 'a dry run changes nothing');
  assert.equal(h.as(h.admin, { action: 'task.sync', rows: [{ id: 'T999', title: 'x', owner: 'ann', due: '2026-10-01' }] }).ok, false);
  assert.equal(h.as(a, { action: 'task.sync', rows }).code, 'forbidden', 'admins only');

  const res = h.as(h.admin, { action: 'task.sync', rows, dropMissing: true, renumber: true });
  assert.equal(res.ok, true, res.error);
  const by = Object.fromEntries(h.get(h.admin, { action: 'me' }).all.map(t => [t.title, t]));
  assert.deepEqual(['Done thing', 'Brand new', 'Early thing, renamed', 'Late thing', 'Old idea'].map(x => by[x].id), ['T001', 'T002', 'T003', 'T004', 'T005'], 'numbers follow the dates; dropped last');
  assert.equal(by['Done thing'].status, 'Done'); assert.match(by['Done thing'].proof, /p\.jpg/, 'status + proof kept');
  assert.equal(by['Early thing, renamed'].owner, b.key); assert.equal(by['Late thing'].due, '2026-10-21 18:00');
  assert.equal(by['Old idea'].status, 'Dropped'); assert.deepEqual(by['Brand new'].steps, ['One', 'Two']);
  assert.equal(res.renumbered[old.id], 'T005');
  const ann = h.gas._mails.slice(n).filter(m => m.to === 'ann@example.com');
  assert.equal(ann.length, 1, 'one message per person'); assert.match(ann[0].subject, /task plan was updated/i);
  assert.match(ann[0].body, /1 new · 1 removed · 1 new date/); assert.match(ann[0].body, /T002 Brand new/, 'next up uses the new numbers');
});

test('files: links (Canva, Sheets…) for leads, what each task needs, private links hidden from guests', () => {
  const h = setupHub({ starter: false });
  const lead = h.addPerson({ name: 'Omar Lead', access: 'lead' }), mem = h.addPerson({ name: 'Lina Member' }), guest = h.addPerson({ name: 'Rivera Guest', access: 'viewer' });
  assert.equal(h.as(mem, { action: 'resource.save', resource: { title: 'X', url: 'https://example.com' } }).code, 'forbidden');
  assert.equal(h.as(lead, { action: 'resource.save', resource: { title: 'Bad', url: 'javascript:alert(1)' } }).ok, false);
  const r1 = h.as(lead, { action: 'resource.save', resource: { title: 'Flyer (UZ) — edit', url: 'https://www.canva.com/d/abc', section: 'Posters & flyers' } });
  assert.equal(r1.ok, true, r1.error); assert.equal(r1.resource.kind, 'canva'); assert.equal(r1.resource.id, 'r1');
  const bulk = h.as(h.admin, { action: 'resource.save', resources: [
    { id: 'schools-tracker', title: 'Schools tracker', url: 'https://docs.google.com/spreadsheets/d/xyz/edit', section: 'Trackers', private: true },
    { id: 'brand-guide', title: 'Brand guide', url: 'https://www.figma.com/design/abc/Brand' }] });
  assert.equal(bulk.ok, true, bulk.error); assert.equal(bulk.resources.length, 3);
  assert.equal(bulk.resources.find(r => r.id === 'schools-tracker').kind, 'sheet');
  // re-importing the same ids updates them, no duplicates
  assert.equal(h.as(h.admin, { action: 'resource.save', resources: [{ id: 'brand-guide', title: 'HQ brand guide', url: 'https://www.figma.com/design/abc/Brand' }] }).resources.length, 3);
  // tasks list what they need: Files ids and gh: paths in the team files repo
  assert.equal(h.as(lead, { action: 'task.add', task: { title: 'Bad ref', owner: mem.key, due: future(3), resources: ['nope'] } }).ok, false);
  assert.equal(h.as(lead, { action: 'task.add', task: { title: 'Bad path', owner: mem.key, due: future(3), resources: ['gh:../secret'] } }).ok, false);
  const t = h.as(lead, { action: 'task.add', task: { title: 'Print the flyers', owner: mem.key, due: future(3), resources: ['r1', 'schools-tracker', 'gh:posters-and-flyers/', 'gh:brand-kit/logos/haven-logo.png', 'r1'] } });
  assert.equal(t.ok, true, t.error);
  assert.deepEqual(t.task.resources.map(r => r.ref), ['r1', 'schools-tracker', 'gh:posters-and-flyers/', 'gh:brand-kit/logos/haven-logo.png']);
  assert.equal(t.task.resources[2].folder, true); assert.equal(t.task.resources[2].path, 'posters-and-flyers');
  assert.equal(t.task.resources[3].title, 'haven-logo.png'); assert.equal(t.task.resources[0].kind, 'canva');
  // the owner sees them; a guest sees the task without the private tracker, and no private links in Files
  assert.equal(h.get(mem, { action: 'me' }).tasks.find(x => x.id === t.task.id).resources.length, 4);
  const g = h.get(guest, { action: 'me' });
  assert.equal(g.all.find(x => x.id === t.task.id).resources.some(r => r.private), false);
  assert.equal(g.resources.some(r => r.id === 'schools-tracker'), false);
  assert.equal(h.get(guest, { action: 'files.list' }).resources.some(r => r.private), false);
  assert.equal(h.get(mem, { action: 'files.list' }).resources.length, 3);
  // the team files repo is a setting (a pasted GitHub address is tidied up)
  assert.equal(h.as(h.admin, { action: 'settings.save', values: { files_repo: 'not a repo' } }).ok, false);
  assert.equal(h.as(h.admin, { action: 'settings.save', values: { files_repo: 'https://github.com/team/haven-team-files.git' } }).settings.files_repo, 'team/haven-team-files');
  assert.deepEqual(h.get(mem, { action: 'me' }).files, { repo: 'team/haven-team-files', branch: 'main', server: false });
  assert.ok(h.get(mem, { action: 'me' }).features.includes('files'));
  // changing what a task needs keeps working; deleting a link that tasks use asks first
  assert.equal(h.as(lead, { action: 'task.edit', task: { id: t.task.id, resources: ['r1'] } }).task.resources.length, 1);
  const del = h.as(lead, { action: 'resource.delete', id: 'r1' });
  assert.equal(del.ok, false); assert.equal(del.code, 'used');
  assert.deepEqual(h.as(lead, { action: 'resource.delete', id: 'r1', force: true }).tasks, [t.task.id]);
  assert.equal(h.get(mem, { action: 'me' }).tasks.find(x => x.id === t.task.id).resources.length, 0);
  assert.equal(h.get(h.admin, { action: 'export' }).data.Resources.length, 2);
});

test('relink: task links into an old repo move to Files, nobody is told, the rest stays', () => {
  const h = setupHub({ starter: false });
  const mem = h.addPerson({ name: 'Lina Member' });
  h.as(h.admin, { action: 'resource.save', resource: { id: 'schools-tracker', title: 'Schools tracker', url: 'https://docs.google.com/spreadsheets/d/xyz/edit' } });
  const OLD = 'https://github.com/someone/old-files';
  const t = h.as(h.admin, { action: 'task.add', notify: false, task: { title: 'Call schools', owner: mem.key, due: future(2), links: [
    `Schools tracker | ${OLD}/blob/main/trackers/schools-tracker.csv`,
    `Flyers | ${OLD}/tree/main/design/flyers`,
    `Old readme | ${OLD}/blob/main/README.md`,
    `Talk (UZ) | ${OLD}/blob/main/Claude%20outputs/Haven%20%E2%80%94%20School%20Talk%20(UZ).pdf`,
    'HQ video | https://cdn.hackclub.com/x/Haven.mp4',
    `Unknown | ${OLD}/blob/main/somewhere/else.md`].join('\n') } }).task;
  const map = { 'trackers/schools-tracker.csv': 'schools-tracker', 'design/flyers/': 'gh:posters-and-flyers/', 'README.md': '',
    'Claude outputs/Haven — School Talk (UZ).pdf': 'https://example.com/talk-uz.pdf' };
  assert.equal(h.as(h.admin, { action: 'task.relink', prefix: OLD, map: { x: 'not-a-thing' } }).ok, false);
  const dry = h.as(h.admin, { action: 'task.relink', prefix: OLD + '/', map, dryRun: true });
  assert.equal(dry.ok, true, dry.error);
  assert.deepEqual([dry.tasks, dry.moved, dry.rewritten, dry.dropped], [1, 2, 1, 1]);
  assert.deepEqual(dry.unmapped, [{ task: t.id, path: 'somewhere/else.md' }]);
  assert.equal(h.get(mem, { action: 'me' }).tasks[0].links.length, 6, 'a dry run changes nothing');
  const msgs = h.gas._telegram.length + h.gas._mails.length;
  assert.equal(h.as(h.admin, { action: 'task.relink', prefix: OLD, map }).ok, true);
  const after = h.get(mem, { action: 'me' }).tasks[0];
  assert.deepEqual(after.resources.map(r => r.ref), ['schools-tracker', 'gh:posters-and-flyers/']);
  assert.deepEqual(after.links.map(l => l.label), ['Talk (UZ)', 'HQ video', 'Unknown']);
  assert.equal(after.links[0].url, 'https://example.com/talk-uz.pdf');
  assert.equal(h.gas._telegram.length + h.gas._mails.length, msgs, 'nobody is messaged');
  // the plan CSV round-trips the new column
  const sync = h.as(h.admin, { action: 'task.sync', dryRun: true, rows: [{ id: after.id, title: after.title, owner: mem.key, due: after.due, resources: 'schools-tracker' }] });
  assert.equal(sync.ok, true, sync.error); assert.equal(sync.updated, 1);
});
