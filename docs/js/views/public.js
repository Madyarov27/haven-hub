/* Public event page (hub link without a personal link), the organizer sign-in page and the "choose a new password" page. */
import { $, esc, icon, toast, busy, fmtDay, parseLocal, bar, skeleton, safeUrl, safeImg, formValues, googleG } from '../ui.js';
import { parseLink, googleClient } from '../api.js';
import { googleStart } from '../google.js';

let timer = null;
const INTERESTS = ['Design & posters', 'Social media & video', 'Schools & outreach', 'Sponsors & partners', 'Tech & website', 'Event weekend help', 'Mentoring (19+)', 'Something else'];

function dates(ev) {
  const year = String(ev.end || ev.start).slice(0, 4);
  return ev.end && ev.end !== ev.start ? `${fmtDay(ev.start)} – ${fmtDay(ev.end)} ${year}` : `${fmtDay(ev.start)} ${year}`;
}
/** "Supported by": one grid of logo tiles in the admin's order, each saying what kind of help it is and linking to the sponsor. */
export function sponsorWall(list) {
  if (!list || !list.length) return '';
  return `<div class="sp-wall">${list.map(sp => {
    const href = safeUrl(sp.link), logo = safeImg(sp.logo);
    const inner = `${sp.tier ? `<span class="sp-tier">${esc(sp.tier)}</span>` : ''}<span class="sp-logo">${logo ? `<img src="${esc(logo)}" alt="${esc(sp.name)}" loading="lazy" referrerpolicy="no-referrer">` : `<b>${esc(sp.name)}</b>`}</span><span class="sp-name">${esc(sp.name)}</span>${sp.blurb ? `<span class="sp-blurb">${esc(sp.blurb)}</span>` : ''}`;
    return href ? `<a class="sp" href="${esc(href)}" target="_blank" rel="noopener sponsored" title="${esc(sp.name)}">${inner}</a>` : `<span class="sp" title="${esc(sp.name)}">${inner}</span>`;
  }).join('')}</div>`;
}
const gButton = (id, label) => `<button type="button" class="btn gbtn lg" id="${id}">${googleG} ${esc(label)}</button>`;
const startGoogle = (ctx, cid, purpose, back) => { if (ctx.api.DEMO) return toast('Google sign-in is switched off in the demo.', 'err'); if (!googleStart(cid, purpose, { back })) toast('Your browser blocked this — allow cookies/storage for this site and try again.', 'err'); };

export async function publicPage(root, ctx, opts = {}) {
  clearInterval(timer);
  root.innerHTML = `<div class="wiz">${skeleton(3)}</div>`;
  const P = await ctx.api.getPublic('public');
  if (!P.ok && P.code === 'not_ready') return notReady(root);
  if (!P.version) return signin(root, ctx, { error: P.ok === false && P.code === 'network' ? P.error : '', old: !P.code });
  const ev = P.event, L = P.links || {}, tz = P.tz, cid = googleClient(P), g = ctx.google;
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
    if (P.sponsors && P.sponsors.length) left.push(`<div class="card sp-card"><div class="card-h"><h3>Supported by</h3><span class="sub">thank you for making ${esc(ev.name)} possible</span></div>${sponsorWall(P.sponsors)}</div>`);
    if (pr) left.push(`<div class="card"><div class="card-h"><h3>Getting ready</h3><span class="sub">the organizing team's checklist</span></div>
      <div class="row" style="align-items:flex-end;gap:14px;margin-bottom:10px"><span class="big-pct">${pct}%</span><span class="muted" style="padding-bottom:6px">${pr.done} of ${pr.total} tasks done</span></div>${bar(pct)}
      ${pr.milestones.length ? `<ul class="mile-list" style="margin-top:12px">${pr.milestones.map(m => `<li><span class="mk ${m.done ? 'done' : ''}">${icon(m.done ? 'check' : 'flag')}</span><div><b>${esc(m.label)}</b><div class="small muted">${esc(fmtDay(m.date))}</div></div></li>`).join('')}</ul>` : ''}</div>`);
    if (P.team && P.team.length) left.push(`<div class="card"><div class="card-h"><h3>The team</h3><span class="sub">${P.team.length} teenagers making it happen</span></div><div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${P.team.map(p => `<div><b>${esc(p.name)}</b><div class="small muted">${esc(p.role || p.area || '')}</div></div>`).join('')}</div></div>`);
    left.push(`<div class="card"><div class="card-h"><h3>What is Haven?</h3></div><p>Haven is a <a href="https://hackclub.com" target="_blank" rel="noopener">Hack Club</a> programme: teen-run game jams in cities around the world, on the same weekend. You build a video game in two days and ship it for everyone to play.</p>
      <p class="muted" style="margin:0">For ages 13–18. No experience needed. <a href="https://haven.hackclub.com" target="_blank" rel="noopener">haven.hackclub.com</a></p></div>`);
    const join = P.join ? `<form class="card" id="join"><div class="card-h"><div><h3>Join the organizing team</h3><div class="sub">${esc(P.join.intro || '')}</div></div></div>
      ${g && g.ticket ? `<div class="banner info">${icon('check')}<div>Google confirmed it's you: <b>${esc(g.name || '')}</b>${g.email ? ' · ' + esc(g.email) : ''}. Fill in the rest and press Send. <button type="button" class="linkbtn" id="g-forget">Not you?</button></div></div>`
        : cid ? `<div class="g-row">${gButton('g-join', 'Sign up with Google')}<span class="small muted">fills in your name and email — or type them below</span></div>` : ''}
      <div class="form-grid"><div class="field"><label for="j-n">Your name <span class="req">*</span></label><input id="j-n" name="name" required maxlength="60" value="${esc(g && g.name || '')}"></div>
      <div class="field"><label for="j-c">Telegram @username${g && g.email ? ' (optional)' : ' or email'} ${g && g.email ? '' : '<span class="req">*</span>'}</label><input id="j-c" name="contact" ${g && g.email ? '' : 'required'} maxlength="80" placeholder="@username"></div></div>
      <div class="field"><span style="font-weight:800;font-size:13px;color:var(--umber)">Your age <span class="req">*</span></span><div class="radio-row"><label><input type="radio" name="age_group" value="13-18"> 13–18</label><label><input type="radio" name="age_group" value="19+"> 19 or older</label></div>
        <small class="hint" id="agehint"></small></div>
      <div class="field"><label for="j-i">I'd like to help with</label><select id="j-i" name="interest">${INTERESTS.map(i => `<option>${esc(i)}</option>`).join('')}</select></div>
      <div class="field"><label for="j-t">Anything else? (optional)</label><textarea id="j-t" name="note" maxlength="1000" rows="3" placeholder="Skills, school, when you're free…"></textarea></div>
      <div class="hp" aria-hidden="true"><label>Company <input name="company" tabindex="-1" autocomplete="off"></label></div>
      <p class="small muted">We only use this to contact you about helping. It goes to the organizers — nowhere else.</p>
      <button class="btn primary" type="submit">${icon('send')} Send</button><div id="jout" style="margin-top:10px"></div></form>` : '';
    main = `<div class="grid-2" style="align-items:start"><div class="stack">${left.join('')}</div><div class="stack">${join || ''}
      <div class="card"><h3 style="margin-bottom:6px">Organizer?</h3><p class="muted">Sign in${cid ? ' with Google, a password' : ''} or open the personal link your lead sent you.</p><a class="btn ghost" href="#/signin">${icon('user')} Organizer sign-in</a></div></div></div>`;
  } else {
    main = `<div class="card" style="max-width:560px;margin:0 auto"><h3>Organizer?</h3><p class="muted">This is the ${esc(ev.name)} team hub. Open your personal link, or sign in.</p><a class="btn primary" href="#/signin">Organizer sign-in</a></div>`;
  }
  const shared = (ctx.cfg.sharedSite || 'https://notazizelse.github.io/haven-hub').replace(/\/+$/, '');
  root.innerHTML = `<div class="pub"><header class="hero"><div class="hero-in">
      <div class="hero-top"><img src="assets/logo-white.png" alt="Hack Club Haven" width="132" height="84"><a class="btn ghost sm" href="#/signin">${icon('user')} Organizers</a></div>
      <h1>${esc(ev.name)}</h1>
      <div class="when">${icon('calendar')} ${esc(dates(ev))}${ev.city ? ` <span>· ${esc(ev.city)}</span>` : ''}</div>
      ${ev.tagline ? `<p class="tagline">${esc(ev.tagline)}</p>` : ''}
      <div class="countdown" id="cd" aria-live="off"></div>
      <div class="row">${cta}</div></div></header>
    <main class="pub-main">${main}</main>
    <footer class="pub-foot">${esc(ev.name)} is part of <a href="https://haven.hackclub.com" target="_blank" rel="noopener">Hack Club Haven</a> · organized with <a href="${esc(shared)}/#/about" target="_blank" rel="noopener">Haven Hub</a> — <a href="${esc(shared)}/#/about" target="_blank" rel="noopener">run it for your Haven →</a> · <a href="privacy.html">Privacy</a></footer></div>`;
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
    const gj = $('#g-join'); if (gj) gj.onclick = () => startGoogle(ctx, cid, 'join', '#/join');
    const gf = $('#g-forget'); if (gf) gf.onclick = () => { ctx.google = null; publicPage(root, ctx, { join: true }); };
    jf.addEventListener('change', e => { if (e.target.name === 'age_group') $('#agehint').textContent = e.target.value === '19+' ? 'Hack Club rule: people 19+ can\'t organize or take part — but you can help as a mentor or volunteer. Send it anyway!' : ''; });
    jf.onsubmit = async e => {
      e.preventDefault();
      const v = formValues(jf), b = jf.querySelector('[type=submit]');
      if (!v.age_group) return toast('Choose your age group.', 'err');
      if (g && g.ticket) v.ticket = g.ticket;
      busy(b, true, 'Sending…');
      const r = await ctx.api.postPublic('apply', v);
      busy(b, false);
      if (!r.ok) return toast(r.error, 'err');
      ctx.google = null;
      jf.innerHTML = `<div style="text-align:center"><img src="assets/daven.png" alt="" width="120" height="82"><h3>Thank you!</h3><p class="muted">${esc(r.message)}</p>${v.ticket ? '<p class="small muted">Once you are on the team, “Sign in with Google” takes you straight to your tasks.</p>' : ''}</div>`;
    };
  }
  if (opts.join && jf) jf.scrollIntoView();
}

function notReady(root) {
  root.innerHTML = `<div class="wiz"><div class="card" style="text-align:center"><img src="assets/daven-sketch.png" alt="" width="120"><h2>This hub isn't set up yet</h2>
    <p class="muted">If it's yours, finish the setup — it takes a few minutes.</p><a class="btn primary" href="#/setup">Continue the setup</a></div></div>`;
}

export async function signin(root, ctx, opts = {}) {
  clearInterval(timer);
  document.title = 'Sign in — Haven Hub';
  const pw = ctx.api.hub() && ctx.api.isServerHub();
  let cid = googleClient(null);
  if (!cid && ctx.api.hub() && !pw) { const p = await ctx.api.getPublic('ping'); cid = googleClient(p); }
  const miss = opts.miss;
  root.innerHTML = `<div class="wiz" style="max-width:520px"><div class="wiz-top"><a href="#/"><img src="assets/logo-orange.png" alt="Hack Club Haven" width="96" height="61"></a><h1 style="font-size:26px">Organizer sign-in</h1></div>
    ${opts.error ? `<div class="banner ${opts.password || opts.google ? 'info' : 'bad'}">${icon(opts.password || opts.google ? 'user' : 'alert')}<div>${esc(opts.error)}</div></div>` : ''}
    ${miss ? `<div class="banner">${icon('alert')}<div>${esc(miss.message || 'That Google account is not on the team yet.')} <a href="#/join">Apply to join with this Google account →</a></div></div>` : ''}
    ${opts.old ? `<div class="banner info">${icon('zap')}<div>This hub is being upgraded. Personal links keep working — open yours again in a few minutes.</div></div>` : ''}
    ${cid ? `<div class="card g-card"><h3 style="margin-bottom:6px">Sign in with Google</h3><p class="muted small">Works once your Google account is connected (Profile → Sign in with Google), or when your lead saved your Gmail address on the team.</p>${gButton('g-in', 'Sign in with Google')}</div>` : ''}
    ${pw ? `<form class="card" id="si0" method="post" action="#"><h3 style="margin-bottom:10px">${cid ? 'Or with your password' : 'Sign in'}</h3>
      <div class="field"><label for="si-u">Username or email</label><input id="si-u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${esc(opts.google ? '' : opts.username || '')}"></div>
      <div class="field"><label for="si-p">Password</label><input id="si-p" name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn primary" type="submit">${icon('user')} Sign in</button>
      <p class="small muted" style="margin:10px 0 0">First time? Open the personal link your lead sent you, then connect Google or make a password in <b>Profile</b>. Forgot your password? Ask your lead for a reset link.</p></form>` : ''}
    <form class="card" id="si1"><h3 style="margin-bottom:6px">${pw || cid ? 'First time: open your personal link' : 'Open your personal link'}</h3><p class="muted small">Your lead sent it by Telegram or email. It contains <code>&amp;t=</code>. Paste it here:</p>
      <div class="linkbox"><input name="link" placeholder="https://…?hub=…&u=…&t=…" aria-label="Your personal link"><button class="btn ${pw || cid ? 'soft' : 'primary'}" type="submit">Open</button></div></form>
    ${ctx.api.hub() ? `<form class="card" id="si2"><h3 style="margin-bottom:6px">Lost your link? Email me how to sign in</h3><p class="muted small">Works if your email is saved on the team.</p>
      <div class="linkbox"><input name="email" type="email" required placeholder="you@example.com" aria-label="Your email"><button class="btn soft" type="submit">Send</button></div><p class="small" id="si2o" style="margin:8px 0 0"></p></form>` : ''}
    <p class="small muted" style="text-align:center">${ctx.api.hub() ? '<a href="#/">← Back to the event page</a>' : '<a href="#/">← Haven Hub home</a>'}</p></div>`;
  const gi = $('#g-in'); if (gi) gi.onclick = () => startGoogle(ctx, cid, 'signin', '#/signin');
  const f0 = $('#si0');
  if (f0) {
    if (opts.username && !opts.google) setTimeout(() => f0.password.focus(), 50);
    f0.onsubmit = async e => {
      e.preventDefault();
      const b = f0.querySelector('[type=submit]'); busy(b, true, 'Signing in…');
      const r = await ctx.api.postPublic('login', { username: f0.username.value.trim(), password: f0.password.value });
      if (!r.ok) { busy(b, false); f0.password.value = ''; f0.password.focus(); return toast(r.error || 'Could not sign in.', 'err'); }
      ctx.api.setSession({ u: r.u, t: r.t });
      location.hash = '#/'; location.reload();
    };
  }
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

/** #/reset?k=… — the one-time link an admin sent: choose a new password (own-server hubs). */
export async function resetPage(root, ctx) {
  clearInterval(timer);
  document.title = 'Choose a new password — Haven Hub';
  const k = new URLSearchParams(location.hash.split('?')[1] || '').get('k') || '';
  root.innerHTML = `<div class="wiz" style="max-width:520px">${skeleton(2)}</div>`;
  const c = k ? await ctx.api.postPublic('account.resetCheck', { k }) : { ok: false, error: 'This reset link is incomplete — copy the whole link from the message.' };
  const top = `<div class="wiz-top"><a href="#/"><img src="assets/logo-orange.png" alt="Hack Club Haven" width="96" height="61"></a><h1 style="font-size:26px">Choose a new password</h1></div>`;
  if (!c.ok) { root.innerHTML = `<div class="wiz" style="max-width:520px">${top}<div class="banner bad">${icon('alert')}<div>${esc(c.error || 'This link does not work.')}</div></div><p class="small muted" style="text-align:center"><a href="#/signin">← Sign-in page</a></p></div>`; return; }
  root.innerHTML = `<div class="wiz" style="max-width:520px">${top}<form class="card" id="rp"><p style="margin-top:0">Hi, <b>${esc(String(c.name).split(' ')[0])}</b>! Your username stays <b>${esc(c.username)}</b>.</p>
    <input type="text" name="username" autocomplete="username" value="${esc(c.username)}" hidden>
    <div class="field"><label for="rp-1">New password</label><input id="rp-1" name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128"><small class="hint">8 or more characters — a short sentence works well</small></div>
    <div class="field"><label for="rp-2">New password again</label><input id="rp-2" name="password2" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></div>
    <button class="btn primary" type="submit">${icon('check')} Save and sign in</button><p class="small muted" style="margin:10px 0 0">Every other device is signed out.</p></form></div>`;
  const f = $('#rp');
  f.onsubmit = async e => {
    e.preventDefault();
    if (f.password.value !== f.password2.value) return toast('The two passwords are different.', 'err');
    const b = f.querySelector('[type=submit]'); busy(b, true, 'Saving…');
    const r = await ctx.api.postPublic('account.resetFinish', { k, password: f.password.value });
    busy(b, false);
    if (!r.ok) return toast(r.error, 'err');
    ctx.api.setSession({ u: r.u, t: r.t });
    toast('New password saved — you are signed in.');
    location.hash = '#/'; location.reload();
  };
}
