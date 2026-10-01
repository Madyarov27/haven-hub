/* All tasks (leads): searchable table, bulk actions, create/edit drawer, CSV export + import (add tasks, or update the whole plan). */
import { $, $$, esc, icon, avatar, pill, reviewPill, dueInfo, parseLocal, fmtDue, DAY, first, toast, busy, drawer, confirmBox, field, formValues, csvParse, csvBuild, download, empty, debounce, linkify } from '../ui.js';
import { taskCard, wireTasks } from '../task-card.js';
import { pickNeeds, needChips } from './files.js';

const F = { q: '', status: 'open', owner: '', area: '', due: '', sort: 'due', dir: 1 };
const sel = new Set();
const OPEN = t => !['Done', 'Dropped'].includes(t.status);

function filtered(ctx) {
  const tz = ctx.tz, q = F.q.toLowerCase(), now = Date.now();
  return (ctx.D.all || []).filter(t => {
    if (F.status === 'open' && !OPEN(t)) return false;
    if (F.status === 'review' && !(t.status === 'Done' && !t.review)) return false;
    if (!['open', 'review', ''].includes(F.status) && t.status !== F.status) return false;
    if (F.owner && t.owner !== (F.owner === '-' ? '' : F.owner)) return false;
    if (F.area && (t.area || '') !== F.area) return false;
    if (F.due) {
      const d = parseLocal(t.due, tz);
      if (F.due === 'over' && !(OPEN(t) && d < now)) return false;
      if (F.due === 'week' && !(d >= now && d - now < 7 * DAY)) return false;
      if (F.due === 'month' && !(d >= now && d - now < 30 * DAY)) return false;
    }
    if (q && !(t.title + ' ' + t.id + ' ' + ctx.nameOf(t.owner) + ' ' + (t.area || '')).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => {
    const k = F.sort, va = k === 'owner' ? ctx.nameOf(a.owner) : (a[k] || ''), vb = k === 'owner' ? ctx.nameOf(b.owner) : (b[k] || '');
    return (va < vb ? -1 : va > vb ? 1 : 0) * F.dir;
  });
}
const areasOf = ctx => [...new Set((ctx.D.all || []).map(t => t.area).concat(ctx.D.team.map(p => p.area)).filter(Boolean))].sort();
const teamOpts = (ctx, v, any) => (any ? `<option value="">${any}</option>` : '') + (ctx.hasUnassigned ? `<option value="-" ${v === '-' ? 'selected' : ''}>— Unassigned —</option>` : '') + ctx.D.team.map(p => `<option value="${esc(p.key)}" ${p.key === v ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

export function tasksAdmin(ctx) {
  const hq = new URLSearchParams(location.hash.split('?')[1] || '');
  if (hq.has('owner')) { F.owner = hq.get('owner'); F.status = 'open'; history.replaceState(null, '', '#/admin/tasks'); }
  const act = ctx.setActions(`<button class="btn ghost" id="exp" title="Export every task as CSV">${icon('download')}<span class="hide-sm">Export CSV</span></button><button class="btn ghost" id="imp" title="Import CSV">${icon('upload')}<span class="hide-sm">Import CSV</span></button><button class="btn primary" id="new">${icon('plus')} New task</button>`);
  $('#new', act).onclick = () => taskDrawer(ctx, null);
  $('#imp', act).onclick = () => importDrawer(ctx);
  $('#exp', act).onclick = () => exportCsv(ctx);
  const all = ctx.D.all || [];
  for (const id of [...sel]) if (!all.some(t => t.id === id)) sel.delete(id);
  ctx.el.innerHTML = `<div class="card flush"><div style="padding:16px 20px 0">
    <div class="toolbar">
      <label class="search"><span class="sr">Search tasks</span>${icon('search')}<input id="q" type="search" placeholder="Search title, ID, person…" value="${esc(F.q)}"></label>
      <select id="fs" aria-label="Status">${[['open', 'Open tasks'], ['', 'All statuses'], ['Not started', 'Not started'], ['In progress', 'In progress'], ['Blocked', 'Blocked'], ['Done', 'Done'], ['review', 'Done — not reviewed'], ['Dropped', 'Dropped']].map(([v, l]) => `<option value="${v}" ${F.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select id="fo" aria-label="Owner">${teamOpts(ctx, F.owner, 'Everyone')}</select>
      <select id="fa" aria-label="Area"><option value="">All areas</option>${areasOf(ctx).map(a => `<option ${a === F.area ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
      <select id="fd" aria-label="Due">${[['', 'Any deadline'], ['over', 'Overdue'], ['week', 'Next 7 days'], ['month', 'Next 30 days']].map(([v, l]) => `<option value="${v}" ${F.due === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <span class="spacer"></span><span class="count" id="count"></span>
    </div></div><div id="tbl"></div></div><div id="bulk"></div>`;
  const draw = () => drawTable(ctx);
  $('#q').oninput = debounce(e => { F.q = e.target.value.trim(); draw(); }, 150);
  [['#fs', 'status'], ['#fo', 'owner'], ['#fa', 'area'], ['#fd', 'due']].forEach(([s, k]) => { $(s).onchange = e => { F[k] = e.target.value; draw(); }; });
  draw();
}

function drawTable(ctx) {
  const list = filtered(ctx), tz = ctx.tz, box = $('#tbl');
  $('#count').textContent = `${list.length} of ${(ctx.D.all || []).length} tasks`;
  const th = (k, l) => `<th><button data-sort="${k}">${l}${F.sort === k ? icon(F.dir > 0 ? 'down' : 'up') : ''}</button></th>`;
  box.innerHTML = list.length ? `<div class="tbl-wrap"><table class="tbl stack"><thead><tr><th class="cb"><input type="checkbox" id="all" aria-label="Select all" ${list.length && list.every(t => sel.has(t.id)) ? 'checked' : ''}></th>${th('title', 'Task')}${th('owner', 'Owner')}${th('due', 'Due')}${th('status', 'Status')}<th class="hide-sm">Review</th></tr></thead><tbody>` +
    list.map(t => {
      const di = dueInfo(t, tz);
      return `<tr class="click ${sel.has(t.id) ? 'sel' : ''} ${t.status === 'Dropped' ? 'dim' : ''}" data-id="${esc(t.id)}">
        <td class="cb"><input type="checkbox" data-sel="${esc(t.id)}" ${sel.has(t.id) ? 'checked' : ''} aria-label="Select ${esc(t.title)}"></td>
        <td><div class="t-title">${esc(t.title)}</div><div class="t-sub">${esc(t.id)}${t.area ? ' · ' + esc(t.area) : ''}${t.steps.length ? ` · ${t.steps.length} steps` : ''}</div></td>
        <td data-l="Owner">${t.owner ? `<span class="who-cell">${avatar(ctx.nameOf(t.owner), 'sm')}<span>${esc(ctx.nameOf(t.owner))}</span></span>` : '<span class="pill">Unassigned</span>'}</td>
        <td data-l="Due" class="nowrap"><span class="due ${di.cls}">${esc(fmtDue(t.due))}</span>${di.over || di.soon ? `<div class="t-sub due ${di.cls}">${esc(di.label)}</div>` : ''}</td>
        <td>${pill(t.status)}</td><td class="hide-sm">${reviewPill(t)}</td></tr>`;
    }).join('') + `</tbody></table></div>` : `<div style="padding:10px 20px 20px">${empty({ title: 'No tasks match', text: 'Change the filters, or add a task.', action: `<button class="btn primary" id="new2">${icon('plus')} New task</button>` })}</div>`;
  const n2 = $('#new2'); if (n2) n2.onclick = () => taskDrawer(ctx, null);
  box.onclick = e => {
    const s = e.target.closest('[data-sort]');
    if (s) { F.dir = F.sort === s.dataset.sort ? -F.dir : 1; F.sort = s.dataset.sort; return drawTable(ctx); }
    if (e.target.closest('input[type=checkbox]') || e.target.closest('td.cb')) return;
    const tr = e.target.closest('tr[data-id]'); if (tr) taskDrawer(ctx, tr.dataset.id);
  };
  box.onchange = e => {
    if (e.target.id === 'all') { list.forEach(t => e.target.checked ? sel.add(t.id) : sel.delete(t.id)); return drawTable(ctx); }
    const c = e.target.closest('[data-sel]'); if (!c) return;
    c.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel);
    c.closest('tr').classList.toggle('sel', c.checked); drawBulk(ctx);
  };
  drawBulk(ctx);
}

function drawBulk(ctx) {
  const box = $('#bulk'); if (!box) return;
  if (!sel.size) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="bulkbar" role="region" aria-label="Bulk actions"><b>${sel.size} selected</b>
    <select id="b-owner" aria-label="New owner">${teamOpts(ctx, '', 'Reassign to…')}</select>
    <span class="row" style="gap:4px"><input id="b-days" type="number" value="7" style="width:70px" aria-label="Days"><button class="btn soft sm" id="b-shift">Shift days</button></span>
    <select id="b-status" aria-label="Set status"><option value="">Set status…</option><option>Not started</option><option>In progress</option><option>Dropped</option></select>
    <label class="bb-tell" title="Message the people whose tasks change (Telegram, or email)"><input type="checkbox" id="b-notify" checked> Tell people</label>
    <span class="spacer"></span>${ctx.isAdmin ? `<button class="btn danger sm" id="b-del">${icon('trash')} Delete</button>` : ''}<button class="btn ghost sm" id="b-clear" style="color:#fff;border-color:rgba(255,255,255,.4)">Clear</button></div>`;
  const run = async (body, btn) => {
    busy(btn, true, 'Working…');
    const r = await ctx.api.post('task.bulk', Object.assign({ ids: [...sel], notify: $('#b-notify').checked }, body));
    busy(btn, false);
    if (!r.ok) return toast(r.error, 'err');
    r.tasks.forEach(t => ctx.patchTask(t)); toast(`Updated ${r.tasks.length} task(s).`); ctx.render();
  };
  $('#b-owner').onchange = e => e.target.value && run({ op: 'reassign', owner: e.target.value }, e.target);
  $('#b-status').onchange = e => e.target.value && run({ op: 'status', status: e.target.value }, e.target);
  $('#b-shift').onclick = e => run({ op: 'shift', days: Number($('#b-days').value) }, e.currentTarget);
  $('#b-clear').onclick = () => { sel.clear(); drawTable(ctx); };
  const del = $('#b-del');
  if (del) del.onclick = async () => {
    if (!await confirmBox({ title: `Delete ${sel.size} task(s)?`, text: 'This removes them for good. To keep the history, set the status to <b>Dropped</b> instead.', ok: 'Delete', danger: true })) return;
    const r = await ctx.api.post('task.delete', { ids: [...sel], notify: $('#b-notify').checked });
    if (!r.ok) return toast(r.error, 'err');
    ctx.removeTasks(r.deleted); sel.clear(); toast(`Deleted ${r.deleted.length}.`); ctx.render();
  };
}

// ------------------------------------------------------------------ create / edit drawer
export function taskDrawer(ctx, id, preset) {
  const D = ctx.D, t = id ? (D.all || []).find(x => x.id === id) : null;
  if (id && !t) return toast('That task is gone — refresh.', 'err');
  const x = t || Object.assign({ title: '', owner: '', due: '', mins: 30, area: '', why: '', steps: [], done_when: '', links: [], ask: '', resources: [] }, preset || {});
  let needs = (x.resources || []).map(r => r.ref || r);
  const hasFiles = (D.features || []).includes('files');
  const [dd, tt] = [String(x.due || '').slice(0, 10), String(x.due || '').slice(11, 16) || '20:00'];
  const areas = areasOf(ctx);
  const un = ctx.hasUnassigned ? [['-', '— Unassigned (anyone can take it) —']] : [];
  const owners = t ? field({ label: 'Owner', name: 'owner', type: 'select', value: x.owner || '-', options: un.concat(D.team.map(p => [p.key, p.name])), full: true })
    : `<div class="field full"><label>Who does it? <span class="req">*</span></label><div class="checks">${D.team.map(p => `<label><input type="checkbox" name="owners" value="${esc(p.key)}" data-multi="1" ${(preset && preset.owner === p.key) ? 'checked' : ''}>${esc(p.name)}</label>`).join('')}${ctx.hasUnassigned ? `<label><input type="checkbox" name="owners" value="-" data-multi="1"><i>Unassigned — anyone can take it</i></label>` : ''}</div><small class="hint">Pick several people to give each of them their own copy.</small></div>`;
  const body = `<form id="tf" class="form-grid" autocomplete="off">
    ${field({ label: 'Title — start with a verb', name: 'title', value: x.title, required: true, placeholder: 'Put up 3 posters at School 110', full: true, attrs: 'maxlength="200" autofocus' })}
    ${owners}
    ${field({ label: 'Due date', name: 'dd', type: 'date', value: dd, required: true })}
    ${field({ label: `Time (${ctx.tz})`, name: 'tt', type: 'time', value: tt })}
    ${field({ label: 'Minutes it takes', name: 'mins', type: 'number', value: x.mins || 30, attrs: 'min="5" step="5"' })}
    <div class="field"><label for="f-area">Area</label><input id="f-area" name="area" list="areas" value="${esc(x.area || '')}" placeholder="Outreach"><datalist id="areas">${areas.map(a => `<option value="${esc(a)}">`).join('')}</datalist></div>
    ${t ? field({ label: 'Status', name: 'status', type: 'select', value: x.status, options: ['Not started', 'In progress', 'Blocked', 'Done', 'Dropped'], full: true }) : ''}
    ${field({ label: 'Why it matters (one line)', name: 'why', value: x.why, full: true })}
    ${field({ label: 'Steps — one per line', name: 'steps', type: 'textarea', value: (x.steps || []).join('\n'), full: true, placeholder: 'Print 3 posters (Design folder)\nAsk the IT teacher where to hang them\nTake a photo of each' })}
    ${field({ label: 'Done = (the proof)', name: 'done_when', value: x.done_when, full: true, placeholder: '3 photos of the posters on the wall' })}
    ${hasFiles ? `<div class="field full"><label>What they need — from Files</label><div class="need-chips" id="needs">${needChips(ctx, needs)}</div><div><button type="button" class="btn soft sm" id="pick">${icon('folder')} Choose from Files</button></div><small class="hint">Posters, Canva links, the tracker… They show on the task as buttons with previews.</small></div>` : ''}
    ${field({ label: hasFiles ? 'Other links — one per line: Label | https://…' : 'Links — one per line: Label | https://…', name: 'links', type: 'textarea', value: (x.links || []).map(l => l.label === l.url ? l.url : l.label + ' | ' + l.url).join('\n'), full: true, attrs: 'rows="2" style="min-height:60px"' })}
    ${field({ label: 'Who to ask', name: 'ask', value: x.ask, full: true, placeholder: 'Ann — design files' })}
    <div class="full">${field({ label: t ? 'Tell the people involved about this change' : 'Tell them about the new task', name: 'notify', type: 'toggle', value: true, hint: 'Telegram, or email if they haven\'t connected Telegram. Admins get a short summary. A new date, owner, title or steps counts as a change.' })}</div>
  </form>`;
  let extra = '';
  if (t) {
    extra = `<hr class="divider"><h3 style="font-size:17px;margin-bottom:8px">Status & proof</h3><div id="tcard">${taskCard(ctx, t, { open: true, showOwner: true })}</div>`;
    const log = (D.log || []).filter(l => l.task === t.id);
    extra += `<h3 style="font-size:17px;margin:14px 0 6px">Activity</h3>` + (log.length ? `<ul class="feed">${log.map(l => `<li><b>${esc(l.who)}</b> <span>${esc(l.action)}${l.note ? ' — ' + linkify(l.note.slice(0, 160)) : ''}</span><span class="t">${esc(l.time)}</span></li>`).join('')}</ul>` : `<p class="muted small">No activity recorded yet${t.updated_at ? ' (last change ' + esc(t.updated_at) + ')' : ''}.</p>`);
  }
  const foot = t ? `${ctx.isAdmin ? `<button class="btn danger ghost left" data-del>${icon('trash')} Delete</button>` : '<span class="left"></span>'}<button class="btn ghost" data-dup>${icon('copy')} Duplicate</button><button class="btn primary" data-save>Save changes</button>`
    : `<button class="btn ghost" data-close>Cancel</button><button class="btn soft" data-save="again">Save & add another</button><button class="btn primary" data-save>Create task</button>`;
  const d = drawer({ title: t ? t.title : 'New task', sub: t ? `${esc(t.id)} · owner ${esc(ctx.nameOf(t.owner))}${t.created_by ? ' · added by ' + esc(ctx.nameOf(t.created_by)) : ''}` : 'Pick one or more people — each gets their own copy.', body: body + extra, foot, wide: !!t, onClose: () => ctx.render() });
  const form = $('#tf', d.el);
  if (t) wireTasks($('#tcard', d.el), ctx, nt => { ctx.patchTask(nt); $('#tcard', d.el).innerHTML = taskCard(ctx, nt, { open: true, showOwner: true }); });
  const collect = () => {
    const v = formValues(form);
    return { title: v.title, due: v.dd ? v.dd + ' ' + (v.tt || '20:00') : '', mins: Number(v.mins) || 30, area: v.area, why: v.why, done_when: v.done_when, ask: v.ask,
      steps: v.steps.split('\n').map(s => s.trim()).filter(Boolean), links: v.links, owners: v.owners, owner: v.owner, status: v.status, notify: v.notify,
      resources: hasFiles ? needs : undefined };
  };
  const drawNeeds = () => { const box = $('#needs', d.el); if (box) box.innerHTML = needChips(ctx, needs); };
  d.el.addEventListener('click', async e => {
    if (e.target.closest('#pick')) { const r = await pickNeeds(ctx, needs); if (r) { needs = r; drawNeeds(); } return; }
    const un = e.target.closest('[data-unpick]');
    if (un) { needs = needs.filter(x => x !== un.dataset.unpick); drawNeeds(); return; }
    const sv = e.target.closest('[data-save]');
    if (sv) {
      const v = collect();
      if (!v.title) return toast('Give the task a title.', 'err');
      if (!t && !(v.owners || []).length) return toast('Pick at least one person.', 'err');
      if (!v.due) return toast('Pick a due date.', 'err');
      busy(sv, true);
      const task = Object.assign({}, v, { notify: undefined });
      const r = t ? await ctx.api.post('task.edit', { task: Object.assign({ id: t.id }, task, { owners: undefined }), notify: v.notify }) : await ctx.api.post('task.add', { task, notify: v.notify });
      busy(sv, false);
      if (!r.ok) return toast(r.error, 'err');
      (r.tasks || [r.task]).forEach(nt => ctx.patchTask(nt));
      toast(t ? 'Saved.' : (r.tasks.length > 1 ? `Created ${r.tasks.length} tasks (${r.tasks.map(q => q.id).join(', ')}).` : `Created ${r.task.id}.`));
      if (sv.dataset.save === 'again') { form.title.value = ''; form.steps.value = ''; form.done_when.value = ''; form.why.value = ''; form.title.focus(); return; }
      d.close();
    }
    if (e.target.closest('[data-dup]')) { d.close(); setTimeout(() => taskDrawer(ctx, null, Object.assign({}, t, { title: t.title + ' (copy)' })), 220); }
    if (e.target.closest('[data-del]')) {
      const c = await confirmBox({ title: 'Delete this task?', text: `<b>${esc(t.title)}</b> is removed for good. To keep its history, set the status to Dropped instead.`, ok: 'Delete', danger: true,
        body: field({ label: `Tell ${first(ctx.nameOf(t.owner))}`, name: 'notify', type: 'toggle', value: true }) });
      if (!c) return;
      const r = await ctx.api.post('task.delete', { ids: [t.id], notify: c.notify });
      if (!r.ok) return toast(r.error, 'err');
      ctx.removeTasks(r.deleted); toast('Deleted.'); d.close();
    }
  });
}

// ------------------------------------------------------------------ CSV import
const COLS = ['title', 'owner', 'due', 'mins', 'area', 'why', 'steps', 'done_when', 'ask', 'links', 'resources'];
const ALIAS = { task: 'title', name: 'title', who: 'owner', assignee: 'owner', person: 'owner', deadline: 'due', 'due date': 'due', date: 'due', minutes: 'mins', 'done when': 'done_when', proof: 'done_when', 'who to ask': 'ask' };
function rowsFromCsv(text) {
  const rows = csvParse(text); if (rows.length < 2) return { error: 'Paste a header row and at least one task.' };
  const head = rows[0].map(h => { h = String(h).trim().toLowerCase().replace(/_/g, ' '); return ALIAS[h] || h.replace(/ /g, '_'); });
  if (!head.includes('title') || !head.includes('owner') || !head.includes('due')) return { error: 'The header row needs at least: title, owner, due.' };
  const split = s => String(s || '').split(/\n/.test(String(s || '')) ? /\n/ : /;/).map(x => x.trim()).filter(Boolean);
  return { rows: rows.slice(1).map(r => { const o = {}; head.forEach((h, i) => { if (COLS.includes(h) || h === 'id') o[h] = String(r[i] == null ? '' : r[i]).trim(); }); o.steps = split(o.steps); o.links = split(o.links).join('\n'); if (head.includes('resources')) o.resources = split(o.resources); else delete o.resources; return o; }) };
}
/** Every task (Done and Dropped too) in the same columns the importer reads, plus id + status — edit it in a spreadsheet and import it back. */
function exportCsv(ctx) {
  const list = (ctx.D.all || []).slice().sort((a, b) => a.due < b.due ? -1 : a.due > b.due ? 1 : 0);
  const rows = [['id'].concat(COLS, ['status'])].concat(list.map(t => [t.id, t.title, t.owner, t.due, t.mins, t.area, t.why, (t.steps || []).join('\n'), t.done_when, t.ask,
    (t.links || []).map(l => l.label === l.url ? l.url : l.label + ' | ' + l.url).join('\n'), (t.resources || []).map(r => r.ref).join('\n'), t.status]));
  download(`${(ctx.D.event.name || 'haven').replace(/\W+/g, '-').toLowerCase()}-tasks-${String(ctx.D.now || '').slice(0, 10)}.csv`, csvBuild(rows), 'text/csv');
  toast(`Exported ${list.length} tasks.`);
}
function importDrawer(ctx) {
  let mode = 'add', parsed = null;
  const example = csvBuild([COLS, ['Call the IT teacher at School 110', ctx.D.team[0] ? ctx.D.team[0].key : 'ann', '2026-10-12 18:00', '20', 'Outreach', 'Teachers open the door to classes', 'Find the number; Call; Ask for 10 minutes with one class', 'Name + date of the class visit', 'Ann — school list', 'School list | https://example.com/list', '']]);
  const d = drawer({ title: 'Import tasks from CSV', sub: 'From Google Sheets or Excel: File → Download → CSV. One task per row.', wide: true,
    body: `${ctx.isAdmin ? `<div class="seg" role="tablist" style="margin-bottom:14px"><button role="tab" data-mode="add" class="on" aria-selected="true">${icon('plus')} Add new tasks</button><button role="tab" data-mode="sync" aria-selected="false">${icon('refresh')} Update the whole plan</button></div>` : ''}
      <div id="how"></div>
      <div class="field"><label for="csvf">CSV file</label><input id="csvf" type="file" accept=".csv,text/csv"></div>
      <div class="field"><label for="csvt">…or paste it</label><textarea id="csvt" rows="7" placeholder="title,owner,due,mins,area,why,steps,done_when,ask,links"></textarea></div>
      <div id="opts"></div><div id="prev"></div>`,
    foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn soft" id="chk">Check</button><button class="btn primary" id="go" disabled>Import</button>`, onClose: () => ctx.render() });
  const drawMode = () => {
    $('#how', d.el).innerHTML = mode === 'add'
      ? `<ol class="how"><li>Download the <a href="#" id="tpl">template</a>, fill it in (owner = a key, full name or first name from People).</li><li>Paste the CSV below or choose the file.</li><li>Press <b>Check</b>. Nothing is saved until you press <b>Import</b>.</li></ol>`
      : `<ol class="how"><li>Press <b>Export CSV</b> on the All tasks page and open the file in Google Sheets or Excel.</li><li>Change dates, owners and wording; add rows for new tasks (leave <b>id</b> empty); delete rows you no longer need. Keep the <b>id</b> column.</li><li>Paste it here and press <b>Check</b> — you see every change per person before anything is saved.</li></ol>`;
    $('#opts', d.el).innerHTML = mode === 'add' ? field({ label: 'Tell each person about their new tasks', name: 'notify', type: 'toggle', value: true })
      : field({ label: 'Drop open tasks that are not in the file', name: 'dropMissing', type: 'toggle', value: true, hint: 'They become Dropped (not deleted). Finished tasks are never touched.' }) +
        field({ label: 'Renumber every task by date', name: 'renumber', type: 'toggle', value: true, hint: 'T001 = the first thing due. Old numbers in past messages won\'t match any more.' }) +
        field({ label: 'Tell everyone about their new plan', name: 'notify', type: 'toggle', value: true, hint: 'One message per person (Telegram, or email) with what changed and their next 5 tasks.' });
    $('#go', d.el).textContent = mode === 'add' ? 'Import' : 'Apply the plan';
    const tpl = $('#tpl', d.el); if (tpl) tpl.onclick = e => { e.preventDefault(); download('haven-hub-tasks-template.csv', example, 'text/csv'); };
    parsed = null; $('#go', d.el).disabled = true; $('#prev', d.el).innerHTML = '';
  };
  drawMode();
  const seg = $('.seg', d.el);
  if (seg) seg.onclick = e => { const b = e.target.closest('[data-mode]'); if (!b || b.dataset.mode === mode) return; mode = b.dataset.mode; seg.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); drawMode(); };
  const opts = () => formValues($('#opts', d.el));
  $('#csvf', d.el).onchange = async e => { const f = e.target.files[0]; if (f) { $('#csvt', d.el).value = await f.text(); $('#chk', d.el).click(); } };
  $('#csvt', d.el).oninput = () => { parsed = null; $('#go', d.el).disabled = true; };
  $('#opts', d.el).onchange = () => { if (mode === 'sync' && parsed) $('#chk', d.el).click(); };
  $('#chk', d.el).onclick = async e => {
    const btn = e.currentTarget, p = rowsFromCsv($('#csvt', d.el).value), prev = $('#prev', d.el);
    if (p.error) { prev.innerHTML = `<div class="banner bad">${icon('alert')}<div>${esc(p.error)}</div></div>`; return; }
    busy(btn, true, 'Checking…');
    const r = mode === 'add' ? await ctx.api.post('task.import', { rows: p.rows, dryRun: true }) : await ctx.api.post('task.sync', Object.assign({ rows: p.rows, dryRun: true }, opts()));
    busy(btn, false);
    const errs = {}; (r.errors || []).forEach(x => { errs[x.row] = x.errors; });
    if (mode === 'sync' && r.ok) {
      prev.innerHTML = `<div class="banner info">${icon('check')}<div><b>${r.added} new · ${r.updated} changed · ${r.dropped} dropped · ${r.unchanged} unchanged.</b> Nothing is saved until you press <b>Apply the plan</b>.</div></div>
        ${r.people.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Person</th><th>New</th><th>Removed</th><th>New date</th><th>Updated</th></tr></thead><tbody>${r.people.map(x => `<tr><td><b>${esc(x.name)}</b></td><td>${x.added || ''}</td><td>${x.removed || ''}</td><td>${x.dates || ''}</td><td>${x.edits || ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${r.changes.length ? `<details style="margin-top:10px"><summary class="small"><b>Every change (${r.changes.length})</b></summary><ul class="feed">${r.changes.map(c => `<li><b>${esc(c.who)}</b> <span>${esc(c.text)}</span></li>`).join('')}</ul></details>` : ''}`;
    } else {
      prev.innerHTML = `<div class="banner ${r.ok ? 'info' : 'bad'}">${icon(r.ok ? 'check' : 'alert')}<div>${r.ok ? `${p.rows.length} task(s) ready to import.` : esc(r.error || 'Fix the rows marked below, then check again.')}</div></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th>${mode === 'sync' ? '<th>id</th>' : ''}<th>Title</th><th>Owner</th><th>Due</th><th>Problems</th></tr></thead><tbody>${p.rows.map((x, i) => `<tr><td>${i + 1}</td>${mode === 'sync' ? `<td>${esc(x.id || 'new')}</td>` : ''}<td>${esc(x.title)}</td><td>${esc(x.owner)}</td><td class="nowrap">${esc(x.due)}</td><td>${errs[i + 1] ? `<span class="errline">${esc(errs[i + 1].join(' · '))}</span>` : '<span class="okline">' + icon('check') + ' OK</span>'}</td></tr>`).join('')}</tbody></table></div>`;
    }
    parsed = r.ok ? p.rows : null; $('#go', d.el).disabled = !parsed;
  };
  $('#go', d.el).onclick = async e => {
    const btn = e.currentTarget;
    if (!parsed) return;
    if (mode === 'sync' && !await confirmBox({ title: 'Apply the new plan?', text: `${opts().renumber ? 'Every task gets a new number in date order. ' : ''}${opts().notify ? 'Everyone affected gets one message about their part.' : 'Nobody gets a message.'}`, ok: 'Apply' })) return;
    busy(btn, true, mode === 'add' ? 'Importing…' : 'Applying…');
    const r = mode === 'add' ? await ctx.api.post('task.import', { rows: parsed, notify: opts().notify }) : await ctx.api.post('task.sync', Object.assign({ rows: parsed }, opts()));
    busy(btn, false);
    if (!r.ok) return toast(r.error, 'err');
    if (mode === 'add') { r.tasks.forEach(t => ctx.patchTask(t)); toast(`Imported ${r.count} tasks.${opts().notify ? ' Everyone got a message.' : ''}`); d.close(); return; }
    const moved = r.renumbered ? Object.keys(r.renumbered).filter(k => k !== r.renumbered[k]) : [];
    if (moved.length) download('task-numbers-old-to-new.csv', csvBuild([['old id', 'new id']].concat(moved.map(k => [k, r.renumbered[k]]))), 'text/csv');
    toast(`Plan updated: ${r.added} new, ${r.updated} changed, ${r.dropped} dropped${moved.length ? ' — the old → new numbers were downloaded' : ''}.`);
    d.close(); sel.clear(); await ctx.refresh();
  };
}
