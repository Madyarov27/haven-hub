/* First-run wizard: copy the Sheet → deploy → paste the URL → prove it's your Sheet → name the event → dashboard. */
import { $, esc, icon, toast, busy, field, formValues, copy, store, zones, browserTz } from '../ui.js';
import { hubFrom, getFrom, postTo, DEMO, DEMO_HUB, SELF, demoSheetUrl, siteUrl } from '../api.js';

const STEPS = ['Copy', 'Deploy', 'Prove', 'Event', 'Create'];
const RAW = 'https://raw.githubusercontent.com/notazizelse/haven-hub/main/apps-script/Code.gs';
let st = null;

export function setup(root, ctx) {
  st = st || Object.assign({ step: 1, url: '', hub: '', sheet: '', ev: { name: '', city: '', start: '2026-11-14', end: '2026-11-15', timezone: browserTz(), signup: '' }, name: '', role: 'Lead organizer', email: '', starter: true, publicPage: true, joinForm: true, done: null }, store.json('hh:wiz', {}));
  if (DEMO) { st.url = st.url || 'https://script.google.com/macros/s/' + DEMO_HUB + '/exec'; st.sheet = st.sheet || demoSheetUrl(); }
  if (SELF) { st.hub = 'self'; if (st.step < 3) st.step = 3; }
  document.title = 'Set up Haven Hub';
  const save = () => { const c = Object.assign({}, st); delete c.done; store.set('hh:wiz', JSON.stringify(c)); };
  const go = n => { st.step = n; save(); setup(root, ctx); window.scrollTo(0, 0); };
  const repo = ctx.cfg.repo || '#', tpl = ctx.cfg.templateSheet;
  let body = '';
  if (st.done) return success(root, ctx);
  if (st.step === 1) body = `<h2>1. Make your own copy of the Google Sheet</h2><p class="muted">Use a Google account you'll keep after the event — the Sheet is your database, and the hub runs as you.</p>
    ${tpl ? `<div class="card" style="background:#FFFCF8"><ol class="how"><li>Press the button. Google asks <b>“Make a copy?”</b> → <b>Make a copy</b>.</li><li>Keep that new tab open — you need it in the next step.</li></ol><a class="btn accent lg" href="${esc(tpl)}" target="_blank" rel="noopener">${icon('copy')} Copy the template Sheet</a></div>
      <details style="margin-top:12px"><summary class="small"><b>No template? Do it by hand (2 more minutes)</b></summary>${manual()}</details>` : manual()}
    <div class="row" style="margin-top:16px"><button class="btn primary" id="next1" type="button">I have my copy — next</button></div>`;
  if (st.step === 2) body = `<h2>2. Deploy it as a web app</h2><p class="muted">This turns your Sheet into the hub's server. You do it once.</p>
    <ol class="how"><li>In your Sheet: <b>Extensions → Apps Script</b>.</li><li>Top right: <b>Deploy → New deployment</b>.</li><li>Click the ⚙ gear next to “Select type” → <b>Web app</b>.</li>
      <li><b>Execute as: Me</b>. <b>Who has access: Anyone</b>. → <b>Deploy</b>.</li>
      <li><b>Authorize access</b> → pick your account. Google warns <i>“Google hasn't verified this app”</i> — that's normal for your own script: <b>Advanced → Go to … (unsafe) → Allow</b>.</li>
      <li>Copy the <b>Web app URL</b> (it ends in <code>/exec</code>) and paste it here.</li></ol>
    <div class="banner info">${icon('eye')}<div class="small">“Anyone” means anyone can <i>reach</i> the hub — it still only answers to people with a personal link, and only shows what your public-page settings allow.</div></div>
    <form id="f2">${field({ label: 'Web app URL', name: 'url', value: st.url, required: true, placeholder: 'https://script.google.com/macros/s/AKfy…/exec' })}<div id="ping"></div>
    <div class="row"><button class="btn ghost" type="button" data-back>Back</button><button class="btn primary" type="submit">Check & continue</button></div></form>`;
  if (st.step === 3 && SELF) body = `<h2>1. Prove it's your server</h2><p class="muted">On the server, run <code>hubctl setup-code</code> and paste the code here. It works once, for 2 hours — so nobody else can claim your hub.</p>
    <form id="f3">${field({ label: 'Setup code', name: 'sheet', value: '', required: true, placeholder: 'from: hubctl setup-code', attrs: 'autocomplete="off"' })}
    <div class="row"><button class="btn primary" type="submit">Continue</button></div></form>`;
  else if (st.step === 3) body = `<h2>3. Prove it's your Sheet</h2><p class="muted">Paste the address of your Google Sheet (from the browser's address bar). The hub checks it's the same Sheet it runs on — so nobody else can claim your hub.</p>
    <form id="f3">${field({ label: 'Your Google Sheet address', name: 'sheet', value: st.sheet, required: true, placeholder: 'https://docs.google.com/spreadsheets/d/…/edit' })}
    <div class="row"><button class="btn ghost" type="button" data-back>Back</button><button class="btn primary" type="submit">Continue</button></div></form>`;
  if (st.step === 4) {
    const tz = zones(); if (!tz.includes(st.ev.timezone)) tz.unshift(st.ev.timezone);
    body = `<h2>${SELF ? 2 : 4}. Your event and you</h2><p class="muted">You can change all of this later in Settings.</p>
    <form id="f4"><div class="form-grid">
      ${field({ label: 'City', name: 'city', value: st.ev.city, required: true, placeholder: 'Springfield' })}
      ${field({ label: 'Event name', name: 'evname', value: st.ev.name, required: true, placeholder: 'Haven Springfield' })}
      ${field({ label: 'First day', name: 'start', type: 'date', value: st.ev.start, required: true })}
      ${field({ label: 'Last day', name: 'end', type: 'date', value: st.ev.end, required: true })}
      ${field({ label: 'Time zone', name: 'timezone', type: 'select', value: st.ev.timezone, options: tz, full: true, hint: 'Deadlines and reminders use it.' })}
      ${field({ label: 'Participant signup link (optional)', name: 'signup', type: 'url', value: st.ev.signup, full: true, placeholder: 'https://haven.hackclub.com/yourcity', hint: 'Your city\'s page on HQ\'s site — the public page links to it.' })}
      ${field({ label: 'Your name', name: 'name', value: st.name, required: true })}
      ${field({ label: 'Your role', name: 'role', value: st.role })}
      ${field({ label: 'Your email (optional)', name: 'email', type: 'email', value: st.email, full: true, hint: 'We email your admin link to you — handy if you lose it.' })}
    </div><div class="row"><button class="btn ghost" type="button" data-back>Back</button><button class="btn primary" type="submit">Continue</button></div></form>`;
  }
  if (st.step === 5) body = `<h2>${SELF ? 3 : 5}. Last choices</h2>
    <form id="f5">${field({ label: 'Add the Haven starter checklist', name: 'starter', type: 'toggle', value: st.starter, hint: '13 tasks (venue in writing, adults, parent guide, budget to HQ, ship check…), team rules and milestones — all assigned to you, with dates counted back from the event. Edit or delete freely.' })}
      ${field({ label: 'Public event page', name: 'publicPage', type: 'toggle', value: st.publicPage, hint: 'Your hub link shows a countdown, your signup link and progress. Team names stay hidden unless you turn them on.' })}
      ${field({ label: '“Join the team” form', name: 'joinForm', type: 'toggle', value: st.joinForm, hint: 'On the public page. Answers land in Dashboard → Applications.' })}
      <div class="card" style="background:#FFFCF8"><b>${esc(st.ev.name)}</b> · ${esc(st.ev.city)} · ${esc(st.ev.start)} → ${esc(st.ev.end)} · ${esc(st.ev.timezone)}<br><span class="muted small">Admin: ${esc(st.name)}${st.email ? ' · ' + esc(st.email) : ''}</span></div>
      <div id="cerr"></div><div class="row"><button class="btn ghost" type="button" data-back>Back</button><button class="btn accent lg" type="submit">${icon('zap')} Create my hub</button></div></form>`;

  root.innerHTML = `<div class="wiz"><div class="wiz-top"><a href="#/"><img src="assets/logo-orange.png" alt="Hack Club Haven" width="96" height="61"></a><div><h1 style="font-size:26px">Set up your Haven Hub</h1><div class="muted small">About 10 minutes · free · <a href="${esc(repo)}/blob/main/setup.md" target="_blank" rel="noopener">full guide</a></div></div></div>
    <div class="stepper">${STEPS.map((s, i) => [s, i]).filter(([, i]) => !SELF || i >= 2).map(([s, i], n) => `<span class="${i + 1 === st.step ? 'on' : i + 1 < st.step ? 'done' : ''}">${SELF ? n + 1 : i + 1}. ${SELF && s === 'Prove' ? 'Code' : s}</span>`).join('')}</div>
    <div class="card">${body}</div>${DEMO ? '<p class="small muted">Demo: the URL and Sheet are pre-filled; nothing leaves your browser.</p>' : ''}</div>`;
  root.querySelectorAll('[data-back]').forEach(b => { b.onclick = () => go(st.step - 1); });
  const n1 = $('#next1'); if (n1) n1.onclick = () => go(2);
  const cc = $('#copycode');
  if (cc) cc.onclick = async e => { const btn = e.currentTarget;
    busy(btn, true, 'Fetching…');
    try { const code = await (await fetch(DEMO ? '../apps-script/Code.gs' : RAW, { cache: 'no-store' })).text(); await copy(code, 'Code copied — paste it into Apps Script.'); }
    catch (err) { toast('Could not fetch it — open the file and copy it by hand.', 'err'); }
    busy(btn, false);
  };
  const f2 = $('#f2');
  if (f2) f2.onsubmit = async e => {
    e.preventDefault();
    const url = f2.url.value.trim(), hub = DEMO ? DEMO_HUB : hubFrom(url), out = $('#ping'), b = f2.querySelector('[type=submit]');
    st.url = url; save();
    if (!hub) { out.innerHTML = `<p class="errline">That isn't a web-app URL. It looks like https://script.google.com/macros/s/AKfy…/exec</p>`; return; }
    busy(b, true, 'Checking…');
    const r = await getFrom(hub, 'ping');
    busy(b, false);
    if (!r.ok || !r.version) { out.innerHTML = `<p class="errline">${r.version === undefined && r.ok === false && !r.code ? 'The hub answered, but it runs old code. Paste the latest Code.gs, then Deploy → Manage deployments → New version.' : esc(r.error || 'No answer from that URL.')}</p><p class="small muted">Check: Who has access = <b>Anyone</b>, and you copied the <b>/exec</b> URL (not the /dev one).</p>`; return; }
    if (r.ready) { out.innerHTML = `<div class="banner">${icon('alert')}<div>This hub is already set up${r.event ? ' for <b>' + esc(r.event.name) + '</b>' : ''}. Open your admin link — or in the Sheet use <b>Haven Hub → Show admin links</b>.</div></div>`; return; }
    st.hub = hub; out.innerHTML = `<p class="okline">${icon('check')} Connected — backend v${esc(r.version)}</p>`; save(); setTimeout(() => go(3), 500);
  };
  const f3 = $('#f3');
  if (f3) f3.onsubmit = e => { e.preventDefault(); const v = f3.sheet.value.trim(); if (!SELF && !/docs\.google\.com\/spreadsheets\/d\/[\w-]{20,}/.test(v)) return toast('Paste the full Sheet address — it contains /spreadsheets/d/…', 'err'); st.sheet = v; go(4); };
  const f4 = $('#f4');
  if (f4) {
    f4.city.oninput = () => { const c = f4.city.value.trim(); if (!f4.evname.dataset.touched) f4.evname.value = c ? 'Haven ' + c : ''; if (!f4.signup.dataset.touched) f4.signup.value = c ? 'https://haven.hackclub.com/' + c.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '') : ''; };
    f4.evname.oninput = () => { f4.evname.dataset.touched = 1; }; f4.signup.oninput = () => { f4.signup.dataset.touched = 1; };
    if (st.ev.name) f4.evname.dataset.touched = 1; if (st.ev.signup) f4.signup.dataset.touched = 1;
    f4.onsubmit = e => {
      e.preventDefault(); const v = formValues(f4);
      if (v.end < v.start) return toast('The last day can\'t be before the first day.', 'err');
      st.ev = { name: v.evname, city: v.city, start: v.start, end: v.end, timezone: v.timezone, signup: v.signup }; st.name = v.name; st.role = v.role; st.email = v.email; go(5);
    };
  }
  const f5 = $('#f5');
  if (f5) f5.onsubmit = async e => {
    e.preventDefault(); const v = formValues(f5), b = f5.querySelector('[type=submit]');
    Object.assign(st, { starter: v.starter, publicPage: v.publicPage, joinForm: v.joinForm }); save();
    busy(b, true, 'Creating your hub…');
    const r = await postTo(st.hub, 'setup', { sheet: st.sheet, hub: st.hub, site: siteUrl(), name: st.name, role: st.role, email: st.email, event: st.ev, starter: st.starter, publicPage: st.publicPage, joinForm: st.joinForm });
    busy(b, false);
    if (!r.ok) { $('#cerr').innerHTML = `<div class="banner bad">${icon('alert')}<div>${esc(r.error)}${r.code === 'proof' ? ' <a href="#" id="back3">Fix the Sheet address</a>' : ''}</div></div>`; const b3 = $('#back3'); if (b3) b3.onclick = ev => { ev.preventDefault(); go(3); }; return; }
    store.set('hh:s:' + st.hub, JSON.stringify({ u: r.key, t: r.token })); store.set('hh:last', st.hub);
    if (DEMO) ctx.api.setSession({ u: r.key, t: r.token });
    st.done = r; store.del('hh:wiz'); setup(root, ctx);
  };
}

function manual() {
  return `<ol class="how" style="margin-top:12px"><li>Open <a href="https://sheets.new" target="_blank" rel="noopener">sheets.new</a> and name the Sheet, e.g. “Haven Springfield — Team Hub”.</li>
    <li><b>Extensions → Apps Script</b>. Delete what's in <code>Code.gs</code>.</li>
    <li>Paste the hub's code: <button class="btn soft sm" id="copycode" type="button">${icon('copy')} Copy Code.gs</button> or <a href="${RAW}" target="_blank" rel="noopener">open it</a> and copy everything.</li>
    <li>Press <b>Save</b> (Ctrl+S).</li></ol>`;
}

function success(root, ctx) {
  const r = st.done, open = DEMO || SELF ? '#/admin' : `?hub=${encodeURIComponent(st.hub)}#/admin`;
  root.innerHTML = `<div class="wiz"><div class="card" style="text-align:center;padding:28px 22px"><img src="assets/daven.png" alt="" width="150" height="103"><h1 style="font-size:30px;margin:8px 0">Your hub is ready!</h1>
    <p class="muted">This is <b>your admin link</b>. It is your key to the hub — bookmark it and don't share it.${r.emailed ? ' We also emailed it to you.' : ''}</p>
    <div class="linkbox" style="max-width:560px;margin:0 auto 14px"><input readonly value="${esc(r.link)}" aria-label="Admin link"><button class="btn soft" id="cl">${icon('copy')} Copy</button></div>
    ${r.warning ? `<div class="banner" style="text-align:left">${icon('alert')}<div>${esc(r.warning)}</div></div>` : ''}
    <a class="btn accent lg" href="${esc(open)}">Open my dashboard ${icon('external')}</a></div>
    <div class="card"><h3 style="margin-bottom:10px">Next steps</h3><ol class="how">
      <li><b>Add your team</b> — Dashboard → People → Add organizer. Each person gets a personal link.</li>
      <li><b>Reminders</b> — they're on (email). For Telegram: Settings → Telegram bot (optional, 3 minutes).</li>
      <li><b>Share your public page</b> — Settings → Public page → copy the link for your bio and posters.</li>
      <li>Lost your link? In your Sheet: <b>Haven Hub → Show admin links</b>.</li></ol></div></div>`;
  $('#cl').onclick = () => copy(r.link, 'Admin link copied.');
  st = null;
}
