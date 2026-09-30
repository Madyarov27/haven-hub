/* Timeline (every deadline by week, with milestones) and Scorecards (one card per person, needs-attention first). */
import { $, esc, icon, avatar, bar, dueInfo, fmtDay, ago, parseLocal, DAY, first, empty } from '../ui.js';
import { taskDrawer } from './admin-tasks.js';

let who = '', showPast = false;
const cls = (t, tz) => t.status === 'Done' ? 'ok' : t.status === 'Blocked' ? 'blk' : dueInfo(t, tz).over ? 'late' : t.status === 'In progress' ? 'go' : 'idle';

export function timeline(ctx) {
  const D = ctx.D, tz = ctx.tz, today = (D.now || '').slice(0, 10);
  const from = showPast ? '0000' : new Date(parseLocal(today, tz) - 7 * DAY).toISOString().slice(0, 10);
  const list = (D.all || []).filter(t => t.status !== 'Dropped' && t.due.slice(0, 10) >= from && (!who || t.owner === who)).sort((a, b) => a.due < b.due ? -1 : 1);
  const mil = {}; (D.milestones || []).forEach(m => { (mil[m.date] = mil[m.date] || []).push(m); });
  const byDay = {}; list.forEach(t => { (byDay[t.due.slice(0, 10)] = byDay[t.due.slice(0, 10)] || []).push(t); });
  Object.keys(mil).forEach(d => { if (d >= from && !byDay[d] && !who) byDay[d] = []; });
  let h = `<div class="toolbar"><div class="legend"><span><i class="dot ok"></i>done</span><span><i class="dot go"></i>in progress</span><span><i class="dot late"></i>overdue</span><span><i class="dot blk"></i>blocked</span><span><i class="dot idle"></i>not started</span></div>
    <span class="spacer"></span><label class="row small" style="font-weight:700"><input type="checkbox" id="tp" ${showPast ? 'checked' : ''}> show older than a week</label>
    <select id="tw" aria-label="Person"><option value="">Everyone</option>${D.team.map(p => `<option value="${esc(p.key)}" ${p.key === who ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`;
  let wk = '';
  const days = Object.keys(byDay).sort();
  if (!days.length) h += `<div class="card">${empty({ title: 'No deadlines', text: 'Nothing is due in this range.' })}</div>`;
  days.forEach(d => {
    const dt = new Date(d + 'T12:00:00Z'), mon = new Date(dt.getTime() - ((dt.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
    if (mon !== wk) { wk = mon; h += `<h3 class="section-t">Week of ${esc(fmtDay(mon, { weekday: undefined }))}</h3>`; }
    const items = byDay[d], nd = items.filter(t => t.status === 'Done').length, ms = mil[d] || [];
    h += `<div class="tl-day ${d === today ? 'today' : ''} ${ms.length ? 'mil' : ''}"><div class="tl-h"><b>${esc(fmtDay(d))}</b>${d === today ? ' <span class="pill ip">today</span>' : ''}${items.length ? ` <span class="small muted">${nd}/${items.length} done</span>` : ''}${ms.map(m => `<div class="mil-t">${icon('flag')} ${esc(m.label)}${m.done ? ' ✓' : ''}</div>`).join('')}</div>` +
      items.map(t => `<div class="tl-row ${ctx.isLead ? 'attn click' : ''}" style="border:0;padding:3px 0" data-id="${esc(t.id)}"><i class="dot ${cls(t, tz)}"></i><span class="tm">${esc(t.due.slice(11, 16))}</span><b>${esc(first(ctx.nameOf(t.owner)))}</b> <span>${esc(t.title)}</span></div>`).join('') + `</div>`;
  });
  ctx.el.innerHTML = h;
  $('#tw').onchange = e => { who = e.target.value; timeline(ctx); };
  $('#tp').onchange = e => { showPast = e.target.checked; timeline(ctx); };
  if (ctx.isLead) ctx.el.onclick = e => { const r = e.target.closest('[data-id]'); if (r) taskDrawer(ctx, r.dataset.id); };
}

export function scores(ctx) {
  const D = ctx.D, tz = ctx.tz, all = (D.all || []).filter(t => t.status !== 'Dropped'), seen = D.lastSeen || {};
  const cards = D.team.map(p => {
    const mine = all.filter(t => t.owner === p.key), md = mine.filter(t => t.status === 'Done'), op = mine.filter(t => t.status !== 'Done');
    const over = op.filter(t => dueInfo(t, tz).over), blk = op.filter(t => t.status === 'Blocked'), prog = op.filter(t => t.status === 'In progress');
    const ot = md.length ? Math.round(100 * md.filter(t => t.done_at && t.done_at <= t.due).length / md.length) : null;
    const hrs = (md.reduce((s, t) => s + t.mins, 0) / 60).toFixed(1), last = seen[p.name];
    const quiet = last ? (Date.now() - parseLocal(last, tz)) / DAY : null, silent = p.access === 'member' && (quiet === null || quiet >= 5);
    const nxt = op.filter(t => !dueInfo(t, tz).over).sort((a, b) => a.due < b.due ? -1 : 1)[0];
    return { p, mine, md, over, blk, prog, ot, hrs, last, silent, nxt, pct: mine.length ? 100 * md.length / mine.length : 0, score: over.length * 3 + blk.length * 2 + (silent ? 3 : 0) };
  }).sort((a, b) => b.score - a.score || a.pct - b.pct);
  const flagged = cards.filter(c => c.score > 0).length;
  ctx.el.innerHTML = `<p class="lede">One card per person, needs-attention first. ${flagged ? `<b>${flagged}</b> need a look.` : 'Everyone is on track.'} “Silent” = no activity on the hub for 5+ days.</p><div class="cards">` + cards.map(c => `<div class="card score ${c.score ? 'warn' : ''}">
    <div class="row between"><div class="who-cell">${avatar(c.p.name)}<div><b>${esc(c.p.name)}</b><div class="small muted">${esc(c.p.role || '')}</div></div></div><div class="sc-big">${c.md.length}<span>/${c.mine.length}</span></div></div>
    <div style="margin:10px 0">${bar(c.pct, c.over.length ? 'warn' : '')}</div>
    <div class="sc-grid"><div><b>${c.ot === null ? '—' : c.ot + '%'}</b><span>on time</span></div><div><b>${c.hrs}</b><span>hours</span></div><div class="${c.over.length ? 'bad' : ''}"><b>${c.over.length}</b><span>overdue</span></div><div class="${c.blk.length ? 'bad' : ''}"><b>${c.blk.length}</b><span>blocked</span></div><div><b>${c.prog.length}</b><span>in progress</span></div></div>
    <div class="small">${c.silent ? `<span class="due over">${icon('alert')} ${c.last ? 'Silent for ' + Math.floor((Date.now() - parseLocal(c.last, tz)) / DAY) + ' days' : 'No activity yet'}</span>` : 'Active ' + esc(ago(c.last, tz))}</div>
    ${c.nxt ? `<div class="small muted" style="margin-top:4px">Next: <b>${esc(c.nxt.title)}</b> · ${esc(dueInfo(c.nxt, tz).label)}</div>` : ''}</div>`).join('') + `</div>`;
}
