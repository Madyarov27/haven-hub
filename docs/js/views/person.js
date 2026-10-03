/* One person's page (#/team/<key>): their photo, job, how to reach them, and — for leads — every task, the proof, what they
   offered to help with, and their latest activity. Members see the profile part only. Admins can edit, reset and remove from here. */
import { $, esc, icon, avatar, kpi, bar, dueInfo, fmtDay, ago, empty, first, toast, linkify, skeleton, imageData } from '../ui.js';
import { taskCard, wireTasks } from '../task-card.js';
import { taskDrawer } from './admin-tasks.js';
import { personDrawer, personMenu } from './admin-people.js';

const tgLink = h => /^@\w{4,}$/.test(h || '') ? `https://t.me/${h.slice(1)}` : '';
const byDue = (a, b) => a.due < b.due ? -1 : a.due > b.due ? 1 : 0;

export function personPage(ctx, key) {
  const D = ctx.D, tz = ctx.tz, isMe = key === D.me.key;
  const p = (D.team || []).find(x => x.key === key) || (D.people || []).find(x => x.key === key);
  if (!p) { ctx.el.innerHTML = `<div class="card">${empty({ title: 'Nobody here', text: 'This person is not on the team (any more).', action: '<a class="btn soft" href="#/team">Back to the team</a>' })}</div>`; return; }
  const full = Object.assign({}, p, (D.people || []).find(x => x.key === key) || {}), lead = ctx.isLead || ctx.isViewer;
  const all = (D.all || []).filter(t => t.owner === key && t.status !== 'Dropped'), open = all.filter(t => t.status !== 'Done').sort(byDue), done = all.filter(t => t.status === 'Done').sort((a, b) => a.done_at < b.done_at ? 1 : -1);
  const over = open.filter(t => dueInfo(t, tz).over), blocked = open.filter(t => t.status === 'Blocked');
  const ontime = done.length ? Math.round(100 * done.filter(t => t.done_at && t.done_at <= t.due).length / done.length) : null;
  const hours = (done.reduce((s, t) => s + (t.mins || 0), 0) / 60).toFixed(1), seen = (D.lastSeen || {})[p.name];
  if (ctx.isAdmin && !isMe) ctx.setActions(`<button class="btn ghost" id="pp-edit">${icon('edit')}<span class="hide-sm">Edit</span></button><div class="rel"><button class="btn ghost" id="pp-more" aria-label="More actions">${icon('more')}</button></div>`);
  const tg = tgLink(full.handle);
  const reach = [full.telegram ? `<span class="pill ok">${icon('message')} Telegram connected</span>` : '', full.google ? `<span class="pill ok">G Google${full.google_email ? ' · ' + esc(full.google_email) : ''}</span>` : '',
    full.password ? `<span class="pill ok">${icon('key')} password</span>` : ''].filter(Boolean).join(' ');
  let h = `<a class="back" href="#/team">${icon('left')} Team</a>
    <div class="card profile-head"><div class="ph-pic">${avatar(p.name, 'xl', p.photo)}${ctx.isAdmin || isMe ? `<label class="ph-cam" title="Change the photo">${icon('camera')}<input type="file" accept="image/*" id="pp-photo" hidden></label>` : ''}</div>
      <div class="ph-info"><h2>${esc(p.name)} ${isMe ? '<span class="pill ip">you</span>' : ''} ${p.access === 'admin' || p.access === 'lead' ? `<span class="pill ${esc(p.access)}">${esc(p.access)}</span>` : ''}</h2>
        <div class="muted"><b>${esc(p.role || '—')}</b>${p.area ? ' · ' + esc(p.area) : ''}</div>
        ${p.one ? `<p class="ph-one">${esc(p.one)}</p>` : ''}
        <div class="row ph-contact">${tg ? `<a class="btn sm soft" href="${esc(tg)}" target="_blank" rel="noopener">${icon('message')} ${esc(full.handle)}</a>` : ''}${lead && full.email ? `<a class="btn sm ghost" href="mailto:${esc(full.email)}">${icon('mail')} ${esc(full.email)}</a>` : ''}
          ${lead ? `<span class="small muted">${seen ? 'Active ' + esc(ago(seen, tz)) : 'No activity yet'}${full.joined_at ? ' · joined ' + esc(fmtDay(full.joined_at)) : ''}</span>` : ''}</div>
        ${lead && reach ? `<div class="row" style="gap:6px;margin-top:8px">${reach}</div>` : ''}</div></div>`;
  if (lead) {
    h += `<div class="kpis">${kpi('open', open.length, { icon: 'list' })}${kpi('overdue', over.length, { tone: over.length ? 'bad' : 'ok', icon: 'alert' })}${kpi('blocked', blocked.length, { tone: blocked.length ? 'bad' : '', icon: 'zap' })}
      ${kpi('done', done.length + ' / ' + all.length, { tone: 'ok', icon: 'check', sub: ontime === null ? '' : ontime + '% on time' })}${kpi('hours given', hours, { icon: 'clock', sub: 'from finished tasks' })}</div>`;
    if (all.length) h += `<div class="card"><div class="row between" style="margin-bottom:6px"><b>${done.length} of ${all.length} tasks done</b><span class="small muted">${open.length} to go</span></div>${bar(all.length ? 100 * done.length / all.length : 0, over.length ? 'warn' : '')}</div>`;
  }
  const job = [['Event-weekend job', full.weekend], ['Backup (takes over if they are stuck)', full.backup], ['Works with', full.works], ['Who to ask', full.ask]].filter(x => x[1]);
  if (job.length) h += `<div class="card"><div class="card-h"><h3>${isMe ? 'Your job' : 'Their job'}</h3></div><dl class="facts">${job.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${linkify(v).replace(/\n/g, '<br>')}</dd>`).join('')}</dl></div>`;
  if (lead) {
    h += `<div class="grid-2" style="align-items:start"><div><h3 class="section-t">${icon('list')} Open tasks (${open.length})</h3>${open.length ? open.map(t => taskCard(ctx, t, {})).join('') : `<div class="card">${empty({ title: 'Nothing open', text: ctx.isLead ? 'Give them a task:' : '', action: ctx.isLead ? `<button class="btn soft" id="pp-task">${icon('plus')} New task for ${esc(first(p.name))}</button>` : '' })}</div>`}
      ${open.length && ctx.isLead ? `<button class="btn soft" id="pp-task">${icon('plus')} New task for ${esc(first(p.name))}</button>` : ''}</div>
      <div><h3 class="section-t">${icon('check')} Done (${done.length})</h3>${done.length ? done.slice(0, 15).map(t => taskCard(ctx, t, {})).join('') + (done.length > 15 ? `<p class="small muted">…and ${done.length - 15} more on the All tasks page.</p>` : '') : '<div class="card"><p class="muted" style="margin:0">Nothing finished yet.</p></div>'}</div></div>
      ${ctx.isLead ? `<div class="grid-2" style="align-items:start;margin-top:18px"><div class="card" id="pp-log"><div class="card-h"><h3>Latest activity</h3></div>${skeleton(2)}</div><div class="card" id="pp-apps" hidden></div></div>` : ''}`;
  } else if (!isMe) {
    h += `<div class="card"><p class="muted" style="margin:0">Need ${esc(first(p.name))}? ${tg ? `Message them on Telegram (${esc(full.handle)}), or ask` : 'Ask'} in the organizer group.</p></div>`;
  }
  ctx.el.innerHTML = h;
  wireTasks(ctx.el, ctx, t => { ctx.patchTask(t); personPage(ctx, key); });
  ctx.el.addEventListener('click', e => { if (e.target.closest('#pp-task')) taskDrawer(ctx, null, { owner: key }); });
  const ed = $('#pp-edit'); if (ed) ed.onclick = () => personDrawer(ctx, key);
  const more = $('#pp-more'); if (more) more.onclick = e => { e.stopPropagation(); personMenu(ctx, more, (D.people || []).find(x => x.key === key)); };
  const ph = $('#pp-photo');
  if (ph) ph.onchange = async () => {
    const f = ph.files[0]; if (!f) return;
    try {
      const data = await imageData(f, { max: 192, square: true, quality: 0.82 });
      const r = await ctx.api.post('photo.save', isMe ? { photo: data } : { key, photo: data });
      if (!r.ok) return toast(r.error, 'err');
      const m = (D.team || []).find(x => x.key === key); if (m) m.photo = r.photo;
      if (isMe) D.me.photo = r.photo;
      ctx.photos(); ctx.api.cache(D); toast('Photo saved.'); ctx.render();
    } catch (err) { toast(err.message, 'err'); }
  };
  if (ctx.isLead) activity(ctx, key);
}

async function activity(ctx, key) {
  const r = await ctx.api.get('person.activity', { key });
  const box = $('#pp-log'), apps = $('#pp-apps'); if (!box) return;
  if (!r.ok) { box.innerHTML = `<div class="card-h"><h3>Latest activity</h3></div><p class="muted">${esc(r.error || 'Not available on this hub yet.')}</p>`; return; }
  box.innerHTML = `<div class="card-h"><h3>Latest activity</h3><span class="sub">${r.log.length} entries</span></div>${r.log.length ? `<ul class="feed">${r.log.slice(0, 25).map(l => `<li>${avatar(l.who, 'sm')}<span><b>${esc(l.who)}</b> ${esc(String(l.action).toLowerCase())} ${l.task ? `<b>${esc(l.task)}</b>` : ''}${l.note ? ` <span class="muted">— ${esc(String(l.note).slice(0, 90))}</span>` : ''}</span><span class="t">${esc(ago(l.time, ctx.tz))}</span></li>`).join('')}</ul>` : '<p class="muted" style="margin:0">Nothing yet.</p>'}`;
  if (apps && r.applications && r.applications.length) {
    apps.hidden = false;
    apps.innerHTML = `<div class="card-h"><h3>Offered to help with</h3><span class="sub">from the join form</span></div>${r.applications.map(a => `<div class="attn"><span class="kpi-ic" style="width:32px;height:32px">${icon('inbox')}</span><div class="body"><b>${esc(a.interest || 'Something')}</b><span>${esc(fmtDay(a.time))}${a.note ? ' · ' + esc(a.note.slice(0, 80)) : ''}</span></div><span class="pill ${a.status === 'new' ? 'warn' : 'ok'}">${a.status === 'new' ? 'new' : 'handled'}</span></div>`).join('')}`;
  }
}
