/* Public event page (hub link without a personal link) and the organizer sign-in page. */
import { $, esc, icon, toast, busy, fmtDay, parseLocal, bar, skeleton, safeUrl, formValues } from '../ui.js';
import { parseLink } from '../api.js';

let timer = null;
const INTERESTS = ['Design & posters', 'Social media & video', 'Schools & outreach', 'Sponsors & partners', 'Tech & website', 'Event weekend help', 'Mentoring (19+)', 'Something else'];

function dates(ev) {
  const year = String(ev.end || ev.start).slice(0, 4);
  return ev.end && ev.end !== ev.start ? `${fmtDay(ev.start)} – ${fmtDay(ev.end)} ${year}` : `${fmtDay(ev.start)} ${year}`;
}

export async function publicPage(root, ctx, opts = {}) {
  clearInterval(timer);
  root.innerHTML = `<div class="wiz">${skeleton(3)}</div>`;
  const P = await ctx.api.getPublic('public');
  if (!P.ok && P.code === 'not_ready') return notReady(root);
  if (!P.version) return signin(root, ctx, { error: P.ok === false && P.code === 'network' ? P.error : '', old: !P.code });
  const ev = P.event, L = P.links || {}, tz = P.tz;
  document.title = ev.name + ' — Hack Club Haven';
  const cta = [
    safeUrl(L.signup) && `<a class="btn accent lg" href="${esc(safeUrl(L.signup))}" target="_blank" rel="noopener">${icon('zap')} Sign up to take part</a>`,
    safeUrl(L.instagram) && `<a class="btn ghost" href="${esc(safeUrl(L.instagram))}" target="_blank" rel="noopener">Instagram</a>`,
    safeUrl(L.telegram) && `<a class="btn ghost" href="${esc(safeUrl(L.telegram))}" target="_blank" rel="noopener">Telegram</a>`,
    safeUrl(L.website) && `<a class="btn ghost" href="${esc(safeUrl(L.website))}" target="_blank" rel="noopener">Website</a>`,
    L.email && `<a class="btn ghost" href="mailto:${esc(L.email)}">${icon('mail')} ${esc(L.email)}</a>`,
  ].filter(Boolean).join('');
  let main = '';
  if (P.enabled) {
    const pr = P.progress, pct = pr && pr.total ? Math.round(100 * pr.done / pr.total) : 0;
    const left = [];
    if (pr) left.push(`<div class="card"><div class="card-h"><h3>Getting ready</h3><span class="sub">the organizing team's checklist</span></div>
      <div class="row" style="align-items:flex-end;gap:14px;margin-bottom:10px"><span class="big-pct">${pct}%</span><span class="muted" style="padding-bottom:6px">${pr.done} of ${pr.total} tasks done</span></div>${bar(pct)}
      ${pr.milestones.length ? `<ul class="mile-list" style="margin-top:12px">${pr.milestones.map(m => `<li><span class="mk ${m.done ? 'done' : ''}">${icon(m.done ? 'check' : 'flag')}</span><div><b>${esc(m.label)}</b><div class="small muted">${esc(fmtDay(m.date))}</div></div></li>`).join('')}</ul>` : ''}</div>`);
    if (P.team && P.team.length) left.push(`<div class="card"><div class="card-h"><h3>The team</h3><span class="sub">${P.team.length} teenagers making it happen</span></div><div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${P.team.map(p => `<div><b>${esc(p.name)}</b><div class="small muted">${esc(p.role || p.area || '')}</div></div>`).join('')}</div></div>`);
    left.push(`<div class="card"><div class="card-h"><h3>What is Haven?</h3></div><p>Haven is a <a href="https://hackclub.com" target="_blank" rel="noopener">Hack Club</a> programme: teen-run game jams in cities around the world, on the same weekend. You build a video game in two days and ship it for everyone to play.</p>
      <p class="muted" style="margin:0">For ages 13–18. No experience needed. <a href="https://haven.hackclub.com" target="_blank" rel="noopener">haven.hackclub.com</a></p></div>`);
    const join = P.join ? `<form class="card" id="join"><div class="card-h"><div><h3>Join the organizing team</h3><div class="sub">${esc(P.join.intro || '')}</div></div></div>
      <div class="form-grid"><div class="field"><label for="j-n">Your name <span class="req">*</span></label><input id="j-n" name="name" required maxlength="60"></div>
      <div class="field"><label for="j-c">Telegram @username or email <span class="req">*</span></label><input id="j-c" name="contact" required maxlength="80" placeholder="@username"></div></div>
      <div class="field"><span style="font-weight:800;font-size:13px;color:var(--umber)">Your age <span class="req">*</span></span><div class="radio-row"><label><input type="radio" name="age_group" value="13-18"> 13–18</label><label><input type="radio" name="age_group" value="19+"> 19 or older</label></div>
        <small class="hint" id="agehint"></small></div>
      <div class="field"><label for="j-i">I'd like to help with</label><select id="j-i" name="interest">${INTERESTS.map(i => `<option>${esc(i)}</option>`).join('')}</select></div>
      <div class="field"><label for="j-t">Anything else? (optional)</label><textarea id="j-t" name="note" maxlength="1000" rows="3" placeholder="Skills, school, when you're free…"></textarea></div>
      <div class="hp" aria-hidden="true"><label>Company <input name="company" tabindex="-1" autocomplete="off"></label></div>
      <p class="small muted">We only use this to contact you about helping. It goes to the organizers — nowhere else.</p>
      <button class="btn primary" type="submit">${icon('send')} Send</button><div id="jout" style="margin-top:10px"></div></form>` : '';
    main = `<div class="grid-2" style="align-items:start"><div class="stack">${left.join('')}</div><div class="stack">${join || ''}
      <div class="card"><h3 style="margin-bottom:6px">Organizer?</h3><p class="muted">Open the personal link your lead sent you, or sign in here.</p><a class="btn ghost" href="#/signin">${icon('user')} Organizer sign-in</a></div></div></div>`;
  } else {
    main = `<div class="card" style="max-width:560px;margin:0 auto"><h3>Organizer?</h3><p class="muted">This is the ${esc(ev.name)} team hub. Open your personal link, or sign in.</p><a class="btn primary" href="#/signin">Organizer sign-in</a></div>`;
  }
  root.innerHTML = `<div class="pub"><header class="hero"><div class="hero-in">
      <div class="hero-top"><img src="assets/logo-white.png" alt="Hack Club Haven" width="132" height="84"><a class="btn ghost sm" href="#/signin">${icon('user')} Organizers</a></div>
      <h1>${esc(ev.name)}</h1>
      <div class="when">${icon('calendar')} ${esc(dates(ev))}${ev.city ? ` <span>· ${esc(ev.city)}</span>` : ''}</div>
      ${ev.tagline ? `<p class="tagline">${esc(ev.tagline)}</p>` : ''}
      <div class="countdown" id="cd" aria-live="off"></div>
      <div class="row">${cta}</div></div></header>
    <main class="pub-main">${main}</main>
    <footer class="pub-foot">${esc(ev.name)} is part of <a href="https://haven.hackclub.com" target="_blank" rel="noopener">Hack Club Haven</a> · team hub by <a href="${esc(ctx.cfg.repo || '#')}" target="_blank" rel="noopener">Haven Hub</a></footer></div>`;
  const start = parseLocal(ev.start + ' 09:00', tz), end = parseLocal((ev.end || ev.start) + ' 23:59', tz);
  const tick = () => {
    const el = $('#cd'); if (!el) return clearInterval(timer);
    const ms = start - Date.now();
    if (ms <= 0) { el.innerHTML = Date.now() < end ? `<div><b>Live</b><span>happening now</span></div>` : ''; return; }
    const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    el.innerHTML = `<div><b>${d}</b><span>days</span></div><div><b>${h}</b><span>hours</span></div><div><b>${m}</b><span>minutes</span></div>`;
  };
  tick(); timer = setInterval(tick, 30e3);
  const jf = $('#join');
  if (jf) {
    jf.addEventListener('change', e => { if (e.target.name === 'age_group') $('#agehint').textContent = e.target.value === '19+' ? 'Hack Club rule: people 19+ can\'t organize or take part — but you can help as a mentor or volunteer. Send it anyway!' : ''; });
    jf.onsubmit = async e => {
      e.preventDefault();
      const v = formValues(jf), b = jf.querySelector('[type=submit]');
      if (!v.age_group) return toast('Choose your age group.', 'err');
      busy(b, true, 'Sending…');
      const r = await ctx.api.postPublic('apply', v);
      busy(b, false);
      if (!r.ok) return toast(r.error, 'err');
      jf.innerHTML = `<div style="text-align:center"><img src="assets/daven.png" alt="" width="120" height="82"><h3>Thank you!</h3><p class="muted">${esc(r.message)}</p></div>`;
    };
  }
  if (opts.join && jf) jf.scrollIntoView();
}

function notReady(root) {
  root.innerHTML = `<div class="wiz"><div class="card" style="text-align:center"><img src="assets/daven-sketch.png" alt="" width="120"><h2>This hub isn't set up yet</h2>
    <p class="muted">If it's yours, finish the setup — it takes a few minutes.</p><a class="btn primary" href="#/setup">Continue the setup</a></div></div>`;
}

export function signin(root, ctx, opts = {}) {
  clearInterval(timer);
  document.title = 'Sign in — Haven Hub';
  root.innerHTML = `<div class="wiz" style="max-width:520px"><div class="wiz-top"><a href="#/"><img src="assets/logo-orange.png" alt="Hack Club Haven" width="96" height="61"></a><h1 style="font-size:26px">Organizer sign-in</h1></div>
    ${opts.error ? `<div class="banner bad">${icon('alert')}<div>${esc(opts.error)}</div></div>` : ''}
    ${opts.old ? `<div class="banner info">${icon('zap')}<div>This hub is being upgraded. Personal links keep working — open yours again in a few minutes.</div></div>` : ''}
    <form class="card" id="si1"><h3 style="margin-bottom:6px">Open your personal link</h3><p class="muted small">Your lead sent it by Telegram or email. It contains <code>&amp;t=</code>. Paste it here:</p>
      <div class="linkbox"><input name="link" placeholder="https://…?hub=…&u=…&t=…" aria-label="Your personal link"><button class="btn primary" type="submit">Open</button></div></form>
    ${ctx.api.hub() ? `<form class="card" id="si2"><h3 style="margin-bottom:6px">Lost it? Email me my link</h3><p class="muted small">Works if your email is saved on the team.</p>
      <div class="linkbox"><input name="email" type="email" required placeholder="you@example.com" aria-label="Your email"><button class="btn soft" type="submit">Send</button></div><p class="small" id="si2o" style="margin:8px 0 0"></p></form>` : ''}
    <p class="small muted" style="text-align:center">${ctx.api.hub() ? '<a href="#/">← Back to the event page</a>' : '<a href="#/">← Haven Hub home</a>'}</p></div>`;
  $('#si1').onsubmit = e => {
    e.preventDefault();
    const p = parseLink(e.target.link.value);
    if (!p) return toast('That isn\'t a personal link — it should contain &t=…', 'err');
    const hub = p.hub || ctx.api.hub();
    if (!hub) return toast('That link is missing ?hub=… — ask for a fresh link.', 'err');
    location.href = location.pathname + '?hub=' + encodeURIComponent(hub) + '&u=' + encodeURIComponent(p.u) + '&t=' + encodeURIComponent(p.t);
  };
  const f2 = $('#si2');
  if (f2) f2.onsubmit = async e => {
    e.preventDefault(); const b = f2.querySelector('button'); busy(b, true, 'Sending…');
    const r = await ctx.api.postPublic('requestLink', { email: f2.email.value.trim() }); busy(b, false);
    $('#si2o').textContent = r.message || r.error || '';
  };
}
