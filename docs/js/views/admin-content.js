/* Meetings, team rules and milestones (admins) — small editable tables, saved to their Sheet tabs. */
import { $, $$, esc, icon, toast, busy } from '../ui.js';

const SPEC = {
  Meetings: { title: 'Meetings', hint: 'Shown in everyone\'s Calendar.', cols: [['date', 'Date', 'date'], ['time', 'Time', 'time'], ['where', 'Where', 'text', 'Telegram voice'], ['what', 'What', 'text', 'Roles, launch numbers']] },
  Rules: { title: 'Team rules', hint: 'Shown on the Rules page. Keep them short.', cols: [['title', 'Rule', 'text', 'Reply within 24 hours'], ['text', 'Why / detail', 'text', 'Even if it\'s just "on it".']], order: true },
  Milestones: { title: 'Milestones', hint: 'The big gates and deadlines. “Public” ones appear on your public page; tick “Done” when you hit one.', cols: [['date', 'Date', 'date'], ['label', 'Milestone', 'text', 'Venue confirmed in writing'], ['kind', 'Kind', 'select', ['gate', 'deadline', 'event']], ['public', 'Public', 'check'], ['done', 'Done', 'check']] },
  Sponsors: { title: 'Sponsors & partners', hint: 'Shown as “Supported by” on your public page. Only add ones confirmed in writing.', cols: [['name', 'Name', 'text', '.xyz'], ['logo_url', 'Logo (https link)', 'text', 'https://…/logo.png'], ['link', 'Website', 'text', 'https://gen.xyz'], ['note', 'Note (not shown)', 'text', 'free domains for participants']] },
};
const pick = { Meetings: D => D.meetings, Rules: D => D.rules, Milestones: D => D.milestones, Sponsors: D => D.sponsors };

export function content(ctx) {
  ctx.el.innerHTML = Object.keys(SPEC).map(k => `<div class="card flush" data-tab="${k}"><div class="card-h"><div><h3>${SPEC[k].title}</h3><div class="sub">${SPEC[k].hint}</div></div>
      <div class="row"><button class="btn soft sm" data-add>${icon('plus')} Add row</button><button class="btn primary sm" data-save>Save ${SPEC[k].title.toLowerCase()}</button></div></div>
      <div class="tbl-wrap" style="padding:0 8px 8px"><table class="tbl stack edit"><thead><tr>${SPEC[k].cols.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody></tbody></table></div></div>`).join('');
  Object.keys(SPEC).forEach(k => {
    const card = $(`[data-tab="${k}"]`, ctx.el), body = $('tbody', card), rows = (pick[k](ctx.D) || []).map(r => Object.assign({}, r));
    const draw = () => {
      body.innerHTML = rows.map((r, i) => `<tr data-i="${i}">${SPEC[k].cols.map(([n, l, type, ex]) => `<td data-l="${l}">${type === 'check' ? `<input type="checkbox" data-n="${n}" ${r[n] === true || r[n] === 'yes' ? 'checked' : ''} aria-label="${l}">`
        : type === 'select' ? `<select data-n="${n}" aria-label="${l}">${ex.map(o => `<option ${r[n] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`
        : `<input type="${type}" data-n="${n}" value="${esc(r[n] || '')}" placeholder="${esc(ex || '')}" aria-label="${l}" ${type === 'text' ? '' : 'style="min-width:130px"'}>`}</td>`).join('')}
        <td class="nowrap">${SPEC[k].order ? `<button class="icon-btn" data-up aria-label="Move up">${icon('up')}</button><button class="icon-btn" data-down aria-label="Move down">${icon('down')}</button>` : ''}<button class="icon-btn" data-del aria-label="Delete row">${icon('trash')}</button></td></tr>`).join('') || `<tr><td colspan="9" class="muted">Nothing yet — press “Add row”.</td></tr>`;
    };
    const sync = () => $$('tr[data-i]', body).forEach(tr => { const r = rows[+tr.dataset.i]; $$('[data-n]', tr).forEach(i => { r[i.dataset.n] = i.type === 'checkbox' ? i.checked : i.value.trim(); }); });
    draw();
    card.onclick = async e => {
      const tr = e.target.closest('tr[data-i]'), i = tr ? +tr.dataset.i : -1;
      if (e.target.closest('[data-add]')) { sync(); rows.push(k === 'Milestones' ? { kind: 'deadline', public: false, done: false } : {}); draw(); const inp = $$('tr[data-i]', body).pop(); if (inp) $('input', inp).focus(); }
      if (e.target.closest('[data-del]')) { sync(); rows.splice(i, 1); draw(); }
      if (e.target.closest('[data-up]') && i > 0) { sync(); [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; draw(); }
      if (e.target.closest('[data-down]') && i < rows.length - 1) { sync(); [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; draw(); }
      const sv = e.target.closest('[data-save]');
      if (sv) {
        sync(); busy(sv, true);
        const r = await ctx.api.post('list.save', { tab: k, rows });
        busy(sv, false);
        if (!r.ok) return toast(r.error, 'err');
        const key = { Meetings: 'meetings', Rules: 'rules', Milestones: 'milestones', Sponsors: 'sponsors' }[k];
        ctx.D[key] = r.rows.map(x => k === 'Milestones' ? Object.assign({}, x, { public: x.public === 'yes', done: x.done === 'yes' }) : x);
        rows.length = 0; ctx.D[key].forEach(x => rows.push(Object.assign({}, x))); draw();
        ctx.api.cache(ctx.D); toast(`${SPEC[k].title} saved.`);
      }
    };
  });
}
