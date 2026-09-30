/* Views every organizer sees: My tasks, Calendar, Team, Rules, Profile. */
import { $, esc, icon, avatar, kpi, empty, dueInfo, parseLocal, fmtDay, fmtDue, DAY, first, copy, toast, busy, field, safeUrl, pill } from '../ui.js';
import { taskCard, wireTasks } from '../task-card.js';

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
  if (!ts.length) h += `<div class="card">${empty({ title: 'No tasks yet', text: 'When your lead gives you a task it shows up here — with the steps, the deadline and who to ask.' })}</div>`;
  if (over.length) h += `<h3 class="section-t">${icon('alert')} Overdue — finish it, or press “I'm blocked”</h3>` + over.map((t, i) => card(t, i, true)).join('');
  if (open.length) h += `<h3 class="section-t">This week</h3>` + (week.length ? week.map((t, i) => card(t, i, !over.length)).join('') : `<p class="muted">Nothing due in the next 7 days.</p>`);
  if (later.length) h += `<h3 class="section-t">Later</h3>` + later.map((t, i) => card(t, i, false)).join('');
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

export function calendar(ctx) {
  const D = ctx.D, today = (D.now || '').slice(0, 10);
  const meets = (D.meetings || []).slice().sort((a, b) => (a.date + a.time) < (b.date + b.time) ? -1 : 1);
  const up = meets.filter(m => !/^\d{4}-\d\d-\d\d$/.test(m.date) || m.date >= today), past = meets.filter(m => !up.includes(m));
  const mrow = (m, i) => `<tr class="${i === 0 && up.includes(m) ? 'sel' : ''}"><td class="nowrap"><b>${esc(fmtDay(m.date))}</b></td><td>${esc(m.time || '')}</td><td>${esc(m.where || '')}</td><td>${esc(m.what || '')}${i === 0 && up.includes(m) ? ' <span class="pill ip">next</span>' : ''}</td></tr>`;
  let h = `<p class="lede">All times are ${esc(ctx.tz)} time. Can't come to a meeting? Post your 3 lines (finished · next · blocked) in the group before it starts.</p>`;
  h += `<div class="card flush"><div class="card-h"><h3>Meetings</h3></div>` + (meets.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Time</th><th>Where</th><th>What</th></tr></thead><tbody>${up.map(mrow).join('')}${past.map(m => mrow(m, 1).replace('<tr class="">', '<tr class="dim">')).join('')}</tbody></table></div>` : `<div style="padding:0 20px">${empty({ title: 'No meetings yet', text: ctx.isAdmin ? 'Add them in <a href="#/admin/content">Meetings & rules</a>.' : 'Your lead will add them here.' })}</div>`) + `</div>`;
  const ms = (D.milestones || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
  if (ms.length) h += `<div class="card"><div class="card-h"><h3>Milestones</h3></div><ul class="mile-list">${ms.map(m => `<li><span class="mk ${m.done ? 'done' : ''}">${icon(m.done ? 'check' : 'flag')}</span><div><b>${esc(m.label)}</b><div class="small muted">${esc(fmtDay(m.date, { year: 'numeric' }))}${m.kind === 'gate' ? ' · must-have gate' : ''}</div></div></li>`).join('')}</ul></div>`;
  if (!ctx.isViewer && D.tasks.length) {
    const mine = D.tasks.filter(t => !['Done', 'Dropped'].includes(t.status)).sort(byDue);
    h += `<div class="card flush"><div class="card-h"><h3>My deadlines</h3></div><div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Due</th><th>Task</th><th>Status</th></tr></thead><tbody>` +
      (mine.map(t => { const di = dueInfo(t, ctx.tz); return `<tr><td class="nowrap" data-l="Due"><span class="due ${di.cls}">${esc(fmtDue(t.due))}</span></td><td data-l="Task">${esc(t.title)}</td><td>${pill(t.status)}</td></tr>`; }).join('') || `<tr><td colspan="3" class="muted">Nothing open.</td></tr>`) + `</tbody></table></div></div>`;
  }
  ctx.el.innerHTML = h;
}

export function team(ctx) {
  const D = ctx.D, areas = [...new Set(D.team.map(p => p.area || 'Team'))];
  let h = `<p class="lede">${D.team.length} people on the ${esc(D.event.name)} team.</p>`;
  h += areas.map(a => `<h3 class="section-t">${esc(a)}</h3><div class="cards">` + D.team.filter(p => (p.area || 'Team') === a).map(p => {
    const handle = /^@\w+$/.test(p.handle || '') ? `<a href="https://t.me/${esc(p.handle.slice(1))}" target="_blank" rel="noopener">${esc(p.handle)}</a>` : '';
    return `<div class="card"><div class="person-card">${avatar(p.name)}<div class="info"><b>${esc(p.name)}</b>${p.key === D.me.key ? ' <span class="pill ip">you</span>' : ''}${p.access === 'admin' || p.access === 'lead' ? ` <span class="pill ${p.access}">${esc(p.access)}</span>` : ''}
      <div class="small muted">${esc(p.role || '')}</div>${handle ? `<div class="small">${handle}</div>` : ''}${p.one ? `<p class="small" style="margin:6px 0 0">${esc(p.one)}</p>` : ''}</div></div></div>`;
  }).join('') + `</div>`).join('');
  ctx.el.innerHTML = h;
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
  const D = ctx.D, me = D.me, bot = D.bot, s = ctx.api.session() || {}, viewer = ctx.isViewer;
  const NOTE = { auto: 'Telegram if connected, otherwise email', telegram: 'Telegram only', email: 'Email only', both: 'Telegram and email', none: 'No reminders' };
  let h = `<div class="card"><div class="person-card">${avatar(me.name, 'lg')}<div class="info"><h2>${esc(me.name)}</h2><div class="muted">${esc(me.role || '')} · <span class="pill ${esc(me.access)}">${esc(me.access)}</span></div></div></div></div>`;
  if (!viewer) {
    h += `<div class="grid-2"><div class="card"><div class="card-h"><h3>Reminders</h3><span class="sub">the evening before a deadline, at ${esc(D.event.reminderHour)}:00</span></div>
      <form id="prefs">${field({ label: 'How should the hub reach you?', name: 'notify', type: 'select', value: me.notify, options: Object.entries(NOTE) })}
      ${field({ label: 'Email', name: 'email', type: 'email', value: me.email || '', placeholder: 'you@example.com', hint: 'Only the hub uses it — for your link and reminders.' })}
      <button class="btn primary" type="submit">Save</button></form></div>`;
    if (bot) {
      const cmd = `/start ${s.t || ''}`, link = `https://t.me/${bot}?start=${s.t || ''}`;
      h += `<div class="card"><div class="card-h"><h3>Telegram</h3>${me.telegram ? `<span class="pill ok">${icon('check')} connected</span>` : '<span class="pill">not connected</span>'}</div>
        ${me.telegram ? `<p>Reminders and messages come from <b>@${esc(bot)}</b>. Send it /tasks any time.</p>` : `<p>Press the button — Telegram opens <b>@${esc(bot)}</b> — then press <b>Start</b>.</p>`}
        <div class="actions"><a class="btn ${me.telegram ? 'ghost' : 'primary'}" href="${esc(link)}" target="_blank" rel="noopener">${icon('message')} ${me.telegram ? 'Open the bot' : 'Connect Telegram'}</a>${me.telegram ? '<button class="btn danger ghost" id="tgdis">Disconnect</button>' : ''}</div>
        <details style="margin-top:12px"><summary class="small"><b>Use a different Telegram account</b></summary>
          <p class="small muted">The button opens whichever account your Telegram app uses. For another account, open @${esc(bot)} there (or on web.telegram.org) and send this message:</p>
          <div class="linkbox"><input readonly value="${esc(cmd)}" aria-label="Command to send"><button class="btn soft" id="tgcopy">${icon('copy')} Copy</button></div></details></div>`;
    }
    h += `</div>`;
  }
  h += `<div class="card"><div class="card-h"><h3>Your link</h3></div><p>Your personal link is your key to the hub — like a password. Don't share it. Lost it? On the sign-in page choose “Email me my link”${viewer ? '' : ', or ask ' + esc(D.event.contact)}.</p>
    <div class="actions"><button class="btn ghost" id="out">${icon('logout')} Sign out on this device</button></div></div>`;
  ctx.el.innerHTML = h;
  const f = $('#prefs');
  if (f) f.onsubmit = async e => {
    e.preventDefault(); const b = f.querySelector('button'); busy(b, true);
    const r = await ctx.api.post('prefs', { notify: f.notify.value, email: f.email.value.trim() }); busy(b, false);
    if (!r.ok) return toast(r.error, 'err');
    Object.assign(D.me, r.me); toast('Saved.');
  };
  const c = $('#tgcopy'); if (c) c.onclick = () => copy(`/start ${s.t}`, 'Copied — paste it in the bot chat.');
  const d = $('#tgdis'); if (d) d.onclick = async () => { busy(d, true); const r = await ctx.api.post('tgdisconnect'); busy(d, false); if (!r.ok) return toast(r.error, 'err'); D.me.telegram = false; toast('Disconnected.'); ctx.render(); };
  $('#out').onclick = () => { ctx.api.signOut(); location.hash = '#/'; location.reload(); };
}
