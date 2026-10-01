/* Overview (leads + guest viewers): KPIs, what needs attention, milestones, team progress, workload chart, activity. */
import { $, esc, icon, avatar, kpi, bar, pill, dueInfo, parseLocal, fmtDay, fmtDue, daysTo, DAY, first, empty, ago } from '../ui.js';
import { taskDrawer } from './admin-tasks.js';

const OPEN = t => !['Done', 'Dropped'].includes(t.status);
const DONE_C = '#6F7C10', OPEN_C = '#DB8A3A'; // validated pair (dataviz validator: CVD ΔE 9.6, normal 19.0)

export function overview(ctx) {
  const D = ctx.D, tz = ctx.tz, all = (D.all || []).filter(t => t.status !== 'Dropped'), now = Date.now();
  const open = all.filter(OPEN), over = open.filter(t => dueInfo(t, tz).over), blocked = open.filter(t => t.status === 'Blocked');
  const done = all.filter(t => t.status === 'Done'), ontime = done.filter(t => t.done_at && t.done_at <= t.due);
  const weekAgo = new Date(now - 7 * DAY).toISOString().slice(0, 10), doneWeek = done.filter(t => (t.done_at || '') >= weekAgo);
  const days = daysTo(D.event.start, tz), next7 = open.filter(t => { const d = parseLocal(t.due, tz); return d >= now && d - now < 7 * DAY; }).sort((a, b) => a.due < b.due ? -1 : 1);
  if (ctx.isLead) ctx.setActions(`<a class="btn primary" href="#/admin/tasks" id="nt">${icon('plus')} New task</a>`).querySelector('#nt').onclick = e => { e.preventDefault(); taskDrawer(ctx, null); };
  let h = '';
  const newApps = (D.applications || []).filter(a => a.status === 'new').length;
  if (newApps) h += `<div class="banner info">${icon('inbox')}<div>${newApps} new ${newApps === 1 ? 'person wants' : 'people want'} to join the team. <a href="#/admin/applications">Review applications</a></div></div>`;
  const nobody = open.filter(t => !t.owner);
  if (nobody.length && ctx.isLead) h += `<div class="banner">${icon('inbox')}<div><b>${nobody.length} open task${nobody.length === 1 ? ' has' : 's have'} no owner</b>${nobody.some(t => dueInfo(t, tz).over) ? ' (some are overdue)' : ''}. Give them to someone, or let the team take them. <a href="#/admin/tasks?owner=-">See them</a></div></div>`;
  h += `<div class="kpis six">
    ${kpi('overdue', over.length, { tone: over.length ? 'bad' : 'ok', icon: 'alert' })}
    ${kpi('blocked', blocked.length, { tone: blocked.length ? 'bad' : 'ok', icon: 'zap' })}
    ${kpi('done in 7 days', doneWeek.length, { tone: 'ok', icon: 'check' })}
    ${kpi('done on time', done.length ? Math.round(100 * ontime.length / done.length) + '%' : '—', { icon: 'clock' })}
    ${kpi('open tasks', open.length, { icon: 'list', sub: `${done.length} of ${all.length} done` })}
    ${kpi(days > 0 ? 'days to the event' : 'event', days > 0 ? days : days === 0 ? 'Today' : 'Done', { tone: 'warn', icon: 'flag', sub: esc(fmtDay(D.event.start)) })}
  </div>`;
  const attn = blocked.concat(over.filter(t => t.status !== 'Blocked'));
  const row = t => { const di = dueInfo(t, tz); return `<div class="attn ${ctx.isLead ? 'click' : ''}" data-id="${esc(t.id)}" ${ctx.isLead ? 'role="button" tabindex="0"' : ''}>${avatar(ctx.nameOf(t.owner), 'sm')}<div class="body"><b>${esc(t.title)}</b><span>${esc(first(ctx.nameOf(t.owner)))} · <span class="due ${di.cls}">${esc(di.label)}</span>${t.status === 'Blocked' && t.blocked_reason ? ' · needs: ' + esc(t.blocked_reason.slice(0, 90)) : ''}</span></div>${pill(t.status)}</div>`; };
  h += `<div class="grid-2"><div class="card"><div class="card-h"><h3>Needs attention</h3><span class="sub">blocked first, then overdue</span></div>${attn.length ? attn.slice(0, 8).map(row).join('') + (attn.length > 8 ? `<p class="small" style="margin:10px 0 0"><a href="#/admin/tasks">+ ${attn.length - 8} more</a></p>` : '') : empty({ title: 'Nothing is stuck', text: 'No blocked or overdue tasks. 🎉', img: 'daven' })}
    ${ctx.isLead ? `<p class="small muted" style="margin:10px 0 0">Rule: never take a task back yourself — help the owner, or reassign it to their backup.</p>` : ''}</div>
    <div class="card"><div class="card-h"><h3>Next 7 days</h3><span class="sub">${next7.length} due</span></div>${next7.length ? next7.slice(0, 8).map(row).join('') + (next7.length > 8 ? `<p class="small" style="margin:10px 0 0"><a href="#/admin/timeline">See the timeline</a></p>` : '') : `<p class="muted">Nothing due this week.</p>`}</div></div>`;
  const ms = (D.milestones || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
  if (ms.length) h += `<div class="card" style="margin-top:18px"><div class="card-h"><h3>Milestones</h3>${ctx.isAdmin ? '<a class="small" href="#/admin/content">Edit</a>' : ''}</div><div class="miles">${ms.map(m => { const d = daysTo(m.date, tz); return `<div class="mile ${esc(m.kind)} ${m.done ? 'done' : ''}"><span>${esc(fmtDay(m.date))} · ${m.done ? '✓ done' : d > 0 ? 'in ' + d + ' d' : d === 0 ? 'today' : 'passed'}</span><b>${esc(m.label)}</b></div>`; }).join('')}</div></div>`;
  const people = D.team.map(p => { const mine = all.filter(t => t.owner === p.key), md = mine.filter(t => t.status === 'Done').length, mo = mine.filter(t => OPEN(t) && dueInfo(t, tz).over).length; return { p, n: mine.length, md, mo }; }).filter(x => x.n).sort((a, b) => b.mo - a.mo || a.md / a.n - b.md / b.n);
  h += `<div class="grid-2" style="margin-top:18px"><div class="card"><div class="card-h"><h3>Team progress</h3><a class="small" href="#/admin/scores">Scorecards</a></div>${people.length ? people.map(x => `<div class="prog-row"><span class="n">${esc(x.p.name)}${x.mo ? ` <span class="due over" title="overdue">· ${x.mo}</span>` : ''}</span>${bar(100 * x.md / x.n, x.mo ? 'warn' : '')}<span class="v">${x.md}/${x.n}</span></div>`).join('') : '<p class="muted">No tasks yet.</p>'}</div>
    <div class="card chart"><div class="card-h"><h3>Workload by week</h3><span class="sub">tasks due each week</span></div>${weekChart(all, tz, D)}</div></div>`;
  const log = (D.log || []).slice(0, 12);
  h += `<div class="card" style="margin-top:18px"><div class="card-h"><h3>Recent activity</h3></div>${log.length ? `<ul class="feed">${log.map(l => `<li>${avatar(l.who, 'sm')}<span><b>${esc(l.who)}</b> ${esc(String(l.action).toLowerCase())} ${l.task ? `<b>${esc(l.task)}</b>` : ''}${l.note ? ` <span class="muted">— ${esc(l.note.slice(0, 80))}</span>` : ''}</span><span class="t">${esc(ago(l.time, tz))}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing yet — activity appears here the moment someone presses Start, Done or Blocked.</p>'}</div>`;
  ctx.el.innerHTML = h;
  if (ctx.isLead) {
    const open1 = e => { const a = e.target.closest('.attn[data-id]'); if (a && (e.type === 'click' || e.key === 'Enter')) taskDrawer(ctx, a.dataset.id); };
    ctx.el.addEventListener('click', open1); ctx.el.addEventListener('keydown', open1);
  }
  wireChart(ctx.el);
}

/** Stacked columns: tasks due per week, done (bottom) + still open (top). Hover for exact numbers; a table view sits underneath. */
function weekChart(all, tz, D) {
  const monday = ymd => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); };
  const add = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const today = (D.now || new Date().toISOString()).slice(0, 10), thisW = monday(today);
  const end = monday(D.event.end || add(today, 42)), start = add(thisW, -21);
  const weeks = []; for (let w = start; w <= end && weeks.length < 12; w = add(w, 7)) weeks.push(w);
  if (weeks.length < 4) for (let i = weeks.length; i < 4; i++) weeks.push(add(weeks[weeks.length - 1] || thisW, 7));
  const data = weeks.map(w => { const ts = all.filter(t => t.due && monday(t.due.slice(0, 10)) === w); return { w, done: ts.filter(t => t.status === 'Done').length, open: ts.filter(t => t.status !== 'Done').length }; });
  const max = Math.max(4, ...data.map(d => d.done + d.open)), step = Math.ceil(max / 4), top = step * 4;
  const W = 640, H = 230, L = 30, R = 8, T = 20, B = 30, bw = (W - L - R) / data.length, cw = Math.min(24, bw * 0.62), y = v => T + (H - T - B) * (1 - v / top);
  const lab = w => new Date(w + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const col = (x, y0, y1, c, roundTop) => { const hgt = Math.max(0, y0 - y1); if (hgt < 0.5) return ''; const r = roundTop ? Math.min(4, hgt) : 0; return `<path fill="${c}" d="M${x},${y0} V${y1 + r} ${r ? `Q${x},${y1} ${x + r},${y1}` : ''} H${x + cw - r} ${r ? `Q${x + cw},${y1} ${x + cw},${y1 + r}` : ''} V${y0} Z"/>`; };
  let s = `<div class="legend" style="margin-bottom:6px"><span><i class="dot" style="background:${DONE_C}"></i>Done</span><span><i class="dot" style="background:${OPEN_C}"></i>Not done yet</span></div>`;
  s += `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tasks due per week, done and not done"><g>`;
  for (let i = 0; i <= 4; i++) { const v = step * i, yy = y(v); s += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#F1E6DC" stroke-width="1"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end">${v}</text>`; }
  data.forEach((d, i) => {
    const x = L + i * bw + (bw - cw) / 2, y0 = y(0), yd = y(d.done), yt = y(d.done + d.open), cur = d.w === thisW;
    s += `<g class="wk" data-i="${i}" tabindex="0" aria-label="Week of ${lab(d.w)}: ${d.done} done, ${d.open} not done"><rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent"/>`;
    s += col(x, y0, yd, DONE_C, !d.open);
    if (d.open) s += col(x, d.done ? yd - 2 : y0, yt, OPEN_C, true);
    if (d.done + d.open) s += `<text x="${x + cw / 2}" y="${yt - 5}" text-anchor="middle" style="fill:var(--ink)">${d.done + d.open}</text>`;
    if (data.length <= 8 || i % 2 === 0 || cur) s += `<text x="${x + cw / 2}" y="${H - 10}" text-anchor="middle" ${cur ? 'style="fill:var(--umber);font-weight:900"' : ''}>${cur ? 'This wk' : lab(d.w)}</text>`;
    s += `</g>`;
  });
  s += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="#D9C6B6" stroke-width="1"/></g></svg><div class="tip" hidden></div>`;
  s += `<details class="small" style="margin-top:6px"><summary>Show as a table</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Week of</th><th>Done</th><th>Not done yet</th></tr></thead><tbody>${data.map(d => `<tr><td>${lab(d.w)}</td><td>${d.done}</td><td>${d.open}</td></tr>`).join('')}</tbody></table></div></details>`;
  weekChart.data = data.map(d => Object.assign({ label: lab(d.w) }, d));
  return s;
}
function wireChart(el) {
  const svg = el.querySelector('.chart svg'), tip = el.querySelector('.chart .tip'); if (!svg || !tip) return;
  const show = g => { const d = weekChart.data[+g.dataset.i]; tip.innerHTML = `<b>Week of ${esc(d.label)}</b><br><i class="dot" style="background:${DONE_C}"></i> ${d.done} done<br><i class="dot" style="background:${OPEN_C}"></i> ${d.open} not done yet`; tip.hidden = false; const r = g.getBoundingClientRect(), p = svg.parentElement.getBoundingClientRect(); tip.style.left = Math.min(p.width - 150, Math.max(0, r.left - p.left + r.width / 2 - 70)) + 'px'; tip.style.top = (r.top - p.top + 10) + 'px'; };
  svg.parentElement.style.position = 'relative';
  svg.querySelectorAll('.wk').forEach(g => { g.onmouseenter = () => show(g); g.onfocus = () => show(g); g.onmouseleave = g.onblur = () => { tip.hidden = true; }; });
}
