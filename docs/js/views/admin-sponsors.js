/* Sponsors & partners (admins): a logo gallery. Drop a picture to add a sponsor — the website shrinks it and the hub keeps it
   as a public picture (Google Drive, or /files/pub/ on your own server). Public ones show as "Supported by" on the public page,
   and "Copy for haven.hackclub.com" makes the sponsors part of your city page on HQ's site. */
import { $, $$, esc, icon, toast, busy, drawer, modal, confirmBox, field, formValues, copy, safeImg, safeUrl, imageData, empty } from '../ui.js';
import { sponsorWall } from './public.js';

const TIERS = ['Sponsor', 'Prize sponsor', 'In-kind', 'Venue', 'Partner', 'Community partner', 'Food'];
const nameFromFile = f => String(f.name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\b(logo|final|copy|png|svg|color|colour|white|black)\b/gi, '').replace(/\s+/g, ' ').trim();

export function sponsorsPage(ctx) {
  const D = ctx.D, list = D.sponsors || [];
  const act = ctx.setActions(`<button class="btn ghost" id="sp-hq" title="The sponsors part of your page on haven.hackclub.com">${icon('copy')}<span class="hide-sm">Copy for haven.hackclub.com</span></button><button class="btn primary" id="sp-add">${icon('plus')} Add sponsor</button>`);
  $('#sp-add', act).onclick = () => sponsorDrawer(ctx, null);
  $('#sp-hq', act).onclick = () => hqExport(ctx);
  const pub = list.filter(s => s.public);
  ctx.el.innerHTML = `<p class="lede">Logos of the people and companies who help. Public ones appear as <b>Supported by</b> on your <a href="${esc(ctx.api.publicUrl())}" target="_blank" rel="noopener">public page</a>. Only add a sponsor once they confirmed in writing.</p>
    <label class="dropzone" id="sp-drop">${icon('upload')}<div><b>Drop a logo here</b> — or click to choose one. PNG, JPG, WebP or SVG; it is shrunk for you.<div class="small muted">Each picture you drop becomes a new sponsor you can name.</div></div><input type="file" accept="image/*" multiple hidden></label>
    ${list.length ? `<div class="sp-admin">${list.map((s, i) => `<div class="card sp-item ${s.public ? '' : 'off'}" data-id="${esc(s.id)}">
        <div class="sp-logo big">${safeImg(s.logo) ? `<img src="${esc(safeImg(s.logo))}" alt="" referrerpolicy="no-referrer">` : `<span class="muted small">${icon('image')} no logo yet</span>`}</div>
        <div class="sp-meta"><b>${esc(s.name)}</b><div class="row" style="gap:6px">${s.tier ? `<span class="pill">${esc(s.tier)}</span>` : ''}${s.public ? '' : '<span class="pill warn">hidden</span>'}</div>
          ${s.blurb ? `<div class="small">${esc(s.blurb)}</div>` : ''}${safeUrl(s.link) ? `<a class="small" href="${esc(safeUrl(s.link))}" target="_blank" rel="noopener">${esc(s.link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>` : ''}
          ${s.note ? `<div class="small muted" title="Only admins see this">${icon('eye')} ${esc(s.note)}</div>` : ''}</div>
        <div class="sp-acts"><button class="btn soft sm" data-a="edit">${icon('edit')} Edit</button><button class="icon-btn sm" data-a="up" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(s.name)} up">${icon('up')}</button><button class="icon-btn sm" data-a="down" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(s.name)} down">${icon('down')}</button><button class="icon-btn sm" data-a="del" aria-label="Remove ${esc(s.name)}">${icon('trash')}</button></div></div>`).join('')}</div>`
      : `<div class="card">${empty({ title: 'No sponsors yet', text: 'Drop a logo above, or press “Add sponsor”. Prize sponsors, in-kind help, the venue and partners all count.' })}</div>`}
    ${pub.length ? `<h3 class="section-t">${icon('globe')} How the public page shows them</h3><div class="card sp-card">${sponsorWall(pub)}</div>` : ''}`;
  const drop = $('#sp-drop'), input = $('input', drop);
  const take = files => { const imgs = [...files].filter(f => /^image\//.test(f.type)); if (!imgs.length) return toast('That is not a picture.', 'err'); queue(ctx, imgs); };
  input.onchange = () => { take(input.files); input.value = ''; };
  ['dragenter', 'dragover'].forEach(k => drop.addEventListener(k, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(k => drop.addEventListener(k, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => take(e.dataTransfer.files));
  ctx.el.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const card = b.closest('[data-id]'), i = list.findIndex(s => s.id === card.dataset.id), s = list[i];
    if (b.dataset.a === 'edit') return sponsorDrawer(ctx, s);
    if (b.dataset.a === 'del') {
      if (!await confirmBox({ title: `Remove ${s.name}?`, text: 'They disappear from the public page. The logo file stays in your Drive / server.', ok: 'Remove', danger: true })) return;
      const r = await ctx.api.post('sponsor.delete', { id: s.id }); if (!r.ok) return toast(r.error, 'err');
      D.sponsors = r.sponsors; ctx.api.cache(D); toast('Removed.'); return sponsorsPage(ctx);
    }
    const j = b.dataset.a === 'up' ? i - 1 : i + 1; if (j < 0 || j >= list.length) return;
    const ids = list.map(x => x.id); [ids[i], ids[j]] = [ids[j], ids[i]];
    const r = await ctx.api.post('sponsor.order', { ids }); if (!r.ok) return toast(r.error, 'err');
    D.sponsors = r.sponsors; ctx.api.cache(D); sponsorsPage(ctx);
  };
}

/** Several logos dropped at once: one drawer after another, each prefilled with the picture and a name guessed from the file name. */
async function queue(ctx, files) {
  for (const f of files) { const done = await new Promise(res => sponsorDrawer(ctx, null, f, res)); if (!done) break; }
}

function sponsorDrawer(ctx, s, file, onDone) {
  const x = s || { name: file ? nameFromFile(file) : '', link: '', tier: '', blurb: '', note: '', public: true, logo: '' };
  let logo = null, saved = false; // { data, mime, preview }
  const tiers = [...new Set(TIERS.concat(ctx.D.sponsorTiers || [], (ctx.D.sponsors || []).map(y => y.tier).filter(Boolean)))];
  const d = drawer({ title: s ? s.name : 'Add a sponsor', sub: 'Shown on your public page when “Show on the public page” is on.',
    body: `<form id="spf" autocomplete="off">
      <label class="dropzone small-dz" id="spf-drop"><div class="sp-logo big" id="spf-prev">${safeImg(x.logo) ? `<img src="${esc(safeImg(x.logo))}" alt="" referrerpolicy="no-referrer">` : `<span class="muted">${icon('image')}</span>`}</div>
        <div><b>${x.logo ? 'Change the logo' : 'Upload the logo'}</b><div class="small muted">Drop a picture or click. Transparent PNG or SVG looks best.</div></div><input type="file" accept="image/*" hidden></label>
      ${field({ label: 'Name', name: 'name', value: x.name, required: true, attrs: 'maxlength="80" autofocus' })}
      ${field({ label: 'Website', name: 'link', type: 'url', value: x.link, placeholder: 'https://… (optional)', hint: 'The logo links there.' })}
      <div class="field"><label for="spf-t">Kind</label><input id="spf-t" name="tier" list="spf-tiers" value="${esc(x.tier || '')}" placeholder="Prize sponsor, In-kind, Partner…"><datalist id="spf-tiers">${tiers.map(t => `<option value="${esc(t)}">`).join('')}</datalist><small class="hint">Sponsors of the same kind are shown together.</small></div>
      ${field({ label: 'What they give (public, optional)', name: 'blurb', value: x.blurb, placeholder: 'Badges for everyone who ships a game', attrs: 'maxlength="200"' })}
      ${field({ label: 'Private note (only admins see it)', name: 'note', value: x.note, placeholder: 'Contact, what we promised in return…', attrs: 'maxlength="300"' })}
      ${field({ label: 'Show on the public page', name: 'public', type: 'toggle', value: x.public !== false, hint: 'Off = kept here only (e.g. waiting for their OK to name them).' })}
      <details class="small"><summary>Or use a link to a logo instead of uploading</summary>${field({ label: 'Logo link', name: 'logo_url', type: 'url', value: /^https:/.test(x.logo_url || '') ? x.logo_url : '', placeholder: 'https://…/logo.png' })}</details>
      ${s && x.logo ? '<label class="row small" style="margin-top:8px;font-weight:700"><input type="checkbox" name="removeLogo"> Remove the logo</label>' : ''}
    </form>`,
    foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-save>${s ? 'Save' : 'Add sponsor'}</button>`,
    onClose: () => { if (onDone) onDone(saved); } });
  const form = $('#spf', d.el), dz = $('#spf-drop', d.el), inp = $('input[type=file]', dz);
  const use = async f => {
    if (!f) return;
    try {
      const svg = /svg/.test(f.type), data = await imageData(f, { max: svg ? 900 : 700, type: 'png' }), mime = data.slice(5, data.indexOf(';'));
      logo = { data: data.split(',')[1], mime }; $('#spf-prev', d.el).innerHTML = `<img src="${esc(data)}" alt="">`;
      if (!form.name.value) form.name.value = nameFromFile(f);
    } catch (err) { toast(err.message, 'err'); }
  };
  inp.onchange = () => use(inp.files[0]);
  ['dragenter', 'dragover'].forEach(k => dz.addEventListener(k, e => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(k => dz.addEventListener(k, e => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', e => use(e.dataTransfer.files[0]));
  if (file) use(file);
  $('[data-save]', d.el).onclick = async e => {
    const btn = e.currentTarget, v = formValues(form);
    if (!v.name) return toast('Write the sponsor\'s name.', 'err');
    const sponsor = { name: v.name, link: v.link, tier: v.tier, blurb: v.blurb, note: v.note, public: v.public };
    if (s) sponsor.id = s.id;
    if (!logo && v.logo_url !== undefined && (v.logo_url || (s && /^https:/.test(s.logo_url || '')))) sponsor.logo_url = v.logo_url;
    if (v.removeLogo) sponsor.removeLogo = true;
    busy(btn, true, logo ? 'Uploading…' : 'Saving…');
    const r = await ctx.api.post('sponsor.save', logo ? { sponsor, logo } : { sponsor });
    busy(btn, false);
    if (!r.ok) return toast(r.error, 'err');
    ctx.D.sponsors = r.sponsors; ctx.api.cache(ctx.D); saved = true;
    toast(s ? 'Saved.' : `${r.sponsor.name} added${r.sponsor.public ? ' — on the public page now' : ''}.`);
    d.close(); sponsorsPage(ctx);
  };
}

/** The "sponsors" part of the city page JSON on haven.hackclub.com (SITE_DATA.md in hackclub/haven): name, image, href. */
function hqExport(ctx) {
  const list = (ctx.D.sponsors || []).filter(s => s.public), ok = list.filter(s => /^https:\/\//.test(s.logo || '')), skipped = list.filter(s => !/^https:\/\//.test(s.logo || ''));
  const json = JSON.stringify({ sponsors: { heading: 'Our sponsors', items: ok.map(s => Object.assign({ name: s.name, image: s.logo }, safeUrl(s.link) && /^https:/.test(s.link) ? { href: s.link } : {})) } }, null, 2);
  const m = modal({ title: 'Your sponsors on haven.hackclub.com', size: 'lg', body: `<p>Your city page on <b>haven.hackclub.com</b> is built from one JSON document (HQ's guide: <a href="https://github.com/hackclub/haven/blob/main/SITE_DATA.md" target="_blank" rel="noopener">SITE_DATA.md</a>). Paste this part into it — next to the other parts you already have — and the logos appear there too.</p>
    ${skipped.length ? `<div class="banner">${icon('alert')}<div>Not included (their logo isn't a public https picture): ${skipped.map(s => esc(s.name)).join(', ')}. Upload the logo again here, or paste a logo link.</div></div>` : ''}
    <textarea readonly rows="14" id="hqj" style="font-family:ui-monospace,Consolas,monospace;font-size:13px">${esc(json)}</textarea>`,
    foot: `<button class="btn ghost" data-close>Close</button><button class="btn primary" id="hqc">${icon('copy')} Copy</button>` });
  $('#hqc', m.el).onclick = () => copy(json, 'Copied — paste it into your city page document.');
}
