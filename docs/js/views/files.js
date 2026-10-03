/* Files: the team's links (Canva, Figma, Sheets, Drive…) and the team files repo on GitHub, by section.
   Also the "What you need" strip on task cards and the picker leads use in the task drawer. */
import { $, $$, esc, icon, toast, busy, modal, field, formValues, confirmBox, empty, store, safeUrl, debounce, skeleton, copy } from '../ui.js';

/** kind → [label, icon] */
export const KIND = {
  canva: ['Canva', 'pen'], figma: ['Figma', 'pen'], sheet: ['Google Sheet', 'table'], doc: ['Google Doc', 'file'], slides: ['Google Slides', 'image'],
  form: ['Google Form', 'check'], drive: ['Google Drive', 'folder'], github: ['GitHub', 'link'], video: ['Video', 'film'], image: ['Picture', 'image'],
  pdf: ['PDF', 'file'], link: ['Link', 'link'], folder: ['Folder', 'folder'], file: ['File', 'file'], office: ['Document', 'file'], text: ['Text', 'file'], font: ['Font', 'type'], zip: ['ZIP', 'download'],
};
const EXT = { png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', pdf: 'pdf', doc: 'office', docx: 'office', ppt: 'office', pptx: 'office', xls: 'office', xlsx: 'office',
  md: 'text', txt: 'text', csv: 'text', mp4: 'video', mov: 'video', webm: 'video', ttf: 'font', otf: 'font', woff2: 'font', zip: 'zip' };
const OFFICE = { doc: 'Word', docx: 'Word', ppt: 'PowerPoint', pptx: 'PowerPoint', xls: 'Excel', xlsx: 'Excel' };
const extOf = p => (String(p).match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase();
export const secKey = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const pretty = k => { const s = String(k || '').replace(/[-_]+/g, ' ').trim(); return s ? s[0].toUpperCase() + s.slice(1) : 'Other files'; };
const size = n => !n ? '' : n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
const files = ctx => (ctx.D && ctx.D.files) || {};
const typeLabel = path => { const e = extOf(path), k = EXT[e] || 'file'; return k === 'office' ? OFFICE[e] : k === 'file' ? (e ? e.toUpperCase() : 'File') : KIND[k][0]; };

/** Where a file of the team files repo opens (preview), and its raw address (download). */
export function fileLinks(ctx, path) {
  const f = files(ctx), enc = String(path).split('/').map(encodeURIComponent).join('/'), ext = extOf(path), kind = EXT[ext] || 'file', br = encodeURIComponent(f.branch || 'main');
  const raw = f.server ? ctx.api.serverBase() + '/files/raw/' + enc : `https://raw.githubusercontent.com/${f.repo}/${br}/${enc}`;
  const blob = `https://github.com/${f.repo}/blob/${br}/${enc}`;
  if (ctx.api.DEMO && window.__hub && window.__hub.raw && window.__hub.raw(path)) { const r = window.__hub.raw(path); return { raw: r, blob, open: kind === 'image' ? r : blob, kind, ext }; }
  const open = kind === 'image' ? raw : kind === 'office' ? 'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(raw)
    : f.server && (kind === 'pdf' || kind === 'video') ? raw : blob;
  return { raw, blob, open, kind, ext };
}

// ------------------------------------------------------------------ the repo's file list (server mirror, or GitHub's API from the browser)
export async function loadTree(ctx, force) {
  const f = files(ctx);
  if (!f.repo) return { tree: [] };
  if (ctx.api.DEMO) return { tree: (window.__hub && window.__hub.tree) || [] };
  if (f.server) {
    const r = await ctx.api.get('files.list');
    if (!r.ok) return { tree: [], error: r.error };
    return { tree: r.tree || [], error: r.error || (r.tree ? '' : 'The hub is fetching the team files from GitHub — this takes a minute the first time.'), syncedAt: r.syncedAt };
  }
  const key = 'hh:tree:' + f.repo + '@' + f.branch, c = store.json(key, null);
  if (c && !force && Date.now() - c.at < 10 * 60e3) return c;
  try {
    const res = await fetch(`https://api.github.com/repos/${f.repo}/git/trees/${encodeURIComponent(f.branch || 'main')}?recursive=1`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(res.status === 403 || res.status === 429 ? 'GitHub is limiting requests from this network — try again in an hour, or open the folder on GitHub.' : res.status === 404 ? 'GitHub can\'t find that repo — is it public? (Settings → Team files)' : 'GitHub answered ' + res.status + '.');
    const j = await res.json(), tree = (j.tree || []).filter(x => x.type === 'blob' && !x.path.split('/').some(p => p.startsWith('.'))).map(x => [x.path, x.size || 0]);
    const out = { at: Date.now(), tree };
    store.set(key, JSON.stringify(out));
    return out;
  } catch (e) { return c ? c : { tree: [], error: e.message || 'Could not load the files from GitHub.' }; }
}

// ------------------------------------------------------------------ "What you need" on a task card
const thumbOf = (ctx, it) => it.thumb ? safeUrl(it.thumb) : (it.path && EXT[extOf(it.path)] === 'image' && files(ctx).repo ? fileLinks(ctx, it.path).raw : '');
export function needItem(ctx, it) {
  let href, label, kind, ext = true;
  if (String(it.ref || '').startsWith('gh:')) {
    if (!files(ctx).repo) return '';
    if (it.folder) { href = '#/files?path=' + encodeURIComponent(it.path); kind = 'folder'; label = 'Folder in Files'; ext = false; }
    else { const L = fileLinks(ctx, it.path); href = L.open; kind = L.kind; label = typeLabel(it.path); }
  } else { href = safeUrl(it.url); kind = it.kind || 'link'; label = (KIND[kind] || KIND.link)[0] + (kind === 'canva' || kind === 'figma' ? ' — open & edit' : ''); }
  if (!href) return '';
  const th = thumbOf(ctx, it);
  return `<a class="need k-${esc(kind)}" href="${esc(href)}" ${ext ? 'target="_blank" rel="noopener"' : ''}><span class="need-ic">${th ? `<img src="${esc(th)}" alt="" loading="lazy">` : icon((KIND[kind] || KIND.file)[1])}</span><span class="need-t"><b>${esc(it.title)}</b><small>${esc(label)}${it.leads ? ' · leads only' : it.private ? ' · team only' : ''}</small></span></a>`;
}
export function needsStrip(ctx, items) {
  const html = (items || []).map(it => needItem(ctx, it)).join('');
  return html ? `<div class="needs"><div class="needs-h">${icon('folder')} What you need</div><div class="need-list">${html}</div></div>` : '';
}
/** Broken thumbnails (a picture that moved) fall back to the icon — one listener per container (no inline handlers: the CSP forbids them). */
export function wireThumbs(el) {
  el.addEventListener('error', e => { const img = e.target; if (img && img.tagName === 'IMG' && img.closest('.need-ic,.fthumb')) { const box = img.parentElement; img.remove(); box.innerHTML = icon('image'); } }, true);
}

// ------------------------------------------------------------------ the Files page
const F = { q: '', sec: '' };
export function filesPage(ctx) {
  const D = ctx.D, f = files(ctx);
  const hq = new URLSearchParams(location.hash.split('?')[1] || '');
  let path = hq.get('path') || '';
  if (path) { F.sec = secKey(path.split('/')[0]); F.q = ''; }
  const act = ctx.setActions(ctx.isLead ? `<button class="btn primary" id="addlink">${icon('plus')} Add a link</button>` : '');
  if (ctx.isLead) $('#addlink', act).onclick = () => linkEditor(ctx, null, () => draw());
  ctx.el.innerHTML = `<div class="files-top">
      <label class="search"><span class="sr">Search files</span>${icon('search')}<input id="fq" type="search" placeholder="Search posters, logos, slides…" value="${esc(F.q)}"></label>
      <div class="seg fchips" id="fchips" role="tablist" aria-label="Sections"></div></div>
    <div id="fnote"></div><div id="fsecs">${skeleton(3)}</div>`;
  let tree = [], note = '';
  const draw = () => {
    const secs = new Map(), add = (key, title) => { if (!secs.has(key)) secs.set(key, { key, title, links: [], files: [] }); return secs.get(key); };
    (D.resources || []).forEach(r => add(secKey(r.section || 'Links') || 'links', r.section || 'Links').links.push(r));
    tree.forEach(([p, sz]) => { const top = p.includes('/') ? p.split('/')[0] : ''; add(secKey(top) || 'other-files', pretty(top)).files.push({ path: p, size: sz }); });
    const list = [...secs.values()].sort((a, b) => a.title.localeCompare(b.title));
    $('#fchips').innerHTML = `<button data-sec="" class="${F.sec ? '' : 'on'}">All</button>` + list.map(s => `<button data-sec="${esc(s.key)}" class="${F.sec === s.key ? 'on' : ''}">${esc(s.title)}</button>`).join('');
    const q = F.q.toLowerCase(), hit = s => !q || s.toLowerCase().includes(q);
    const shown = list.filter(s => !F.sec || s.key === F.sec).map(s => Object.assign({}, s, {
      links: s.links.filter(r => hit(r.title + ' ' + r.note + ' ' + r.section)),
      files: s.files.filter(x => hit(x.path) && (!path || x.path.startsWith(path + '/'))),
    })).filter(s => s.links.length || s.files.length);
    $('#fnote').innerHTML = note ? `<div class="banner">${icon('alert')}<div>${esc(note)}${f.repo ? ` <a href="https://github.com/${esc(f.repo)}" target="_blank" rel="noopener">Open the files on GitHub ${icon('external')}</a>` : ''}</div></div>` : '';
    if (!f.repo && !(D.resources || []).length) {
      $('#fsecs').innerHTML = `<div class="card">${empty({ title: 'No files yet', text: ctx.isAdmin ? 'Put your posters, logos and slides in a public GitHub repo and connect it in <a href="#/admin/settings">Settings → Team files</a>. Leads can add Canva, Figma and Google links with <b>Add a link</b>.' : 'Your leads haven\'t added any files or links yet.' })}</div>`;
      return;
    }
    $('#fsecs').innerHTML = shown.length ? shown.map(s => {
      const groups = new Map();
      s.files.forEach(x => { const parts = x.path.split('/'), sub = parts.slice(1, -1).join(' / '); if (!groups.has(sub)) groups.set(sub, []); groups.get(sub).push(x); });
      return `<section class="card fsec" id="sec-${esc(s.key)}"><div class="card-h"><h3>${esc(s.title)}</h3><span class="sub">${s.links.length ? s.links.length + ' link' + (s.links.length > 1 ? 's' : '') : ''}${s.links.length && s.files.length ? ' · ' : ''}${s.files.length ? s.files.length + ' file' + (s.files.length > 1 ? 's' : '') : ''}</span></div>
        ${s.links.length ? `<div class="ftiles">${s.links.map(r => linkTile(ctx, r)).join('')}</div>` : ''}
        ${[...groups.entries()].map(([sub, xs]) => `${sub ? `<h4 class="fsub">${icon('folder')} ${esc(sub)}</h4>` : ''}<div class="ftiles">${xs.map(x => fileTile(ctx, x)).join('')}</div>`).join('')}</section>`;
    }).join('') : `<div class="card">${empty({ title: 'Nothing matches', text: 'Try another word, or pick All.' })}</div>`;
  };
  $('#fq').oninput = debounce(e => { F.q = e.target.value.trim(); draw(); }, 150);
  $('#fchips').onclick = e => { const b = e.target.closest('[data-sec]'); if (!b) return; F.sec = b.dataset.sec; if (path) { path = ''; history.replaceState(null, '', '#/files'); } draw(); };
  wireThumbs(ctx.el);
  ctx.el.addEventListener('click', e => {
    const im = e.target.closest('[data-img]');
    if (im) { e.preventDefault(); return lightbox(ctx, im.dataset.img); }
    const ed = e.target.closest('[data-edit]');
    if (ed) { const r = (D.resources || []).find(x => x.id === ed.dataset.edit); if (r) linkEditor(ctx, r, () => draw()); return; }
    const cp = e.target.closest('[data-copy]');
    if (cp) copy(cp.dataset.copy, 'Link copied.');
  });
  draw();
  loadTree(ctx).then(t => { tree = t.tree || []; note = t.error || ''; if (ctx.el && $('#fsecs')) draw(); });
}
function linkTile(ctx, r) {
  const k = KIND[r.kind] || KIND.link, url = safeUrl(r.url), th = r.thumb ? safeUrl(r.thumb) : '';
  return `<div class="ftile"><a class="fthumb k-${esc(r.kind)}" href="${esc(url)}" target="_blank" rel="noopener" aria-hidden="true" tabindex="-1">${th ? `<img src="${esc(th)}" alt="" loading="lazy">` : icon(k[1])}</a>
    <div class="fbody"><a class="ftitle" href="${esc(url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
      <div class="fmeta">${esc(k[0])}${r.leads ? ' · <span title="Only leads and admins see it">leads only</span>' : r.private ? ' · <span title="Guests don\'t see it">team only</span>' : ''}</div>${r.note ? `<div class="fnote">${esc(r.note)}</div>` : ''}
      <div class="factions"><a class="btn sm soft" href="${esc(url)}" target="_blank" rel="noopener">${icon('external')} ${r.kind === 'canva' ? 'Open in Canva' : r.kind === 'figma' ? 'Open in Figma' : 'Open'}</a>
        <button class="icon-btn sm" data-copy="${esc(url)}" title="Copy the link" aria-label="Copy the link">${icon('copy')}</button>${ctx.isLead ? `<button class="icon-btn sm" data-edit="${esc(r.id)}" title="Edit" aria-label="Edit ${esc(r.title)}">${icon('edit')}</button>` : ''}</div></div></div>`;
}
function fileTile(ctx, x) {
  const L = fileLinks(ctx, x.path), name = x.path.split('/').pop(), isImg = L.kind === 'image';
  return `<div class="ftile"><a class="fthumb k-${esc(L.kind)}" href="${esc(L.open)}" target="_blank" rel="noopener" ${isImg ? `data-img="${esc(x.path)}"` : ''} aria-hidden="true" tabindex="-1">${isImg ? `<img src="${esc(L.raw)}" alt="" loading="lazy">` : icon((KIND[L.kind] || KIND.file)[1])}</a>
    <div class="fbody"><a class="ftitle" href="${esc(L.open)}" target="_blank" rel="noopener" ${isImg ? `data-img="${esc(x.path)}"` : ''}>${esc(name)}</a>
      <div class="fmeta">${esc(typeLabel(x.path))}${x.size ? ' · ' + size(x.size) : ''}</div>
      <div class="factions"><a class="btn sm soft" href="${esc(L.open)}" target="_blank" rel="noopener" ${isImg ? `data-img="${esc(x.path)}"` : ''}>${icon('eye')} Open</a><a class="btn sm ghost" href="${esc(L.raw)}" download="${esc(name)}" target="_blank" rel="noopener">${icon('download')} Download</a></div></div></div>`;
}
function lightbox(ctx, path) {
  const L = fileLinks(ctx, path), name = path.split('/').pop();
  modal({ title: name, size: 'lg', body: `<div class="lightbox"><img src="${esc(L.raw)}" alt="${esc(name)}"></div>`,
    foot: `<button class="btn ghost" data-close>Close</button><a class="btn primary" href="${esc(L.raw)}" download="${esc(name)}" target="_blank" rel="noopener">${icon('download')} Download</a>` });
}

/** Leads: add or edit a link on the Files page. */
export function linkEditor(ctx, r, done) {
  const D = ctx.D, secs = [...new Set((D.resources || []).map(x => x.section).filter(Boolean))].sort();
  const m = modal({ title: r ? 'Edit link' : 'Add a link to Files', body: `<form id="lf" class="form-grid" autocomplete="off">
      ${field({ label: 'Title', name: 'title', value: r ? r.title : '', required: true, full: true, placeholder: 'Launch poster (UZ) — Canva', attrs: 'maxlength="120" autofocus' })}
      ${field({ label: 'Link', name: 'url', type: 'url', value: r ? r.url : '', required: true, full: true, placeholder: 'https://www.canva.com/d/…', hint: 'Canva: Share → copy link. Google: Share → anyone with the link, or add the team.' })}
      <div class="field full"><label for="lf-sec">Section</label><input id="lf-sec" name="section" list="lf-secs" value="${esc(r ? r.section : '')}" placeholder="Posters & flyers"><datalist id="lf-secs">${secs.map(s => `<option value="${esc(s)}">`).join('')}</datalist><small class="hint">Same name as a folder in the team files repo = shown together.</small></div>
      ${field({ label: 'Note (optional)', name: 'note', value: r ? r.note : '', full: true, placeholder: 'Edit the date + QR, then export as PNG' })}
      <div class="full">${field({ label: 'Who sees it', name: 'private', type: 'select', value: r ? (r.leads ? 'leads' : r.private ? 'yes' : 'no') : 'no', options: [['no', 'Everyone with access to the hub (guests too)'], ['yes', 'The team only — not guests (contact lists, edit links)'], ['leads', 'Leads and admins only (your own plans and notes)']] })}</div>
      <details class="full"><summary class="small"><b>Picture (optional)</b></summary>${field({ label: 'Picture link (https://…)', name: 'thumb', value: r ? r.thumb : '', full: true, hint: 'A small preview image, e.g. the poster as a PNG in the team files repo.' })}</details>
    </form>`,
    foot: `${r ? `<button class="btn danger ghost left" data-del>${icon('trash')} Delete</button>` : ''}<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-save>${r ? 'Save' : 'Add link'}</button>` });
  m.el.addEventListener('click', async e => {
    const sv = e.target.closest('[data-save]');
    if (sv) {
      const v = formValues($('#lf', m.el));
      busy(sv, true);
      const res = await ctx.api.post('resource.save', { resource: Object.assign({ id: r ? r.id : '' }, v) });
      busy(sv, false);
      if (!res.ok) return toast(res.error, 'err');
      D.resources = res.resources; ctx.api.cache(D); toast(r ? 'Saved.' : 'Added to Files.'); m.close(); if (done) done(res.resource);
    }
    if (e.target.closest('[data-del]')) {
      let res = await ctx.api.post('resource.delete', { id: r.id });
      if (!res.ok && res.code === 'used') {
        if (!await confirmBox({ title: 'Delete this link?', text: esc(res.error), ok: 'Delete anyway', danger: true })) return;
        res = await ctx.api.post('resource.delete', { id: r.id, force: true });
      }
      if (!res.ok) return toast(res.error, 'err');
      D.resources = (D.resources || []).filter(x => x.id !== r.id); ctx.api.cache(D); toast('Deleted.'); m.close(); if (done) done(null); ctx.refresh({ silent: true });
    }
  });
}

// ------------------------------------------------------------------ picker (task drawer): choose what a task needs
export function pickNeeds(ctx, current) {
  return new Promise(res => {
    const picked = (current || []).slice(), D = ctx.D;
    let tab = 'links', tree = [], q = '', result = null;
    const m = modal({ title: 'What does this task need?', size: 'lg', onClose: () => res(result),
      body: `<div class="seg" role="tablist" id="pk-tabs"><button data-tab="links" class="on">${icon('link')} Links</button><button data-tab="files">${icon('folder')} Team files</button></div>
        <label class="search" style="margin:12px 0"><span class="sr">Search</span>${icon('search')}<input id="pk-q" type="search" placeholder="Search…"></label>
        <div id="pk-list" class="pk-list"></div><div class="small muted" style="margin-top:8px" id="pk-n"></div>`,
      foot: `${ctx.isLead ? `<button class="btn ghost left" id="pk-new">${icon('plus')} New link</button>` : ''}<button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="pk-ok">Use these</button>` });
    const row = (ref, title, sub, ic) => `<label class="pk-row"><input type="checkbox" data-ref="${esc(ref)}" ${picked.includes(ref) ? 'checked' : ''}><span class="need-ic">${icon(ic)}</span><span><b>${esc(title)}</b><small>${esc(sub)}</small></span></label>`;
    const draw = () => {
      const hit = s => !q || s.toLowerCase().includes(q);
      let html = '';
      if (tab === 'links') html = (D.resources || []).filter(r => hit(r.title + ' ' + r.section)).map(r => row(r.id, r.title, (KIND[r.kind] || KIND.link)[0] + (r.section ? ' · ' + r.section : ''), (KIND[r.kind] || KIND.link)[1])).join('') || `<p class="muted small">No links yet${ctx.isLead ? ' — press <b>New link</b>.' : '.'}</p>`;
      else {
        const folders = [...new Set(tree.flatMap(([p]) => p.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/'))))].sort();
        html = folders.filter(hit).map(p => row('gh:' + p + '/', p.split('/').pop() + '/', 'Folder · ' + p, 'folder')).join('') +
          tree.filter(([p]) => hit(p)).slice(0, 300).map(([p, sz]) => row('gh:' + p, p.split('/').pop(), typeLabel(p) + ' · ' + p.split('/').slice(0, -1).join('/') + (sz ? ' · ' + size(sz) : ''), (KIND[EXT[extOf(p)] || 'file'] || KIND.file)[1])).join('')
          || `<p class="muted small">${files(ctx).repo ? 'Loading the team files…' : 'No team files repo yet (Settings → Team files).'}</p>`;
      }
      $('#pk-list', m.el).innerHTML = html;
      $('#pk-n', m.el).textContent = picked.length ? `${picked.length} chosen` : '';
    };
    $('#pk-tabs', m.el).onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; $$('#pk-tabs button', m.el).forEach(x => x.classList.toggle('on', x === b)); draw(); };
    $('#pk-q', m.el).oninput = debounce(e => { q = e.target.value.trim().toLowerCase(); draw(); }, 120);
    $('#pk-list', m.el).onchange = e => { const c = e.target.closest('[data-ref]'); if (!c) return; const i = picked.indexOf(c.dataset.ref); if (c.checked && i < 0) picked.push(c.dataset.ref); if (!c.checked && i >= 0) picked.splice(i, 1); $('#pk-n', m.el).textContent = picked.length ? `${picked.length} chosen` : ''; };
    $('#pk-ok', m.el).onclick = () => { result = picked.slice(0, 12); m.close(); };
    const nw = $('#pk-new', m.el); if (nw) nw.onclick = () => linkEditor(ctx, null, r => { if (r) { picked.push(r.id); tab = 'links'; draw(); } });
    draw();
    loadTree(ctx).then(t => { tree = t.tree || []; if (tab === 'files') draw(); });
  });
}
/** Chips for the task drawer: what a task needs, before saving. */
export function needChips(ctx, refs) {
  const res = new Map((ctx.D.resources || []).map(r => [r.id, r]));
  return refs.length ? refs.map(ref => { const r = res.get(ref), t = r ? r.title : ref.replace(/^gh:/, '').replace(/\/$/, ' /').split('/').filter(Boolean).pop(); return `<span class="need-chip">${icon(r ? (KIND[r.kind] || KIND.link)[1] : /\/$/.test(ref) ? 'folder' : 'file')} ${esc(t || ref)}<button type="button" data-unpick="${esc(ref)}" aria-label="Remove ${esc(t || ref)}">${icon('x')}</button></span>`; }).join('') : '<span class="small muted">Nothing yet — posters, Canva links, the tracker…</span>';
}
