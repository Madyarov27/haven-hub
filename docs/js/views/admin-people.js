/* People (admins): add organizers and guest viewers, send links, reset links, remove people. */
import { $, esc, icon, avatar, toast, busy, drawer, modal, confirmBox, field, formValues, copy, csvBuild, download, dueInfo, empty, ago, debounce, first } from '../ui.js';

let tab = 'team', q = '';
const ACCESS = [['member', 'Member — sees and reports their own tasks'], ['lead', 'Lead — also sees everything, adds tasks, approves proof'], ['admin', 'Admin — also manages people and settings'], ['viewer', 'Guest viewer — read-only dashboard (HQ, a mentor, a sponsor)']];
const NOTIFY = [['auto', 'Automatic — Telegram if connected, else email'], ['telegram', 'Telegram only'], ['email', 'Email only'], ['both', 'Telegram and email'], ['none', 'No reminders']];

export function people(ctx) {
  const D = ctx.D, all = D.people || [], tz = ctx.tz;
  const act = ctx.setActions(`<button class="btn ghost" id="addg" title="Add guest">${icon('eye')}<span class="hide-sm">Add guest</span></button><button class="btn primary" id="addp">${icon('userPlus')} Add organizer</button>`);
  $('#addp', act).onclick = () => personDrawer(ctx, null, { access: 'member' });
  $('#addg', act).onclick = () => personDrawer(ctx, null, { access: 'viewer' });
  const groups = { team: all.filter(p => p.active && p.access !== 'viewer'), guests: all.filter(p => p.active && p.access === 'viewer'), removed: all.filter(p => !p.active) };
  const tasks = (D.all || []).filter(t => t.status !== 'Dropped');
  ctx.el.innerHTML = `<p class="lede">Everyone gets a personal link — that's how they sign in. Add someone, then send them their link by email, Telegram or copy-paste.</p>
    <div class="card flush"><div style="padding:16px 20px 0"><div class="toolbar">
      <div class="seg" role="tablist">${[['team', 'Organizers'], ['guests', 'Guests'], ['removed', 'Removed']].map(([k, l]) => `<button role="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}">${l} <span class="muted">${groups[k].length}</span></button>`).join('')}</div>
      <label class="search"><span class="sr">Search people</span>${icon('search')}<input id="pq" type="search" placeholder="Search…" value="${esc(q)}"></label>
      <span class="spacer"></span><button class="btn ghost sm" id="hours">${icon('download')} Volunteer hours (CSV)</button></div></div><div id="ptbl"></div></div>`;
  const draw = () => {
    const list = groups[tab].filter(p => !q || (p.name + ' ' + p.role + ' ' + p.area + ' ' + p.email + ' ' + p.handle).toLowerCase().includes(q.toLowerCase()));
    const seen = D.lastSeen || {};
    $('#ptbl').innerHTML = list.length ? `<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th>Person</th><th>Area</th><th>Access</th><th>Reach</th><th>Tasks</th><th>Last active</th><th class="cb"></th></tr></thead><tbody>${list.map(p => {
      const mine = tasks.filter(t => t.owner === p.key), open = mine.filter(t => !['Done', 'Dropped'].includes(t.status)), over = open.filter(t => dueInfo(t, tz).over);
      return `<tr class="click" data-key="${esc(p.key)}"><td><span class="who-cell">${avatar(p.name)}<span><b>${esc(p.name)}</b><span class="t-sub">${esc(p.role || '—')}</span></span></span></td>
        <td data-l="Area">${esc(p.area || '—')}</td><td><span class="pill ${esc(p.access)}">${esc(p.access)}</span></td>
        <td data-l="Reach" class="nowrap">${p.telegram ? `<span class="pill ok" title="Telegram connected">${icon('message')} TG</span> ` : ''}${p.email ? `<span class="pill" title="${esc(p.email)}">${icon('mail')} email</span>` : ''}${!p.telegram && !p.email ? '<span class="muted small">no reminders yet</span>' : ''}</td>
        <td data-l="Tasks" class="nowrap">${p.access === 'viewer' ? '—' : `${open.length} open${over.length ? ` · <span class="due over">${over.length} overdue</span>` : ''}`}</td>
        <td data-l="Last active" class="small muted nowrap">${esc(seen[p.name] ? ago(seen[p.name], tz) : 'never')}</td>
        <td class="cb"><div class="rel"><button class="icon-btn" data-menu="${esc(p.key)}" aria-label="Actions for ${esc(p.name)}">${icon('more')}</button></div></td></tr>`;
    }).join('')}</tbody></table></div>` : `<div style="padding:0 20px 10px">${empty({ title: tab === 'guests' ? 'No guests yet' : tab === 'removed' ? 'Nobody removed' : 'No organizers match', text: tab === 'guests' ? 'Give HQ, a mentor or a sponsor a read-only link to your progress.' : '' })}</div>`;
  };
  draw();
  ctx.el.querySelector('.seg').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; people(ctx); } };
  $('#pq').oninput = debounce(e => { q = e.target.value.trim(); draw(); }, 150);
  $('#hours').onclick = () => hoursCsv(ctx);
  $('#ptbl').onclick = e => {
    const m = e.target.closest('[data-menu]');
    if (m) { e.stopPropagation(); return rowMenu(ctx, m, all.find(p => p.key === m.dataset.menu)); }
    const tr = e.target.closest('tr[data-key]'); if (tr) personDrawer(ctx, tr.dataset.key);
  };
}

function rowMenu(ctx, btn, p) {
  document.querySelectorAll('.menu').forEach(x => x.remove());
  const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu');
  m.innerHTML = p.active ? `<button data-a="edit">${icon('edit')} Edit</button><button data-a="link">${icon('link')} Get link & invite message</button>${p.email ? `<button data-a="invite">${icon('mail')} Email the invite</button>` : ''}
    <hr><button data-a="reset">${icon('refresh')} Reset link (old one stops working)</button><button data-a="remove" class="danger">${icon('trash')} Remove from the team</button>`
    : `<button data-a="edit">${icon('edit')} Edit</button><button data-a="react">${icon('userPlus')} Add back to the team</button>`;
  btn.parentElement.appendChild(m);
  const off = e => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', off); } };
  setTimeout(() => document.addEventListener('click', off));
  m.onclick = async e => {
    const a = e.target.closest('[data-a]'); if (!a) return; m.remove();
    const k = a.dataset.a;
    if (k === 'edit') return personDrawer(ctx, p.key);
    if (k === 'link') { const r = await ctx.api.post('person.link', { key: p.key }); return r.ok ? linkModal(ctx, p, r) : toast(r.error, 'err'); }
    if (k === 'invite') { const r = await ctx.api.post('person.invite', { key: p.key }); return r.ok ? toast(`Invite emailed to ${p.email}.`) : toast(r.error, 'err'); }
    if (k === 'reset') {
      if (!await confirmBox({ title: `Reset ${first(p.name)}'s link?`, text: 'Their current link stops working immediately and Telegram is disconnected. Use this if a link was shared by mistake.', ok: 'Reset link', danger: true })) return;
      const r = await ctx.api.post('person.resetLink', { key: p.key }); if (!r.ok) return toast(r.error, 'err');
      linkModal(ctx, p, r, 'New link — send it to ' + first(p.name)); ctx.refresh({ silent: true });
    }
    if (k === 'remove') {
      const open = (ctx.D.all || []).filter(t => t.owner === p.key && !['Done', 'Dropped'].includes(t.status)).length;
      const v = await confirmBox({ title: `Remove ${p.name}?`, danger: true, ok: 'Remove',
        text: `Their link stops working and the bot forgets them. Their finished tasks and history stay.${open ? ` They have <b>${open} open task(s)</b>.` : ''}`,
        body: open ? field({ label: 'Give their open tasks to', name: 'to', type: 'select', options: [['', 'Nobody — leave them unassigned']].concat(ctx.D.team.filter(x => x.key !== p.key).map(x => [x.key, x.name])) }) + `<p class="small muted">Tip: their backup${p.backup ? ` (${esc(p.backup)})` : ''} is usually the right person.</p>` : '' });
      if (!v) return;
      const r = await ctx.api.post('person.deactivate', { key: p.key, reassignTo: (v && v.to) || '' });
      if (!r.ok) return toast(r.error, 'err');
      toast(`${p.name} removed${r.moved ? ` — ${r.moved} task(s) moved` : ''}.`); await ctx.refresh();
    }
    if (k === 'react') { const r = await ctx.api.post('person.reactivate', { key: p.key }); if (!r.ok) return toast(r.error, 'err'); linkModal(ctx, p, r, 'Welcome back — send the new link'); ctx.refresh({ silent: true }); }
  };
}

export function personDrawer(ctx, key, preset, fromApplication) {
  const p = key ? (ctx.D.people || []).find(x => x.key === key) : null;
  const x = p || Object.assign({ name: '', role: '', area: '', email: '', handle: '', access: 'member', notify: 'auto', backup: '', one: '', ask: '', weekend: '', works: '' }, preset || {});
  const guest = x.access === 'viewer';
  const areas = [...new Set(ctx.D.team.map(t => t.area).filter(Boolean))];
  const body = `<form id="pf" class="form-grid" autocomplete="off">
    ${field({ label: 'Name', name: 'name', value: x.name, required: true, attrs: 'maxlength="60" autofocus' })}
    ${field({ label: guest ? 'Who they are' : 'Role', name: 'role', value: x.role, placeholder: guest ? 'HQ Engagement Manager' : 'Design lead' })}
    ${field({ label: 'Access', name: 'access', type: 'select', value: x.access, options: ACCESS, full: true })}
    ${field({ label: 'Email', name: 'email', type: 'email', value: x.email, placeholder: 'name@example.com', hint: 'For the invite and reminders. Optional.' })}
    ${guest ? '' : field({ label: 'Telegram username', name: 'handle', value: x.handle, placeholder: '@username', hint: 'Shown to the team; used in group posts.' })}
    ${guest ? '' : `<div class="field"><label for="f-parea">Area</label><input id="f-parea" name="area" list="pareas" value="${esc(x.area)}" placeholder="Outreach"><datalist id="pareas">${areas.map(a => `<option value="${esc(a)}">`).join('')}</datalist></div>`}
    ${guest ? '' : field({ label: 'Reminders', name: 'notify', type: 'select', value: x.notify, options: NOTIFY })}
    ${guest ? '' : field({ label: 'Their job in one line', name: 'one', value: x.one, full: true, placeholder: 'Gets 12 schools to let us talk to one class each.' })}
    ${guest ? '' : field({ label: 'Who to ask (one per line)', name: 'ask', type: 'textarea', value: x.ask, full: true, attrs: 'rows="3" style="min-height:70px"', placeholder: 'Ann — design files\nBen — school contacts' })}
    ${guest ? '' : field({ label: 'Backup (takes over if they are stuck)', name: 'backup', value: x.backup })}
    ${guest ? '' : field({ label: 'Works with', name: 'works', value: x.works })}
    ${guest ? '' : field({ label: 'Event-weekend job', name: 'weekend', value: x.weekend, full: true, placeholder: 'Check-in desk Sat 08:30–11:00' })}
    ${p ? '' : `<div class="full">${field({ label: 'Email them their link now', name: 'invite', type: 'toggle', value: true, hint: 'Needs an email above. You can also copy the link after saving.' })}</div>`}
  </form>${guest && !p ? `<div class="banner info">${icon('eye')}<div>Guests see the dashboard, timeline and progress — no proof photos, contact details or notes. They can't change anything.</div></div>` : ''}`;
  const d = drawer({ title: p ? p.name : guest ? 'Add a guest viewer' : 'Add an organizer', sub: p ? `key: ${esc(p.key)} · joined ${esc(p.joined_at || '—')}` : 'They get a personal link — no account or password.', body,
    foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-save>${p ? 'Save' : 'Add & get link'}</button>`, onClose: () => ctx.render() });
  const form = $('#pf', d.el);
  form.access.onchange = () => { if ((form.access.value === 'viewer') !== guest) { d.close(); setTimeout(() => personDrawer(ctx, key, Object.assign(formValues(form), { access: form.access.value }), fromApplication), 220); } };
  $('[data-save]', d.el).onclick = async e => { const btn = e.currentTarget;
    const v = formValues(form);
    if (!v.name) return toast('Write their name.', 'err');
    busy(btn, true);
    const r = p ? await ctx.api.post('person.edit', { person: Object.assign({ key: p.key }, v) }) : await ctx.api.post('person.add', { person: v, fromApplication });
    busy(btn, false);
    if (!r.ok) return toast(r.error, 'err');
    d.close();
    if (p) { toast('Saved.'); ctx.refresh({ silent: true }); return; }
    linkModal(ctx, r.person, r, r.emailed ? `Invite emailed to ${r.person.email} ✓` : 'Send them their link');
    ctx.refresh({ silent: true });
  };
}

export function linkModal(ctx, p, r, title) {
  const text = r.message.replace(r.link, '').replace(/\n{3,}/g, '\n\n').trim();
  const tg = `https://t.me/share/url?url=${encodeURIComponent(r.link)}&text=${encodeURIComponent(text)}`;
  const m = modal({ title: title || `${first(p.name)}'s personal link`,
    body: `<p class="muted">This link is ${esc(first(p.name))}'s key to the hub. Send it privately — not in a group.</p>
      <div class="field"><label>Personal link</label><div class="linkbox"><input readonly value="${esc(r.link)}" id="lnk"><button class="btn soft" data-c="link">${icon('copy')} Copy</button></div></div>
      <div class="field"><label>Ready-to-send message</label><textarea readonly rows="7" id="msg">${esc(r.message)}</textarea></div>`,
    foot: `<a class="btn ghost" href="${esc(tg)}" target="_blank" rel="noopener">${icon('send')} Share on Telegram</a><button class="btn primary" data-c="msg">${icon('copy')} Copy message</button>` });
  m.el.onclick = e => { const c = e.target.closest('[data-c]'); if (c) copy(c.dataset.c === 'link' ? r.link : r.message, c.dataset.c === 'link' ? 'Link copied.' : 'Message copied — paste it in a private chat.'); };
}

function hoursCsv(ctx) {
  const D = ctx.D, ppl = D.people || D.team, role = k => (ppl.find(p => p.key === k) || {}).role || '';
  const done = (D.all || []).filter(t => t.status === 'Done').sort((a, b) => ctx.nameOf(a.owner) < ctx.nameOf(b.owner) ? -1 : a.done_at < b.done_at ? -1 : 1);
  const rows = [['Name', 'Role', 'Task', 'Finished', 'Minutes', 'Hours', 'Proof']].concat(done.map(t => [ctx.nameOf(t.owner), role(t.owner), t.title, t.done_at, t.mins, (t.mins / 60).toFixed(2), String(t.proof || '').replace(/\n/g, ' ')]));
  const tot = {}; done.forEach(t => { tot[t.owner] = (tot[t.owner] || 0) + t.mins; });
  rows.push([], ['TOTAL per person']); Object.keys(tot).forEach(k => rows.push([ctx.nameOf(k), role(k), '', '', tot[k], (tot[k] / 60).toFixed(1)]));
  download(`${(D.event.name || 'haven').replace(/\W+/g, '-').toLowerCase()}-volunteer-hours.csv`, csvBuild(rows), 'text/csv');
  toast('Downloaded. Hours are the estimates on finished tasks — check them before sending to HQ.');
}
