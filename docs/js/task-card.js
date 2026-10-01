/* The task card: Start → Done + proof (photo / file / link) or Blocked + what you need. Leads also approve or ask for a redo. */
import { $, $$, esc, icon, pill, reviewPill, dueInfo, linkify, safeUrl, toast, store, busy, first } from './ui.js';
import { needsStrip, wireThumbs } from './views/files.js';

const stCls = s => ({ 'In progress': 'st-ip', Blocked: 'st-bl', Done: 'st-dn', Dropped: 'st-dr' }[s] || '');
const dur = m => !m ? '' : m < 60 ? `${m} min` : (m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`);
export const fileIds = s => [...String(s || '').matchAll(/\/file\/d\/([\w-]+)/g)].map(m => m[1]); // Google Drive and self-hosted links alike

export function taskCard(ctx, t, opts = {}) {
  const di = dueInfo(t, ctx.tz), done = t.status === 'Done', mine = t.owner === ctx.me.key;
  const canAct = !ctx.isViewer && (mine || ctx.isLead) && t.status !== 'Dropped';
  const checks = store.json('hh:steps:' + t.id, []);
  const ids = fileIds(t.proof), textProof = String(t.proof || '').replace(/^Photo: https?:\/\/\S+$/gm, '').trim();
  const canReview = ctx.isLead && done && !mine;
  return `<details class="task ${stCls(t.status)}" data-id="${esc(t.id)}" ${opts.open ? 'open' : ''}>
    <summary><div class="t-main"><div class="t-title">${esc(t.title)}</div>
      <div class="t-meta">${opts.showOwner ? `<b>${esc(ctx.nameOf(t.owner))}</b>` : ''}<span class="due ${di.cls}">${esc(di.label)}${di.date ? ' · ' + esc(di.date) : ''}</span>
        ${t.mins ? `<span>~${dur(t.mins)}</span>` : ''}${t.area ? `<span class="tag">${esc(t.area)}</span>` : ''}<span>${esc(t.id)}</span></div></div>
      <div class="row" style="gap:6px;justify-content:flex-end">${reviewPill(t)}${pill(t.status)}</div></summary>
    <div class="t-body">
      ${t.why ? `<p class="why"><b>Why:</b> ${esc(t.why)}</p>` : ''}
      ${t.resources && t.resources.length ? needsStrip(ctx, t.resources) : ''}
      ${t.steps && t.steps.length ? `<ol class="steps">${t.steps.map((s, i) => `<li><label><input type="checkbox" data-step="${i}" ${checks[i] ? 'checked' : ''} ${canAct ? '' : 'disabled'}><span class="num">${i + 1}.</span><span>${esc(s)}</span></label></li>`).join('')}</ol>` : ''}
      ${t.done_when ? `<div class="donebox"><b>Done =</b> ${esc(t.done_when)}</div>` : ''}
      ${t.links && t.links.length ? `<div class="links">${t.links.filter(l => safeUrl(l.url)).map(l => `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${icon('external')} ${esc(l.label)}</a>`).join('')}</div>` : ''}
      ${t.ask ? `<div class="askbox"><b>Ask:</b> ${esc(t.ask)}</div>` : ''}
      ${t.blocked_reason && (t.status === 'Blocked' || t.review === 'redo') ? `<div class="banner ${t.status === 'Blocked' ? 'bad' : ''}" style="margin:8px 0">${icon('alert')}<div><b>${t.status === 'Blocked' ? 'Blocked' : 'To fix'}:</b> ${esc(t.blocked_reason.replace(/^Redo: /, ''))}</div></div>` : ''}
      ${done && t.proof ? `<div class="proofbox"><b>Proof:</b> ${textProof ? linkify(textProof) : ''}${ids.length ? `<div class="actions" style="margin-top:8px">${ids.map((id, i) => `<button class="btn sm soft" data-file="${esc(id)}">${icon('image')} Show file ${ids.length > 1 ? i + 1 : ''}</button>`).join('')}</div><div class="pimgs"></div>` : ''}${t.done_at ? `<div class="small muted" style="margin-top:4px">Finished ${esc(t.done_at)}</div>` : ''}</div>` : ''}
      ${canReview ? `<div class="actions">${t.review === 'approved' ? `<span class="pill ok">${icon('check')} Approved by ${esc(t.reviewed_by)}</span>` : `<button class="btn ok sm" data-review="ok">${icon('check')} Approve</button>`}<button class="btn soft sm" data-form="redo">Ask for a redo</button></div>
        <div class="sub-form" data-f="redo"><label class="small"><b>What should ${esc(first(ctx.nameOf(t.owner)))} fix?</b></label><textarea placeholder="The photo is blurry — retake it with the whole poster in view."></textarea><div class="actions"><button class="btn primary sm" data-review="redo">${icon('send')} Send — ask for a redo</button></div></div>` : ''}
      ${canAct ? `<div class="actions">
        ${!done && t.status !== 'In progress' ? `<button class="btn go" data-act="In progress">${icon('play')} Start</button>` : ''}
        ${!done ? `<button class="btn ok" data-form="done">${icon('check')} Done — add proof</button><button class="btn danger ghost" data-form="block">${icon('alert')} I'm blocked</button>` : `<button class="btn ghost sm" data-act="In progress">Reopen</button>`}
      </div>
      <div class="sub-form" data-f="done">
        <label class="filebox">${icon('upload')} Attach photos or files (PDF, Word, Excel…)<input type="file" class="pf" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"><div class="pfn small"></div></label>
        <textarea placeholder="And/or paste a link, or a name + number. Optional if you attached a photo."></textarea>
        <div class="actions"><button class="btn ok" data-send="Done">${icon('check')} Send — mark as done</button></div></div>
      <div class="sub-form" data-f="block"><label class="small"><b>What do you need, and from whom?</b></label>
        <textarea placeholder="I need the teacher's number from Ann by Thursday."></textarea>
        <div class="actions"><button class="btn danger" data-send="Blocked">${icon('send')} Send — I'm blocked</button></div></div>` : ''}
    </div></details>`;
}

const EXT = { pdf: 'application/pdf', txt: 'text/plain', zip: 'application/zip', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
const extMime = n => EXT[String(n).split('.').pop().toLowerCase()] || 'application/octet-stream';
const fileB64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('Could not read this file.')); r.readAsDataURL(f); });
function shrink(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.82).split(',')[1]); };
    img.onerror = () => rej(new Error('Could not read this photo. Try a JPG or PNG.')); img.src = u;
  });
}

/** One delegated listener per container. onChange(task) runs after the server saved a change. */
export function wireTasks(el, ctx, onChange) {
  wireThumbs(el);
  el.addEventListener('change', e => {
    const pf = e.target.closest('input.pf');
    if (pf) { pf.parentElement.querySelector('.pfn').textContent = pf.files.length ? `📎 ${pf.files.length} file(s) ready — they upload when you press Send.` : ''; return; }
    const cb = e.target.closest('input[data-step]'); if (!cb) return;
    const id = cb.closest('.task').dataset.id, k = 'hh:steps:' + id, arr = store.json(k, []);
    arr[Number(cb.dataset.step)] = cb.checked; store.set(k, JSON.stringify(arr));
  });
  el.addEventListener('click', async e => {
    const card = e.target.closest('.task'); if (!card) return;
    const id = card.dataset.id;
    const fb = e.target.closest('[data-form]');
    if (fb) { $$('.sub-form', card).forEach(f => f.classList.toggle('show', f.dataset.f === fb.dataset.form && !f.classList.contains('show'))); const ta = $('.sub-form.show textarea', card); if (ta) ta.focus(); return; }
    const fl = e.target.closest('[data-file]');
    if (fl) {
      const box = $('.pimgs', card); busy(fl, true, 'Loading…');
      const r = await ctx.api.get('photo', { id: fl.dataset.file });
      if (!r.ok) { toast(r.error || 'Could not load the file.', 'err'); busy(fl, false); return; }
      box.insertAdjacentHTML('beforeend', /^data:image\//.test(r.data) ? `<img src="${r.data}" alt="Proof for ${esc(id)}">` : `<div style="margin-top:8px"><a class="btn sm ghost" download="${esc(r.name || 'file')}" href="${r.data}">${icon('download')} ${esc(r.name || 'file')}</a></div>`);
      fl.remove(); return;
    }
    const rv = e.target.closest('[data-review]');
    if (rv) {
      const verdict = rv.dataset.review, ta = verdict === 'redo' ? $('.sub-form.show textarea', card) : null;
      busy(rv, true, 'Sending…');
      const r = await ctx.api.post('review', { id, verdict, note: ta ? ta.value.trim() : '' });
      busy(rv, false);
      if (!r.ok) return toast(r.error || 'Could not save.', 'err');
      toast(verdict === 'ok' ? 'Approved.' : 'Sent back — they have been told what to fix.');
      onChange(r.task); return;
    }
    const act = e.target.closest('[data-act],[data-send]'); if (!act) return;
    const status = act.dataset.act || act.dataset.send, form = act.closest('.sub-form'), ta = form ? $('textarea', form) : null;
    const body = { id, status };
    if (status === 'Done') body.proof = ta.value.trim();
    if (status === 'Blocked') body.reason = ta.value.trim();
    busy(act, true, 'Saving…');
    try {
      const pf = status === 'Done' ? $('.pf', form) : null, files = pf ? [...pf.files].slice(0, 4) : [];
      if (files.length) {
        const lines = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i], isImg = /^image\//.test(f.type);
          act.innerHTML = `<span class="spin"></span>Uploading ${i + 1} of ${files.length}…`;
          if (!isImg && f.size > 6.5e6) throw new Error(`"${f.name}" is over 6 MB. Send a smaller file, or paste a link.`);
          const data = isImg ? await shrink(f, 1280) : await fileB64(f);
          const up = await ctx.api.post('upload', { id, mime: isImg ? 'image/jpeg' : (f.type || extMime(f.name)), fname: f.name, data });
          if (!up.ok) throw new Error(up.error || 'Upload failed.');
          lines.push('Photo: ' + up.url);
        }
        body.proof = [body.proof].concat(lines).filter(Boolean).join('\n');
      }
      const r = await ctx.api.post('status', body);
      if (!r.ok) throw new Error(r.error || 'Could not save.');
      toast(status === 'Done' ? 'Nice — marked done.' : status === 'Blocked' ? 'Sent. Your lead has been told.' : 'Saved.');
      onChange(r.task);
    } catch (err) { busy(act, false); toast(err.message || 'No connection — try again.', 'err'); }
  });
}
