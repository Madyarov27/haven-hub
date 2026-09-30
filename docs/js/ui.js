/* Haven Hub — small UI kit: escaping, icons, toasts, drawer, modal, dates, CSV. No dependencies. */

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Only http(s), mailto and tg links ever reach an href. */
export const safeUrl = u => { u = String(u || '').trim(); return /^(https?:\/\/|mailto:|tg:\/\/)/i.test(u) ? u : ''; };
export const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
export const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
export const first = name => String(name || '').split(' ')[0];
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  json(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
};

// ------------------------------------------------------------------ icons (Feather-style, stroke)
const I = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  check: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r=".6"/><circle cx="3.5" cy="12" r=".6"/><circle cx="3.5" cy="18" r=".6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  more: '<circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/><circle cx="5" cy="12" r="1.2"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  chevron: '<polyline points="6 9 12 15 18 9"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  up: '<polyline points="18 15 12 9 6 15"/>',
  down: '<polyline points="6 9 12 15 18 9"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
};
export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${I[name] || ''}</svg>`;

// ------------------------------------------------------------------ toasts
export function toast(msg, kind) {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || 'ok'); el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  el.innerHTML = `${icon(kind === 'err' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, kind === 'err' ? 6000 : 2800);
}
export async function copy(text, label) {
  try { await navigator.clipboard.writeText(text); toast(label || 'Copied.'); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* ignore */ } ta.remove();
    toast(ok ? (label || 'Copied.') : 'Could not copy — select the text and press Ctrl+C.', ok ? 'ok' : 'err'); return ok;
  }
}
export function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ------------------------------------------------------------------ overlays: drawer + modal
let openLayers = 0;
export const layerOpen = () => openLayers > 0;
function trapFocus(panel, e) {
  if (e.key !== 'Tab') return;
  const f = $$('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', panel).filter(x => x.offsetParent !== null);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
}
function layer(kind, html, onClose) {
  const prev = document.activeElement, wrap = document.createElement('div');
  wrap.className = 'layer ' + kind; wrap.innerHTML = `<div class="scrim" data-close></div>${html}`;
  document.body.appendChild(wrap); openLayers++; document.body.classList.add('noscroll');
  const panel = wrap.querySelector('.panel');
  requestAnimationFrame(() => wrap.classList.add('in'));
  let closed = false;
  const close = (v) => {
    if (closed) return; closed = true; openLayers--; if (!openLayers) document.body.classList.remove('noscroll');
    wrap.classList.remove('in'); setTimeout(() => wrap.remove(), 200); document.removeEventListener('keydown', onKey);
    if (prev && prev.focus) prev.focus(); if (onClose) onClose(v);
    document.dispatchEvent(new CustomEvent('hh:layerclose'));
  };
  const onKey = e => { if (e.key === 'Escape' && wrap === [...document.querySelectorAll('.layer')].pop()) close(); else trapFocus(panel, e); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  setTimeout(() => { const f = panel.querySelector('[autofocus]') || panel.querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea,button'); if (f) f.focus(); }, 60);
  return { el: panel, wrap, close };
}
/** Right-hand drawer (full screen on phones). */
export function drawer({ title, sub, body, foot, wide, onClose }) {
  const d = layer('drawer', `<aside class="panel ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="panel-h"><div><h2>${esc(title)}</h2>${sub ? `<p class="muted">${sub}</p>` : ''}</div><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
    <div class="panel-b">${body || ''}</div>${foot ? `<footer class="panel-f">${foot}</footer>` : ''}</aside>`, onClose);
  d.body = d.el.querySelector('.panel-b'); d.foot = d.el.querySelector('.panel-f');
  return d;
}
export function modal({ title, body, foot, onClose, size }) {
  const m = layer('modal', `<div class="panel ${size || ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="panel-h"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
    <div class="panel-b">${body || ''}</div>${foot ? `<footer class="panel-f">${foot}</footer>` : ''}</div>`, onClose);
  m.body = m.el.querySelector('.panel-b');
  return m;
}
/** Resolves true/false (or the form values when `body` contains inputs). */
export function confirmBox({ title, text, ok = 'OK', danger, body }) {
  return new Promise(res => {
    let val = false;
    const m = modal({ title, body: (text ? `<p>${text}</p>` : '') + (body || ''), size: 'sm',
      foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>`,
      onClose: () => res(val) });
    m.el.querySelector('[data-ok]').onclick = () => { val = body ? formValues(m.el) : true; m.close(); };
  });
}

// ------------------------------------------------------------------ forms
export function field({ label, name, type = 'text', value = '', hint, options, required, placeholder, attrs = '', full }) {
  const id = 'f-' + name + '-' + Math.random().toString(36).slice(2, 7);
  let input;
  if (type === 'textarea') input = `<textarea id="${id}" name="${name}" placeholder="${esc(placeholder || '')}" ${required ? 'required' : ''} ${attrs}>${esc(value)}</textarea>`;
  else if (type === 'select') input = `<select id="${id}" name="${name}" ${attrs}>${(options || []).map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  else if (type === 'toggle') return `<label class="toggle ${full ? 'full' : ''}"><input type="checkbox" name="${name}" ${value === true || value === 'yes' ? 'checked' : ''} ${attrs}><span class="track"><span></span></span><span class="toggle-l"><b>${esc(label)}</b>${hint ? `<small>${hint}</small>` : ''}</span></label>`;
  else input = `<input id="${id}" name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder || '')}" ${required ? 'required' : ''} ${attrs}>`;
  return `<div class="field ${full ? 'full' : ''}"><label for="${id}">${esc(label)}${required ? ' <span class="req">*</span>' : ''}</label>${input}${hint ? `<small class="hint">${hint}</small>` : ''}</div>`;
}
export function formValues(el) {
  const o = {};
  $$('input[name],select[name],textarea[name]', el).forEach(i => {
    if (i.type === 'checkbox') { if (i.dataset.multi) { (o[i.name] = o[i.name] || []); if (i.checked) o[i.name].push(i.value); } else o[i.name] = i.checked; }
    else if (i.type === 'radio') { if (i.checked) o[i.name] = i.value; }
    else if (i.type !== 'file') o[i.name] = i.value.trim();
  });
  return o;
}
export function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${esc(label || 'Saving…')}`; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}

// ------------------------------------------------------------------ small components
const AV = ['#E87136', '#783D2B', '#A8A237', '#C4541B', '#8A6A1F', '#2F7D8C', '#B8C11F', '#DFA063'];
export const initials = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
export function avatar(name, size) {
  let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `<span class="av ${size || ''}" style="background:${AV[h % AV.length]}" aria-hidden="true">${esc(initials(name))}</span>`;
}
const PILL = { 'Not started': 'ns', 'In progress': 'ip', Blocked: 'bl', Done: 'dn', Dropped: 'dr' };
export const pill = s => `<span class="pill ${PILL[s] || 'ns'}">${esc(s || 'Not started')}</span>`;
export const reviewPill = t => t.review === 'approved' ? `<span class="pill ok" title="Approved by ${esc(t.reviewed_by)}">${icon('check')} Approved</span>` : t.review === 'redo' ? '<span class="pill warn">Redo asked</span>' : '';
export function empty({ title, text, img = 'daven', action }) {
  return `<div class="empty"><img src="assets/${img}.png" alt="" width="120" height="82" loading="lazy"><h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${action || ''}</div>`;
}
export function kpi(label, value, { tone, sub, icon: ic } = {}) {
  return `<div class="kpi ${tone || ''}">${ic ? `<span class="kpi-ic">${icon(ic)}</span>` : ''}<div><b>${esc(value)}</b><span>${esc(label)}</span>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
}
export const bar = (pct, tone) => `<div class="bar ${tone || ''}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
export const skeleton = (n = 3) => `<div class="skel-wrap">${'<div class="skel"></div>'.repeat(n)}</div>`;

// ------------------------------------------------------------------ time (all deadlines are "YYYY-MM-DD HH:MM" in the hub's time zone)
export const DAY = 864e5;
function offsetMin(tz, date) {
  try {
    const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date).forEach(x => { p[x.type] = x.value; });
    return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(date.getTime() / 1000) * 1000) / 60000;
  } catch (e) { return 0; }
}
/** Epoch ms of a local "YYYY-MM-DD[ HH:MM]" in time zone tz. */
export function parseLocal(s, tz) {
  const m = String(s || '').match(/^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d))?/);
  if (!m) return NaN;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  const o1 = offsetMin(tz, new Date(guess)), t = guess - o1 * 6e4, o2 = offsetMin(tz, new Date(t));
  return o2 === o1 ? t : guess - o2 * 6e4;
}
/** "YYYY-MM-DD HH:MM" for a moment, in time zone tz. */
export function localStr(ms, tz) {
  try { return new Date(ms).toLocaleString('sv-SE', { timeZone: tz, hour12: false }).slice(0, 16).replace('T', ' '); } catch (e) { return new Date(ms).toISOString().slice(0, 16).replace('T', ' '); }
}
export const fmtDay = (ymd, opts) => { const d = new Date(String(ymd).slice(0, 10) + 'T12:00:00Z'); return isNaN(d) ? String(ymd || '') : d.toLocaleDateString('en-GB', Object.assign({ weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }, opts)); };
export const fmtDue = due => due ? fmtDay(due) + (String(due).length > 10 ? ', ' + String(due).slice(11, 16) : '') : '—';
export function dueInfo(t, tz) {
  const d = parseLocal(t.due, tz), diff = d - Date.now();
  if (isNaN(d)) return { cls: 'over', label: 'No valid deadline', over: false, soon: false };
  const f = fmtDue(t.due);
  if (t.status === 'Done' || t.status === 'Dropped') return { cls: '', label: f, over: false, soon: false };
  if (diff < 0) { const n = Math.ceil(-diff / DAY); return { cls: 'over', label: `Overdue${n > 1 ? ' by ' + n + ' days' : ''}`, date: f, over: true, soon: false }; }
  if (diff < DAY) return { cls: 'soon', label: `Due in ${Math.max(1, Math.round(diff / 36e5))} h`, date: f, over: false, soon: true };
  if (diff < 3 * DAY) return { cls: 'soon', label: `Due in ${Math.ceil(diff / DAY)} days`, date: f, over: false, soon: true };
  return { cls: '', label: f, over: false, soon: false, week: diff < 7 * DAY };
}
export function daysTo(ymd, tz) { const t = parseLocal(ymd, tz); return isNaN(t) ? null : Math.ceil((t - Date.now()) / DAY); }
export function ago(s, tz) {
  if (!s) return 'never';
  const m = Math.round((Date.now() - parseLocal(s, tz)) / 6e4);
  if (isNaN(m)) return s; if (m < 2) return 'just now'; if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
  const d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + ' days ago';
}
export const zones = () => { try { return Intl.supportedValuesOf('timeZone'); } catch (e) { return ['UTC', 'Europe/London', 'Europe/Berlin', 'Asia/Tashkent', 'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles']; } };
export const browserTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } };

// ------------------------------------------------------------------ CSV
export function csvParse(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}
export const csvBuild = rows => '﻿' + rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
