/* Review (leads): every finished task with its proof. Approve it, or ask for a redo (the owner is told what to fix). */
import { $, esc, icon, empty } from '../ui.js';
import { taskCard, wireTasks, fileIds } from '../task-card.js';

const F = { who: '', mode: 'pending', files: false };

export function review(ctx) {
  const D = ctx.D, all = (D.all || []).filter(t => t.status === 'Done' && t.proof);
  const pend = all.filter(t => !t.review && t.owner !== D.me.key);
  let list = F.mode === 'pending' ? pend : F.mode === 'approved' ? all.filter(t => t.review === 'approved') : all;
  if (F.who) list = list.filter(t => t.owner === F.who);
  if (F.files) list = list.filter(t => fileIds(t.proof).length);
  list = list.slice().sort((a, b) => (b.done_at || '') < (a.done_at || '') ? -1 : 1);
  ctx.el.innerHTML = `<p class="lede">Every finished task with its proof, newest first. Approve good work; ask for a redo when the proof doesn't show the task was done — the owner is told exactly what to fix.</p>
    <div class="toolbar"><div class="seg">${[['pending', 'Waiting for review', pend.length], ['approved', 'Approved'], ['all', 'All finished']].map(([k, l, n]) => `<button data-mode="${k}" class="${F.mode === k ? 'on' : ''}">${l}${n ? ` <span class="cnt">${n}</span>` : ''}</button>`).join('')}</div>
      <select id="rw" aria-label="Person"><option value="">Everyone</option>${D.team.map(p => `<option value="${esc(p.key)}" ${p.key === F.who ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <label class="row small" style="font-weight:700"><input type="checkbox" id="rf" ${F.files ? 'checked' : ''}> only with photos/files</label>
      <span class="spacer"></span><span class="count">${list.length} task(s)</span></div>
    <div id="rlist">${list.length ? list.map(t => taskCard(ctx, t, { open: true, showOwner: true })).join('') : `<div class="card">${empty({ title: F.mode === 'pending' ? 'All caught up' : 'Nothing here yet', text: 'Proof appears here the moment someone marks a task done.' })}</div>`}</div>`;
  ctx.el.querySelector('.seg').onclick = e => { const b = e.target.closest('[data-mode]'); if (b) { F.mode = b.dataset.mode; review(ctx); } };
  $('#rw').onchange = e => { F.who = e.target.value; review(ctx); };
  $('#rf').onchange = e => { F.files = e.target.checked; review(ctx); };
  wireTasks($('#rlist'), ctx, t => { ctx.patchTask(t); ctx.render(); });
}
