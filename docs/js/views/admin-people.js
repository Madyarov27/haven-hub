/* People (admins): add organizers and guest viewers, send links, reset links, remove people. */
import { $, esc, icon, avatar, toast, busy, drawer, modal, confirmBox, field, formValues, copy, csvBuild, download, dueInfo, empty, ago, debounce, first } from '../ui.js';

let tab = 'team', q = '';
const ACCESS = [['member', 'Member — sees and reports their own tasks'], ['lead', 'Lead — also sees everything, adds tasks, approves proof'], ['admin', 'Admin — also manages people and settings'], ['viewer', 'Guest viewer — read-only dashboard (HQ, a mentor, a sponsor)']];
const NOTIFY = [['auto', 'Automatic — Telegram if connected, else email'], ['telegram', 'Telegram only'], ['email', 'Email only'], ['both', 'Telegram and email'], ['none', 'No reminders']];

export function people(ctx) {
  const D = ctx.D, all = D.people || [], tz = ctx.tz;
  const act = ctx.setActions(`<button class="btn ghost" id="addg" title="Add guest">${icon('eye')}<span class="hide-sm">Add guest</span></button><button class="btn ghost" id="addm" title="Paste a list of names">${icon('users')}<span class="hide-sm">Add several</span></button><button class="btn primary" id="addp">${icon('userPlus')} Add organizer</button>`);
  $('#addp', act).onclick = () => personDrawer(ctx, null, { access: 'member' });
  $('#addm', act).onclick = () => addMany(ctx);
  $('#addg', act).onclick = () => personDrawer(ctx, null, { access: 'viewer' });
  const groups = { team: all.filter(p => p.active && p.access !== 'viewer'), guests: all.filter(p => p.active && p.access === 'viewer'), removed: all.filter(p => !p.active) };
  const tasks = (D.all || []).filter(t => t.status !== 'Dropped');
  ctx.el.innerHTML = `<p class="lede">Everyone gets a personal link — that's how they sign in. Add someone, then send them their link by email, Telegram or copy-paste.${D.accounts ? ' Organizers can then make a password in their Profile (🔑); after that their link stops working.' : ''}</p>
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
        ${p.active ? `<td data-l="Area"><input class="inl" data-area="${esc(p.key)}" value="${esc(p.area || '')}" list="p-areas" placeholder="—" aria-label="Area of ${esc(p.name)}"></td>
        <td data-l="Access"><select class="inl pill ${esc(p.access)}" data-acc="${esc(p.key)}" aria-label="Access of ${esc(p.name)}">${ACCESS.map(([v]) => `<option value="${v}" ${v === p.access ? 'selected' : ''}>${v === 'viewer' ? 'guest' : v}</option>`).join('')}</select></td>`
        : `<td data-l="Area">${esc(p.area || '—')}</td><td><span class="pill ${esc(p.access)}">${esc(p.access)}</span></td>`}
        <td data-l="Reach" class="nowrap">${p.password ? `<span class="pill ok" title="Signs in with a username and password">${icon('key')} password</span> ` : ''}${p.telegram ? `<span class="pill ok" title="Telegram connected">${icon('message')} TG</span> ` : ''}${p.email ? `<span class="pill" title="${esc(p.email)}">${icon('mail')} email</span>` : ''}${!p.telegram && !p.email ? '<span class="muted small">no reminders yet</span>' : ''}</td>
        <td data-l="Tasks" class="nowrap">${p.access === 'viewer' ? '—' : `${open.length} open${over.length ? ` · <span class="due over">${over.length} overdue</span>` : ''}`}</td>
        <td data-l="Last active" class="small muted nowrap">${esc(seen[p.name] ? ago(seen[p.name], tz) : 'never')}</td>
        <td class="cb"><div class="rel"><button class="icon-btn" data-menu="${esc(p.key)}" aria-label="Actions for ${esc(p.name)}">${icon('more')}</button></div></td></tr>`;
    }).join('')}</tbody></table></div><datalist id="p-areas">${[...new Set(all.map(x => x.area).filter(Boolean))].sort().map(a => `<option value="${esc(a)}">`).join('')}</datalist>` : `<div style="padding:0 20px 10px">${empty({ title: tab === 'guests' ? 'No guests yet' : tab === 'removed' ? 'Nobody removed' : 'No organizers match', text: tab === 'guests' ? 'Give HQ, a mentor or a sponsor a read-only link to your progress.' : '' })}</div>`;
  };
  draw();
  ctx.el.querySelector('.seg').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; people(ctx); } };
  $('#pq').oninput = debounce(e => { q = e.target.value.trim(); draw(); }, 150);
  $('#hours').onclick = () => hoursCsv(ctx);
  // inline edits: access and area save as soon as they change
  $('#ptbl').onchange = async e => {
    const el = e.target.closest('[data-acc],[data-area]'); if (!el) return;
    const p = all.find(x => x.key === (el.dataset.acc || el.dataset.area)), patch = el.dataset.acc ? { access: el.value } : { area: el.value.trim() };
    if (el.dataset.acc && p.access === 'admin' && el.value !== 'admin' && !await confirmBox({ title: `${first(p.name)} stops being an admin?`, text: 'They lose People, Applications and Settings.', ok: 'Change' })) { el.value = p.access; return; }
    el.disabled = true;
    const r = await ctx.api.post('person.edit', { person: Object.assign({ key: p.key }, patch) });
    el.disabled = false;
    if (!r.ok) { toast(r.error, 'err'); if (el.dataset.acc) el.value = p.access; else el.value = p.area || ''; return; }
    Object.assign(p, r.person); ctx.api.cache(ctx.D);
    if (el.dataset.acc) { el.className = 'inl pill ' + p.access; toast(`${first(p.name)} is now ${p.access === 'viewer' ? 'a guest' : 'a ' + p.access}.`); if ((patch.access === 'viewer') !== (r.person.access === 'viewer')) people(ctx); }
    else toast('Saved.');
    ctx.refresh({ silent: true });
  };
  $('#ptbl').onclick = e => {
    if (e.target.closest('select,input')) return;
    const m = e.target.closest('[data-menu]');
    if (m) { e.stopPropagation(); return rowMenu(ctx, m, all.find(p => p.key === m.dataset.menu)); }
    const tr = e.target.closest('tr[data-key]'); if (tr) personDrawer(ctx, tr.dataset.key);
  };
}

function rowMenu(ctx, btn, p) {
  document.querySelectorAll('.menu').forEach(x => x.remove());
  const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu');
  m.innerHTML = p.active ? `<button data-a="edit">${icon('edit')} Edit</button>${p.password ? '' : `<button data-a="link">${icon('link')} Get link & invite message</button>`}${p.email ? `<button data-a="invite">${icon('mail')} Email ${p.password ? 'how to sign in' : 'the invite'}</button>` : ''}
    <hr><button data-a="reset">${icon('refresh')} ${p.password ? 'Reset sign-in (forgot password)' : 'Reset link (old one stops working)'}</button><button data-a="remove" class="danger">${icon('trash')} Remove from the team</button>`
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
      if (!await confirmBox(p.password
        ? { title: `Reset ${first(p.name)}'s sign-in?`, text: 'Their password is removed, they are signed out everywhere and Telegram is disconnected. You get a new personal link to send them — with it they can make a new password.', ok: 'Reset sign-in', danger: true }
        : { title: `Reset ${first(p.name)}'s link?`, text: 'Their current link stops working immediately and Telegram is disconnected. Use this if a link was shared by mistake.', ok: 'Reset link', danger: true })) return;
      const r = await ctx.api.post('person.resetLink', { key: p.key }); if (!r.ok) return toast(r.error, 'err');
      linkModal(ctx, p, r, 'New link — send it to ' + first(p.name)); ctx.refresh({ silent: true });
    }
    if (k === 'remove') return removeModal(ctx, p);
    if (k === 'react') { const r = await ctx.api.post('person.reactivate', { key: p.key }); if (!r.ok) return toast(r.error, 'err'); linkModal(ctx, p, r, 'Welcome back — send the new link'); ctx.refresh({ silent: true }); }
  };
}

/** Remove someone: pick who takes each open task (or leave it unassigned — anyone can take it). Finished work keeps their name. */
function removeModal(ctx, p) {
  const open = (ctx.D.all || []).filter(t => t.owner === p.key && !['Done', 'Dropped'].includes(t.status)).sort((a, b) => a.due < b.due ? -1 : 1);
  const others = ctx.D.team.filter(x => x.key !== p.key), hasUn = (ctx.D.features || []).includes('unassigned');
  const backup = others.find(x => p.backup && (x.key === p.backup.toLowerCase() || x.name.toLowerCase().startsWith(p.backup.toLowerCase())));
  const opts = v => (hasUn ? `<option value="-" ${v === '-' ? 'selected' : ''}>— Unassigned (anyone can take it) —</option>` : '') + others.map(x => `<option value="${esc(x.key)}" ${x.key === v ? 'selected' : ''}>${esc(x.name)}${backup && x.key === backup.key ? ' (their backup)' : ''}</option>`).join('');
  const def = hasUn ? '-' : (backup ? backup.key : (others[0] || {}).key);
  const m = modal({ title: `Remove ${p.name} from the team?`, size: open.length ? 'lg' : 'sm',
    body: `<p>Their sign-in stops working and the bot forgets them. Finished tasks and history keep their name.</p>
      ${open.length ? `<div class="row" style="gap:8px;align-items:center;margin:10px 0"><b>${open.length} open task(s).</b> <label class="small">Give all to <select id="rm-all"><option value="">…</option>${opts('')}</select></label></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Task</th><th>Due</th><th>New owner</th></tr></thead><tbody>${open.map(t => `<tr><td><b>${esc(t.title)}</b><div class="t-sub">${esc(t.id)}${t.area ? ' · ' + esc(t.area) : ''}</div></td><td class="nowrap small">${esc(String(t.due).slice(0, 10))}</td><td><select data-task="${esc(t.id)}">${opts(def)}</select></td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">Everyone who gets a task is told (Telegram or email).${hasUn ? ' Unassigned tasks are posted in the organizer group.' : ''}</p>` : ''}`,
    foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="rm-go">${icon('trash')} Remove ${esc(first(p.name))}</button>` });
  const all = $('#rm-all', m.el);
  if (all) all.onchange = () => { if (all.value) m.el.querySelectorAll('[data-task]').forEach(s => { s.value = all.value; }); };
  $('#rm-go', m.el).onclick = async e => {
    const reassign = {}; m.el.querySelectorAll('[data-task]').forEach(sel => { reassign[sel.dataset.task] = sel.value; });
    busy(e.currentTarget, true, 'Removing…');
    const r = await ctx.api.post('person.deactivate', { key: p.key, reassign, reassignTo: hasUn ? '' : def });
    busy(e.currentTarget, false);
    if (!r.ok) return toast(r.error, 'err');
    m.close(); toast(`${p.name} removed${r.moved ? ` — ${r.moved} task(s) handed over` : ''}${r.unassigned ? `, ${r.unassigned} unassigned` : ''}.`); await ctx.refresh();
  };
}

/** Add several organizers at once: one per line "Name, email or @telegram, area". Each gets their own link. */
function addMany(ctx) {
  const parse = text => String(text || '').split(/\n/).map(l => l.trim()).filter(Boolean).map(l => {
    const parts = l.split(/[,;\t]/).map(x => x.trim()), o = { name: parts[0] || '', email: '', handle: '', area: '' };
    parts.slice(1).forEach(x => { if (/^@\w{4,}$/.test(x)) o.handle = x; else if (/^[^\s@]+@[^\s@]+\.\w+$/.test(x)) o.email = x.toLowerCase(); else if (x && !o.area) o.area = x; });
    return o;
  });
  const m = modal({ title: 'Add several organizers', size: 'lg', body: `<p class="muted">One person per line: <b>Name, email or @telegram, area</b> — only the name is required. Everyone gets their own personal link.</p>
      <textarea id="am-t" rows="7" placeholder="Nora Kim, nora@example.com, Design\nTimur Aliev, @timur_a, Outreach\nSara Lee"></textarea>
      <div class="row" style="margin:10px 0">${field({ label: 'Access', name: 'access', type: 'select', value: 'member', options: ACCESS.slice(0, 3) })}${field({ label: 'Email each one their link (if they have an email)', name: 'invite', type: 'toggle', value: true })}</div>
      <div id="am-prev"></div>`,
    foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="am-go" disabled>Add</button>` });
  let rows = [];
  $('#am-t', m.el).oninput = () => {
    rows = parse($('#am-t', m.el).value);
    $('#am-go', m.el).disabled = !rows.length; $('#am-go', m.el).textContent = rows.length ? `Add ${rows.length}` : 'Add';
    $('#am-prev', m.el).innerHTML = rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Telegram</th><th>Area</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.name ? esc(r.name) : '<span class="errline">name missing</span>'}</td><td>${esc(r.email || '—')}</td><td>${esc(r.handle || '—')}</td><td>${esc(r.area || '—')}</td></tr>`).join('')}</tbody></table></div>` : '';
  };
  $('#am-go', m.el).onclick = async e => {
    const btn = e.currentTarget, o = formValues(m.el), out = [];
    if (rows.some(r => !r.name)) return toast('Every line needs a name.', 'err');
    for (let i = 0; i < rows.length; i++) {
      btn.disabled = true; btn.innerHTML = `<span class="spin"></span>Adding ${i + 1} of ${rows.length}…`;
      const r = await ctx.api.post('person.add', { person: Object.assign({ access: o.access, notify: 'auto', invite: o.invite && !!rows[i].email }, rows[i]) });
      out.push({ row: rows[i], r });
    }
    m.close(); await ctx.refresh({ silent: true });
    const okd = out.filter(x => x.r.ok), bad = out.filter(x => !x.r.ok);
    const all = okd.map(x => x.r.message).join('\n\n———\n\n');
    const res = modal({ title: `Added ${okd.length} of ${out.length}`, size: 'lg', body: `${bad.length ? `<div class="banner bad">${icon('alert')}<div>${bad.map(x => `<b>${esc(x.row.name)}</b>: ${esc(x.r.error)}`).join('<br>')}</div></div>` : ''}
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Person</th><th>Invite</th><th></th></tr></thead><tbody>${okd.map((x, i) => `<tr><td><b>${esc(x.r.person.name)}</b></td><td class="small">${x.r.emailed ? `${icon('check')} emailed` : 'send it yourself'}</td><td class="nowrap"><button class="btn sm soft" data-cp="${i}">${icon('copy')} Copy message</button> <a class="btn sm ghost" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(x.r.link)}&text=${encodeURIComponent(x.r.message.replace(x.r.link, '').trim())}">${icon('send')} Telegram</a></td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">Send each message privately — every link is that person's key.</p>`,
      foot: `<button class="btn ghost" data-close>Close</button>${okd.length > 1 ? `<button class="btn primary" id="cp-all">${icon('copy')} Copy all messages</button>` : ''}` });
    res.el.onclick = ev => { const c = ev.target.closest('[data-cp]'); if (c) copy(okd[Number(c.dataset.cp)].r.message, 'Message copied — paste it in a private chat.'); if (ev.target.closest('#cp-all')) copy(all, 'All messages copied.'); };
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
