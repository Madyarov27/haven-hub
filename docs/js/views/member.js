/* Views every organizer sees: My tasks, Calendar (month grid), Team, Rules, Profile (+ password sign-in on own-server hubs). */
import { $, esc, icon, avatar, kpi, empty, dueInfo, parseLocal, fmtDay, DAY, first, copy, toast, busy, field, plural, confirmBox, bar, ago, debounce, imageData, googleG } from '../ui.js';
import { taskCard, wireTasks } from '../task-card.js';
import { googleStart } from '../google.js';
import { taskDrawer } from './admin-tasks.js';

const byDue = (a, b) => a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
let lastChanged = '';

export function myTasks(ctx) {
  const D = ctx.D, me = D.me, tz = ctx.tz, ev = D.event || {};
  const ts = D.tasks.slice().sort(byDue), open = ts.filter(t => !['Done', 'Dropped'].includes(t.status));
  const over = open.filter(t => dueInfo(t, tz).over), week = open.filter(t => !over.includes(t) && parseLocal(t.due, tz) - Date.now() < 7 * DAY);
  const later = open.filter(t => !over.includes(t) && !week.includes(t)), done = ts.filter(t => t.status === 'Done');
  const card = (t, i, first) => taskCard(ctx, t, { open: t.id === lastChanged ? t.status !== 'Done' : first && i === 0 });
  const pct = ts.length ? Math.round(100 * done.length / ts.filter(t => t.status !== 'Dropped').length) : 0;
  let h = `<div class="card"><div class="person-card">${avatar(me.name, 'lg')}<div class="info"><h2 style="font-size:24px">${esc(ev.greeting || 'Hi')}, ${esc(first(me.name))}!</h2>
    <div class="muted"><b>${esc(me.role || '')}</b>${me.area ? ' · ' + esc(me.area) : ''} · this page shows only your tasks</div>${me.one ? `<p style="margin:6px 0 0">${esc(me.one)}</p>` : ''}</div></div></div>`;
  if (!me.telegram && !me.email && me.notify !== 'none') h += `<div class="banner info">${icon('bell')}<div>Get a reminder the evening before each deadline: <a href="#/profile">connect Telegram or add your email</a>.</div></div>`;
  h += `<div class="kpis">${kpi('overdue', over.length, { tone: over.length ? 'bad' : '', icon: 'alert' })}${kpi('due this week', week.length, { icon: 'calendar' })}${kpi('done', done.length, { tone: 'ok', icon: 'check' })}${kpi('of my tasks done', pct + '%', { icon: 'award' })}</div>`;
  if (!ts.length && !(D.open || []).length) h += `<div class="card">${empty({ title: 'No tasks yet', text: 'When your lead gives you a task it shows up here — with the steps, the deadline and who to ask.' })}</div>`;
  if (over.length) h += `<h3 class="section-t">${icon('alert')} Overdue — finish it, or press “I'm blocked”</h3>` + over.map((t, i) => card(t, i, true)).join('');
  if (open.length) h += `<h3 class="section-t">This week</h3>` + (week.length ? week.map((t, i) => card(t, i, !over.length)).join('') : `<p class="muted">Nothing due in the next 7 days.</p>`);
  if (later.length) h += `<h3 class="section-t">Later</h3>` + later.map((t, i) => card(t, i, false)).join('');
  const grabs = ctx.hasUnassigned ? (D.open || []).slice().sort(byDue) : [];
  if (grabs.length) h += `<h3 class="section-t">${icon('inbox')} Up for grabs — nobody has these yet</h3>${D.selfClaim ? '' : '<p class="small muted">Want one? Ask a lead to give it to you.</p>'}` + grabs.map(t => taskCard(ctx, t, { take: D.selfClaim })).join('');
  if (done.length) h += `<h3 class="section-t">Done (${done.length})</h3>` + done.slice().reverse().map((t, i) => card(t, i, false)).join('');
  if (me.ask || me.weekend || me.backup) {
    h += `<div class="grid-2" style="margin-top:22px">`;
    if (me.ask) h += `<div class="card"><h3 style="margin-bottom:8px">Who to ask</h3><p style="white-space:pre-line;margin:0">${esc(me.ask)}</p></div>`;
    if (me.weekend) h += `<div class="card"><h3 style="margin-bottom:8px">Your event-weekend job</h3><p style="margin:0">${esc(me.weekend)}</p></div>`;
    if (me.backup && !me.ask) h += `<div class="card"><h3 style="margin-bottom:8px">Your backup</h3><p style="margin:0">${esc(me.backup)}</p></div>`;
    h += `</div>`;
  }
  ctx.el.innerHTML = h;
  wireTasks(ctx.el, ctx, t => { lastChanged = t.id; ctx.patchTask(t); ctx.render(); });
}

// ------------------------------------------------------------------ Calendar: a month grid (weeks start on Monday); pick a day to see and act on it
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const cal = { month: '', day: '', who: 'me' };
const isDay = s => /^\d{4}-\d\d-\d\d$/.test(String(s || ''));
const ymdAdd = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monthAdd = (ym, n) => { const d = new Date(ym + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };

export function calendar(ctx) {
  const D = ctx.D, tz = ctx.tz, ev = D.event || {}, today = isDay((D.now || '').slice(0, 10)) ? D.now.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const qm = new URLSearchParams(location.hash.split('?')[1] || '').get('m');
  cal.month = /^\d{4}-\d\d$/.test(qm || '') ? qm : cal.month || today.slice(0, 7);
  const who = !D.all ? 'me' : ctx.isViewer && cal.who === 'me' ? 'all' : cal.who;
  const src = who === 'me' ? (D.tasks || []) : (D.all || []).filter(t => who === 'all' || t.owner === who);
  const taskCls = t => t.status === 'Done' ? 'done' : t.status === 'Blocked' ? 'blk' : dueInfo(t, tz).over ? 'over' : 'open';
  const items = {}, put = (d, x) => { (items[d] = items[d] || []).push(x); };
  src.forEach(t => { if (t.status !== 'Dropped' && isDay(String(t.due || '').slice(0, 10))) put(t.due.slice(0, 10), { kind: 'task', t, time: t.due.slice(11, 16), label: (who === 'me' ? '' : first(ctx.nameOf(t.owner)) + ': ') + t.title, cls: taskCls(t) }); });
  (D.meetings || []).forEach(m => { if (isDay(m.date)) put(m.date, { kind: 'meet', m, time: m.time || '', label: m.what || 'Meeting', cls: '' }); });
  (D.milestones || []).forEach(m => { if (isDay(m.date)) put(m.date, { kind: 'mile', m, time: '', label: m.label, cls: (m.kind === 'gate' ? 'gate' : m.kind === 'event' ? 'ev' : '') + (m.done ? ' done' : '') }); });
  const ORDER = { mile: 0, meet: 1, task: 2 };
  Object.keys(items).forEach(d => items[d].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || (a.time < b.time ? -1 : a.time > b.time ? 1 : 0)));
  const isEvent = d => isDay(ev.start) && d >= ev.start && d <= (isDay(ev.end) ? ev.end : ev.start);
  const m0 = cal.month + '-01', lead = (new Date(m0 + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const dim = new Date(Date.UTC(+cal.month.slice(0, 4), +cal.month.slice(5, 7), 0)).getUTCDate();
  const days = Array.from({ length: Math.ceil((lead + dim) / 7) * 7 }, (_, i) => ymdAdd(m0, i - lead));
  if (!cal.day || cal.day.slice(0, 7) !== cal.month) cal.day = today.slice(0, 7) === cal.month ? today : days.find(d => d.slice(0, 7) === cal.month && items[d]) || m0;
  const title = new Date(m0 + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const chip = x => `<span class="cc k-${x.kind} ${x.cls}">${x.kind === 'meet' && x.time ? `<i>${esc(x.time)}</i> ` : ''}${esc(x.label)}</span>`;
  const cell = d => {
    const l = items[d] || [], cls = ['cal-d', d.slice(0, 7) !== cal.month && 'out', d < today && 'past', d === today && 'today', isEvent(d) && 'event', d === cal.day && 'sel'].filter(Boolean).join(' ');
    const label = fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long' }) + (d === today ? ', today' : '') + (l.length ? ', ' + plural(l.length, 'item') : '');
    return `<button type="button" class="${cls}" data-day="${d}" tabindex="${d === cal.day ? 0 : -1}" aria-label="${esc(label)}" aria-pressed="${d === cal.day}">
      <span class="cal-n">${Number(d.slice(8))}</span><span class="cal-chips">${l.slice(0, 3).map(chip).join('')}${l.length > 3 ? `<span class="cc more">+${l.length - 3} more</span>` : ''}</span>
      <span class="cal-dots">${l.slice(0, 4).map(x => `<i class="dt k-${x.kind} ${x.cls}"></i>`).join('')}</span></button>`;
  };
  const whoCtl = D.all ? `<div class="seg" role="group" aria-label="Whose tasks">${ctx.isViewer ? '' : `<button type="button" data-who="me" class="${who === 'me' ? 'on' : ''}">Mine</button>`}<button type="button" data-who="all" class="${who === 'all' ? 'on' : ''}">Everyone</button></div>
    <select id="cal-p" aria-label="Show one person">${[['', 'One person…']].concat(D.team.map(p => [p.key, p.name])).map(([k, n]) => `<option value="${esc(k)}" ${who === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : '';

  const dayPanel = () => {
    const d = cal.day, l = items[d] || [], tasks = l.filter(x => x.kind === 'task').map(x => x.t);
    let h = `<div class="card cal-day"><div class="card-h"><h3>${esc(fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>${d === today ? '<span class="pill ip">today</span>' : ''}${isEvent(d) ? '<span class="pill ok">event</span>' : ''}</div>`;
    l.filter(x => x.kind === 'mile').forEach(x => { h += `<div class="cal-it k-mile ${x.cls}">${icon(x.m.done ? 'check' : 'flag')}<div><b>${esc(x.m.label)}</b><div class="small muted">${x.m.kind === 'gate' ? 'must-have gate' : x.m.kind === 'event' ? 'event' : 'deadline'}${x.m.done ? ' · done' : ''}</div></div></div>`; });
    l.filter(x => x.kind === 'meet').forEach(x => { h += `<div class="cal-it k-meet">${icon('clock')}<div><b>${esc([x.m.time, x.m.what || 'Meeting'].filter(Boolean).join(' · '))}</b>${x.m.where ? `<div class="small muted">${esc(x.m.where)}</div>` : ''}</div></div>`; });
    if (tasks.length) h += `<div class="cal-tasks">${tasks.map(t => taskCard(ctx, t, { showOwner: who !== 'me' })).join('')}</div>`;
    if (!l.length) h += `<p class="muted" style="margin:0 0 4px">Nothing on this day.</p>`;
    if (ctx.isLead) h += `<div class="actions"><button type="button" class="btn soft sm" id="cal-add">${icon('plus')} Task on this day</button></div>`;
    return h + '</div>';
  };
  const next = Object.keys(items).filter(d => d >= today).sort().flatMap(d => items[d].filter(x => x.kind !== 'task' || x.t.status !== 'Done').map(x => [d, x])).slice(0, 6);
  const upcoming = `<div class="card"><div class="card-h"><h3>Coming up</h3></div><ul class="cal-up">${next.map(([d, x]) => `<li><button type="button" class="linkbtn" data-go="${d}">${esc(fmtDay(d))}</button>${chip(x)}</li>`).join('') || '<li class="muted">Nothing coming up.</li>'}</ul></div>`;

  ctx.el.innerHTML = `<p class="lede">All times are ${esc(tz)} time. Can't come to a meeting? Post your 3 lines (finished · next · blocked) in the group before it starts.</p>
    <div class="cal-wrap"><div class="card flush cal">
      <div class="cal-head"><div class="row" style="gap:4px;flex-wrap:nowrap"><button type="button" class="icon-btn" data-nav="-1" aria-label="Previous month">${icon('left')}</button><h2 aria-live="polite">${esc(title)}</h2><button type="button" class="icon-btn" data-nav="1" aria-label="Next month">${icon('right')}</button></div>
        <button type="button" class="btn ghost sm" data-nav="0">Today</button><span class="spacer"></span>${whoCtl}</div>
      <div class="cal-grid" role="group" aria-label="${esc(title)}">${WD.map(w => `<div class="cal-wd" aria-hidden="true">${w}</div>`).join('')}${days.map(cell).join('')}</div>
      <div class="cal-legend small muted"><span><i class="dt k-task open"></i>to do</span><span><i class="dt k-task over"></i>overdue</span><span><i class="dt k-task blk"></i>blocked</span><span><i class="dt k-task done"></i>done</span><span><i class="dt k-meet"></i>meeting</span><span><i class="dt k-mile gate"></i>milestone</span>${isDay(ev.start) ? '<span><i class="dt ev"></i>event days</span>' : ''}</div>
    </div><div class="cal-side">${dayPanel()}${upcoming}</div></div>`;

  const redraw = focus => {
    history.replaceState(null, '', location.pathname + location.search + '#/calendar?m=' + cal.month);
    calendar(ctx);
    if (focus) { const c = ctx.el.querySelector('.cal-d.sel'); if (c) c.focus(); }
  };
  ctx.el.onclick = e => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { const n = Number(nav.dataset.nav); cal.month = n ? monthAdd(cal.month, n) : today.slice(0, 7); cal.day = n ? '' : today; return redraw(); }
    const dd = e.target.closest('[data-day],[data-go]');
    if (dd) {
      cal.day = dd.dataset.day || dd.dataset.go; cal.month = cal.day.slice(0, 7); redraw(false);
      const panel = $('.cal-day', ctx.el), r = panel && panel.getBoundingClientRect();
      if (r && (r.top > innerHeight - 80 || r.bottom < 0)) panel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    const w = e.target.closest('[data-who]');
    if (w) { cal.who = w.dataset.who; return redraw(); }
    if (e.target.closest('#cal-add')) taskDrawer(ctx, null, { due: cal.day + ' 20:00', owner: who === 'me' ? D.me.key : who !== 'all' ? who : '' });
  };
  const sel = $('#cal-p'); if (sel) sel.onchange = e => { cal.who = e.target.value || 'all'; redraw(); };
  $('.cal-grid', ctx.el).onkeydown = e => {
    const k = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!k) return;
    e.preventDefault(); cal.day = ymdAdd(cal.day, k); cal.month = cal.day.slice(0, 7); redraw(true);
  };
  const tl = $('.cal-tasks', ctx.el);
  if (tl) wireTasks(tl, ctx, t => { ctx.patchTask(t); calendar(ctx); });
}

/** The team: photo cards (everyone in one grid, or grouped by area); each opens that person's page. Leads also see how each person is doing. */
let teamQ = '', teamBy = 'all';
export function team(ctx) {
  const D = ctx.D, tz = ctx.tz, lead = ctx.isLead || ctx.isViewer, all = (D.all || []).filter(t => t.status !== 'Dropped'), seen = D.lastSeen || {};
  const areaOf = p => p.area || 'Team', rank = a => a === 'Lead' ? '0' : '1' + a;
  const list = D.team.filter(p => !teamQ || (p.name + ' ' + p.role + ' ' + p.area + ' ' + (p.handle || '')).toLowerCase().includes(teamQ.toLowerCase()))
    .sort((a, b) => rank(areaOf(a)).localeCompare(rank(areaOf(b))) || a.name.localeCompare(b.name));
  const areas = [...new Set(list.map(areaOf))], noPhoto = D.team.filter(p => !p.photo).length;
  const cardOf = p => {
    const mine = all.filter(t => t.owner === p.key), done = mine.filter(t => t.status === 'Done').length, open = mine.filter(t => t.status !== 'Done');
    const over = open.filter(t => dueInfo(t, tz).over).length, blk = open.filter(t => t.status === 'Blocked').length;
    return `<a class="card pcard ${lead && (over || blk) ? 'warn' : ''}" href="#/team/${esc(p.key)}">${avatar(p.name, 'xl', p.photo)}
      <div class="pc-name"><b>${esc(p.name)}</b>${p.key === D.me.key ? ' <span class="pill ip">you</span>' : ''}${p.access === 'admin' || p.access === 'lead' ? ` <span class="pill ${p.access}">${esc(p.access)}</span>` : ''}</div>
      <div class="small muted">${esc(p.role || '—')}${teamBy === 'all' && p.area ? ` · <span class="tag">${esc(p.area)}</span>` : ''}</div>${p.one ? `<p class="small pc-one">${esc(p.one)}</p>` : ''}
      ${lead && mine.length ? `<div class="pc-stats">${bar(100 * done / mine.length, over ? 'warn' : '')}<span class="small"><b>${done}/${mine.length}</b> done${over ? ` · <span class="due over">${over} overdue</span>` : ''}${blk ? ` · <span class="due over">${blk} blocked</span>` : ''}</span></div>` : ''}
      ${lead ? `<div class="small muted">${seen[p.name] ? 'active ' + esc(ago(seen[p.name], tz)) : 'no activity yet'}</div>` : ''}</a>`;
  };
  let h = `<div class="toolbar"><p class="lede" style="margin:0;flex:1 1 260px">${D.team.length} people on the ${esc(D.event.name)} team. ${lead ? 'Open anyone to see everything about them.' : 'Open anyone to see what they do.'}</p>
    <div class="seg" role="group" aria-label="Show"><button data-by="all" class="${teamBy === 'all' ? 'on' : ''}">Everyone</button><button data-by="area" class="${teamBy === 'area' ? 'on' : ''}">By area</button></div>
    <label class="search"><span class="sr">Search the team</span>${icon('search')}<input id="tq" type="search" placeholder="Search…" value="${esc(teamQ)}"></label></div>`;
  if (!D.me.photo && !ctx.isViewer && !(ctx.api.DEMO && ctx.api.params.has('shot'))) h += `<div class="banner info">${icon('camera')}<div>Add your photo so the team knows who you are — <a href="#/profile">Profile → Photo</a>.${lead && noPhoto > 1 ? ` (${noPhoto} people have none yet.)` : ''}</div></div>`;
  if (!list.length) h += `<div class="card">${empty({ title: 'Nobody matches', text: 'Try another name.' })}</div>`;
  else if (teamBy === 'all') h += `<div class="cards people-cards">${list.map(cardOf).join('')}</div>`;
  else h += areas.map(a => `<h3 class="section-t">${esc(a)} <span class="small muted">${list.filter(p => areaOf(p) === a).length}</span></h3><div class="cards people-cards">${list.filter(p => areaOf(p) === a).map(cardOf).join('')}</div>`).join('');
  ctx.el.innerHTML = h;
  ctx.el.querySelector('.seg').onclick = e => { const b = e.target.closest('[data-by]'); if (b) { teamBy = b.dataset.by; team(ctx); } };
  $('#tq').oninput = debounce(e => { teamQ = e.target.value.trim(); const pos = e.target.selectionStart; team(ctx); const i = $('#tq'); i.focus(); i.setSelectionRange(pos, pos); }, 200);
}

export function rules(ctx) {
  const R = ctx.D.rules || [];
  ctx.el.innerHTML = `<p class="lede">They exist so nobody has to chase anybody.</p>
    <div class="grid-2"><div class="card"><div class="card-h"><h3>Team rules</h3></div>${R.length ? R.map((r, i) => `<div class="rule"><div class="n">${i + 1}</div><div><b>${esc(r.title)}</b><p>${esc(r.text)}</p></div></div>`).join('') : empty({ title: 'No rules yet' })}</div>
    <div class="card"><div class="card-h"><h3>How to report a task</h3></div>
      <div class="rule"><div class="n">${icon('play')}</div><div><b>Start</b><p>Press it when you begin, so everyone knows it's moving.</p></div></div>
      <div class="rule"><div class="n">${icon('check')}</div><div><b>Done + proof</b><p>A photo, a file, a link, or a name + number. No proof = not done.</p></div></div>
      <div class="rule"><div class="n">${icon('alert')}</div><div><b>I'm blocked + what you need</b><p>The same day. ${esc(ctx.D.event.contact || 'Your lead')} gets it instantly. Asking early is never wrong.</p></div></div></div></div>`;
}

export function profile(ctx) {
  const D = ctx.D, me = D.me, bot = D.bot, s = ctx.api.session() || {}, viewer = ctx.isViewer, acc = me.account, start = me.tg_start || s.t || '';
  const NOTE = { auto: 'Telegram if connected, otherwise email', telegram: 'Telegram only', email: 'Email only', both: 'Telegram and email', none: 'No reminders' };
  const gid = ctx.api.googleClient(D);
  let h = `<div class="card"><div class="person-card profile-me"><div class="ph-pic">${avatar(me.name, 'xl', me.photo)}${viewer ? '' : `<label class="ph-cam" title="Change your photo">${icon('camera')}<input type="file" accept="image/*" id="me-photo" hidden></label>`}</div>
    <div class="info"><h2>${esc(me.name)}</h2><div class="muted">${esc(me.role || '')} · <span class="pill ${esc(me.access)}">${esc(me.access)}</span></div>
    ${viewer ? '' : `<div class="actions" style="margin-top:10px"><label class="btn soft sm">${icon('camera')} ${me.photo ? 'Change photo' : 'Add your photo'}<input type="file" accept="image/*" id="me-photo2" hidden></label>${me.photo ? '<button class="btn ghost sm" id="me-nophoto">Remove</button>' : ''}<a class="btn ghost sm" href="#/team/${esc(me.key)}">${icon('user')} See your page</a></div>
      <p class="small muted" style="margin:6px 0 0">The team sees it next to your name. It never appears on the public page.</p>`}</div></div></div>`;
  if (gid && !viewer) h += `<div class="card"><div class="card-h"><h3>Sign in with Google</h3>${me.google ? `<span class="pill ok">${icon('check')} connected</span>` : '<span class="pill">not connected</span>'}</div>
    ${me.google ? `<p style="margin-top:0">You can sign in on any phone or computer with <b>${esc(me.google_email || 'your Google account')}</b> — press “Sign in with Google”.</p><div class="actions"><button class="btn ghost" id="g-off">Disconnect Google</button></div>`
      : `<p style="margin-top:0">Connect your Google account once — after that “Sign in with Google” is all you need, on any device.${ctx.api.isServerHub() || ctx.api.SELF ? ' Your personal link then stops working, so nobody else can use it.' : ''}</p><button class="btn gbtn" id="g-on">${googleG} Connect Google</button>`}</div>`;
  if (D.accounts && !viewer) h += accountCard(D, me, acc);
  if (!viewer) {
    h += `<div class="grid-2"><div class="card"><div class="card-h"><h3>Reminders</h3><span class="sub">the evening before a deadline, at ${esc(D.event.reminderHour)}:00</span></div>
      <form id="prefs">${field({ label: 'How should the hub reach you?', name: 'notify', type: 'select', value: me.notify, options: Object.entries(NOTE) })}
      ${field({ label: 'Email', name: 'email', type: 'email', value: me.email || '', placeholder: 'you@example.com', hint: 'Only the hub uses it — for reminders, and for messages when your tasks change.' })}
      <button class="btn primary" type="submit">Save</button></form></div>`;
    if (bot) {
      const cmd = `/start ${start}`, link = `https://t.me/${bot}?start=${start}`;
      h += `<div class="card"><div class="card-h"><h3>Telegram</h3>${me.telegram ? `<span class="pill ok">${icon('check')} connected</span>` : '<span class="pill">not connected</span>'}</div>
        ${me.telegram ? `<p>Reminders and messages come from <b>@${esc(bot)}</b>. Send it /tasks any time.</p>` : `<p>Press the button — Telegram opens <b>@${esc(bot)}</b> — then press <b>Start</b>.</p>`}
        <div class="actions"><a class="btn ${me.telegram ? 'ghost' : 'primary'}" href="${esc(link)}" target="_blank" rel="noopener">${icon('message')} ${me.telegram ? 'Open the bot' : 'Connect Telegram'}</a>${me.telegram ? '<button class="btn danger ghost" id="tgdis">Disconnect</button>' : ''}</div>
        <details style="margin-top:12px"><summary class="small"><b>Use a different Telegram account</b></summary>
          <p class="small muted">The button opens whichever account your Telegram app uses. For another account, open @${esc(bot)} there (or on web.telegram.org) and send this message:</p>
          <div class="linkbox"><input readonly value="${esc(cmd)}" aria-label="Command to send"><button class="btn soft" id="tgcopy">${icon('copy')} Copy</button></div></details></div>`;
    }
    h += `</div>`;
  }
  h += acc ? `<div class="card"><div class="card-h"><h3>This device</h3></div><p class="muted" style="margin-top:0">Signed in as <b>${esc(acc.username)}</b>.</p><div class="actions"><button class="btn ghost" id="out">${icon('logout')} Sign out on this device</button></div></div>`
    : `<div class="card"><div class="card-h"><h3>Your link</h3></div><p>Your personal link is your key to the hub — like a password. Don't share it. Lost it? On the sign-in page choose “Email me how to sign in”${viewer ? '' : ', or ask ' + esc(D.event.contact)}.</p>
    <div class="actions"><button class="btn ghost" id="out">${icon('logout')} Sign out on this device</button></div></div>`;
  ctx.el.innerHTML = h;
  const f = $('#prefs');
  if (f) f.onsubmit = async e => {
    e.preventDefault(); const b = f.querySelector('button'); busy(b, true);
    const r = await ctx.api.post('prefs', { notify: f.notify.value, email: f.email.value.trim() }); busy(b, false);
    if (!r.ok) return toast(r.error, 'err');
    Object.assign(D.me, r.me); toast('Saved.');
  };
  const setPhoto = async v => {
    const r = await ctx.api.post('photo.save', { photo: v });
    if (!r.ok) return toast(r.error, 'err');
    D.me.photo = r.photo; const t = (D.team || []).find(x => x.key === me.key); if (t) t.photo = r.photo;
    ctx.photos(); ctx.api.cache(D); toast(v ? 'Photo saved — the team sees it now.' : 'Photo removed.'); ctx.render();
  };
  ['#me-photo', '#me-photo2'].forEach(sel => { const i = $(sel); if (i) i.onchange = async () => { if (!i.files[0]) return; try { setPhoto(await imageData(i.files[0], { max: 192, square: true, quality: 0.82 })); } catch (err) { toast(err.message, 'err'); } }; });
  const np = $('#me-nophoto'); if (np) np.onclick = () => setPhoto('');
  const gon = $('#g-on'); if (gon) gon.onclick = () => { if (ctx.api.DEMO) return toast('Google sign-in is switched off in the demo.', 'err'); googleStart(gid, 'link', { back: '#/profile', hint: me.email || '' }); };
  const goff = $('#g-off'); if (goff) goff.onclick = async () => {
    if (!await confirmBox({ title: 'Disconnect Google?', text: ctx.api.isServerHub() && !acc ? 'You then need your personal link (or a new one from your lead) to sign in on another device.' : 'You can connect it again any time.', ok: 'Disconnect' })) return;
    const r = await ctx.api.post('auth.google.unlink'); if (!r.ok) return toast(r.error, 'err');
    D.me.google = false; D.me.google_email = ''; toast('Google disconnected.'); ctx.render();
  };
  const c = $('#tgcopy'); if (c) c.onclick = () => copy(`/start ${start}`, 'Copied — paste it in the bot chat.');
  const d = $('#tgdis'); if (d) d.onclick = async () => { busy(d, true); const r = await ctx.api.post('tgdisconnect'); busy(d, false); if (!r.ok) return toast(r.error, 'err'); D.me.telegram = false; toast('Disconnected.'); ctx.render(); };
  $('#out').onclick = () => { ctx.api.signOut(); location.hash = '#/'; location.reload(); };
  wireAccount(ctx);
}

/** Own-server hubs: make a username + password (the personal link then stops working), or change it. */
function accountCard(D, me, acc) {
  if (!acc) return `<form class="card" id="acc-new"><div class="card-h"><h3>Make your password</h3><span class="sub">sign in on any phone or computer</span></div>
    <p class="small muted" style="margin-top:0">Pick a username and a password. After this your personal link <b>stops working</b> — you sign in with these instead, and your browser can remember them. Telegram stays connected.</p>
    <div class="form-grid">
      <div class="field"><label for="acc-u">Username</label><input id="acc-u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="30" pattern="[a-z0-9][a-z0-9._\\-]{2,29}" value="${esc(me.key)}"><small class="hint">small letters, digits, dot, dash or underscore</small></div>
      <div class="field"><label for="acc-p">Password</label><input id="acc-p" name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128"><small class="hint">8 or more characters — a short sentence works well</small></div>
      <div class="field"><label for="acc-p2">Password again</label><input id="acc-p2" name="password2" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></div>
    </div><button class="btn primary" type="submit">${icon('check')} Make my password</button></form>`;
  return `<form class="card" id="acc-chg"><div class="card-h"><h3>Your sign-in</h3><span class="pill ok">${icon('check')} password</span></div>
    <p style="margin-top:0">You sign in as <b>${esc(acc.username)}</b>. Forgot your password? Ask ${esc(D.event.contact || 'your lead')} to reset your sign-in.</p>
    <input type="text" name="username" autocomplete="username" value="${esc(acc.username)}" hidden>
    <div class="form-grid"><div class="field"><label for="acc-c">Current password</label><input id="acc-c" name="current" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="acc-n">New password</label><input id="acc-n" name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></div></div>
    <div class="actions"><button class="btn primary" type="submit">Change password</button><button class="btn ghost" type="button" id="acc-all">${icon('logout')} Sign out on all other devices</button></div></form>`;
}
function wireAccount(ctx) {
  const fn = $('#acc-new');
  if (fn) fn.onsubmit = async e => {
    e.preventDefault();
    const v = { username: fn.username.value.trim().toLowerCase(), password: fn.password.value };
    if (v.password !== fn.password2.value) return toast('The two passwords are different.', 'err');
    if (!await confirmBox({ title: 'Switch to a password?', text: `After this your personal link stops working. You sign in as <b>${esc(v.username)}</b> with your password — on any device.`, ok: 'Yes, make it' })) return;
    const b = fn.querySelector('[type=submit]'); busy(b, true, 'Saving…');
    const r = await ctx.api.post('account.create', v); busy(b, false);
    if (!r.ok) return toast(r.error, 'err');
    ctx.api.setSession({ u: r.u, t: r.t });
    toast(`Done — you sign in as ${r.username} now.`);
    await ctx.refresh();
  };
  const fc = $('#acc-chg');
  if (!fc) return;
  fc.onsubmit = async e => {
    e.preventDefault(); const b = fc.querySelector('[type=submit]'); busy(b, true);
    const r = await ctx.api.post('account.password', { current: fc.current.value, password: fc.password.value }); busy(b, false);
    if (!r.ok) return toast(r.error, 'err');
    fc.current.value = ''; fc.password.value = ''; toast('Password changed. Your other devices were signed out.');
  };
  $('#acc-all').onclick = async e => {
    const b = e.currentTarget; busy(b, true, 'Signing out…');
    const r = await ctx.api.post('logout.all'); busy(b, false);
    toast(r.ok ? 'Signed out on every other device.' : r.error, r.ok ? 'ok' : 'err');
  };
}
