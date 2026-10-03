/* The front door of Haven Hub (no hub chosen, or #/about): what it is, what every person on a team gets — with screenshots of
   the real app on made-up data — the guided tour, how it runs, and "Set up your Haven". */
import { $, $$, esc, icon } from '../ui.js';
import { parseLink, SELF } from '../api.js';

const SHOT = n => `assets/tour/${n}.webp`;
const ROLES = [
  { k: 'admin', t: 'Admin', who: 'the lead organizer', shot: 'overview', as: 'admin', r: 'admin',
    say: 'Runs the team. Sees everything, changes everything — and is told about everything that matters.',
    pages: [['grid', 'Overview', 'overdue, blocked, next 7 days, milestones, workload chart'], ['list', 'All tasks', 'filters, bulk edits, CSV import, “update the whole plan”'], ['image', 'Review', 'approve proof or ask for a redo'], ['clock', 'Timeline + Scorecards', 'every deadline by week; one card per person'],
      ['userPlus', 'People', 'invite, roles, sign-in, reset a password, remove + hand over tasks'], ['inbox', 'Applications', 'the join form — already-on-the-team people flagged'], ['gift', 'Sponsors', 'drop a logo → it\'s on the public page'], ['settings', 'Settings', 'event, reminders, Telegram bot, public page, files']] },
  { k: 'lead', t: 'Lead', who: 'area leads', shot: 'person', as: 'lead', r: 'team/lina',
    say: 'Plans and checks the work of their part of the team, without the admin-only settings.',
    pages: [['grid', 'Overview, All tasks, Review', 'add and edit tasks, approve proof'], ['users', 'Team + a page per person', 'job, contacts, open and done tasks, hours, activity'], ['clock', 'Timeline + Scorecards', 'who needs a nudge'], ['calendar', 'Calendar', 'everyone\'s deadlines, meetings, milestones']] },
  { k: 'member', t: 'Organizer', who: 'everyone else on the team', shot: 'member', as: 'member', r: 'tasks',
    say: 'Opens the hub and sees only their own tasks — what to do, by when, and who to ask.',
    pages: [['check', 'My tasks', 'steps, deadline, Start · Done + proof · I\'m blocked'], ['folder', 'Files', 'posters, logos, slides, Canva links — and what each task needs'], ['calendar', 'Calendar', 'their tasks, meetings and milestones'], ['users', 'Team', 'photos, roles, who does what'], ['user', 'Profile', 'photo, reminders, Telegram, Google or password']] },
  { k: 'viewer', t: 'Guest viewer', who: 'HQ, mentors, sponsors', shot: 'viewer', as: 'viewer', r: 'admin',
    say: 'A read-only window on your progress. No contacts, proof photos or notes.',
    pages: [['grid', 'Overview', 'progress, overdue, milestones'], ['clock', 'Timeline + Scorecards', 'read-only'], ['calendar', 'Calendar + Team', 'read-only']] },
  { k: 'public', t: 'Public page', who: 'participants, parents, schools', shot: 'public', as: 'guest', r: '',
    say: 'Your event\'s page — no account needed. Put it in your bio and on posters.',
    pages: [['flag', 'Countdown + dates', 'and your HQ signup link'], ['gift', 'Supported by', 'your sponsors\' logos, grouped by kind'], ['award', 'Getting ready', 'your organizing progress + public milestones'], ['userPlus', 'Join the team', 'a short form with “Sign up with Google”']] },
];
const FEATURES = [
  ['tasks', 'Tasks people actually finish', 'Every task has a why, the steps, a deadline and who to ask. One button each for Start, Done (with a photo, file or link as proof) and “I\'m blocked” — which reaches the leads instantly.'],
  ['timeline', 'A timeline you will actually use', 'Every deadline week by week, with the gates that can sink the event (venue, adults, budget) marked. Plus a month calendar for everyone.'],
  ['team', 'A team page with real people', 'Photos, roles, progress and a page for each person: their job, how to reach them, their open and finished work, the hours they gave and their latest activity.'],
  ['sponsors', 'Sponsors in two clicks', 'Drop a logo, name it, done — it\'s on your public page. “Copy for haven.hackclub.com” gives you the sponsors block for your city page on HQ\'s site.'],
  ['files', 'Files in one place', 'Posters, logos, slides and every Canva, Figma or Sheets link, sorted by role — and every task lists exactly the files it needs.'],
  ['applications', 'Applications that know your team', 'The public join form lands in your dashboard. Someone who is already on the team is spotted by email, Telegram or name, so nobody gets a second account.'],
];
const FAQ = [
  ['Is it free?', 'Yes. On the Google Sheet setup it runs on your own Google account (Sheets + Apps Script), and the website is shared by every Haven. If you run your own server, that is free software too (MIT licence).'],
  ['Is it an official Hack Club product?', 'No — it is made by Haven organizers for Haven organizers. It follows HQ\'s rules (ages, shipping, adult supervision) and HQ\'s public brand guide, and it points participants to your official HQ signup page, because that is what counts for funding.'],
  ['Who can see our data?', 'Only people with a link or sign-in to your hub, and only what their role allows. Everything lives in your own Google Sheet (or your own server). The public page shows only what you switch on — team names are off by default because most organizers are minors.'],
  ['Do organizers need accounts?', 'No. Each person gets a personal link. If you like, they can then sign in with Google or make a password, and a lost password is a reset link away.'],
  ['Does it work on phones?', 'Yes — it is built phone-first, because that is where most of a teen team lives. Reminders come by Telegram or email the evening before a deadline.'],
  ['Can we use it in our language?', 'The dashboard is in English today; reminders use your greeting word, and everything you type (tasks, rules, the join-form intro) can be in any language. Translations are on the roadmap — help is welcome on GitHub.'],
];

export function landing(root, ctx) {
  const repo = ctx.cfg.repo || '#', shared = (ctx.cfg.sharedSite || '').replace(/\/+$/, ''), here = SELF && shared ? shared + '/' : '';
  const demo = (as, r) => `${here}?demo=1${as ? '&as=' + as : ''}${r !== undefined ? '#/' + r : ''}`, tour = `${here}?demo=1&tour=1`;
  document.title = 'Haven Hub — the team hub for Hack Club Haven organizers';
  root.innerHTML = `<div class="pub show">
    <header class="hero show-hero"><div class="hero-in">
      <div class="hero-top"><img src="assets/logo-white.png" alt="Hack Club Haven" width="132" height="84">
        <nav class="show-nav"><a href="#see">What you get</a><a href="#how">How it runs</a><a href="#faq">FAQ</a><a class="btn ghost sm" href="${esc(repo)}" target="_blank" rel="noopener">${icon('external')} GitHub</a></nav></div>
      <div class="show-grid"><div>
        <p class="kicker">for Hack Club Haven organizers</p>
        <h1>Haven Hub</h1>
        <p class="tagline">Run your Haven's organizing team from one place. Every organizer gets their own task list, you get a real dashboard, and your event gets a public page — free, open source, on a Google Sheet you own.</p>
        <div class="row"><a class="btn accent lg" href="${esc(tour)}">${icon('play')} Take the 2-minute tour</a><a class="btn ghost lg" href="${here}#/setup">${icon('zap')} Set up your Haven</a></div>
        <p class="small hero-note">The tour runs the real app in your browser with a made-up team. Nothing is saved.</p>
      </div><figure class="browser hero-shot"><div class="bar"><i></i><i></i><i></i><span>Overview — Haven Springfield</span></div><img src="${SHOT('overview')}" alt="The admin overview: overdue and blocked tasks, next 7 days, milestones and a workload chart" width="1280" height="800"></figure></div>
    </div></header>
    <main class="pub-main show-main">
      <div class="facts-strip"><div><b>5</b><span>views: admin, lead, organizer, guest, public</span></div><div><b>20+</b><span>pages, phone-first</span></div><div><b>0</b><span>servers needed</span></div><div><b>MIT</b><span>open source</span></div></div>

      <section id="see"><h2 class="section-t big">One hub, a view for everyone</h2><p class="lede">Each person sees what they need — and nothing they shouldn't. Pick a role:</p>
        <div class="seg role-tabs" role="tablist">${ROLES.map((x, i) => `<button role="tab" data-role="${x.k}" class="${i ? '' : 'on'}" aria-selected="${!i}">${esc(x.t)}</button>`).join('')}</div>
        ${ROLES.map((x, i) => `<div class="card role-pane" data-pane="${x.k}" ${i ? 'hidden' : ''}><div class="role-grid"><div>
            <h3>${esc(x.t)} <span class="muted small">— ${esc(x.who)}</span></h3><p>${esc(x.say)}</p>
            <ul class="page-list">${x.pages.map(([ic, t, d]) => `<li><span class="fi">${icon(ic)}</span><div><b>${esc(t)}</b><span>${esc(d)}</span></div></li>`).join('')}</ul>
            <a class="btn soft" href="${esc(demo(x.as, x.r))}">${icon('eye')} Open this view in the demo</a></div>
          <figure class="browser"><div class="bar"><i></i><i></i><i></i><span>${esc(x.t)}</span></div><img src="${SHOT(x.shot)}" alt="What ${esc(x.who)} see" loading="lazy" width="1280" height="800"></figure></div></div>`).join('')}
      </section>

      <section><h2 class="section-t big">Everything an organizing team needs</h2>
        ${FEATURES.map(([shot, t, d], i) => `<div class="feat-row ${i % 2 ? 'rev' : ''}"><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div><figure class="browser"><div class="bar"><i></i><i></i><i></i></div><img src="${SHOT(shot)}" alt="${esc(t)}" loading="lazy" width="1280" height="800"></figure></div>`).join('')}
        <div class="feat-row"><div><h3>Reminders that reach a teenager</h3><p>The evening before every deadline, by a Telegram bot and/or email. Leads get BLOCKED alerts at once, a daily summary and a Sunday report; the organizer group gets new and finished tasks. Everyone hears when their tasks change.</p></div>
          <div class="chat" aria-label="An example Telegram conversation with the hub's bot"><div class="msg bot">Salom, Lina! 👋<br><br>Due tomorrow:<br>• T014 Design name badges (18:00)<br><br>Open your tasks: haven.example/…</div><div class="msg me">/tasks</div><div class="msg bot">• T014 Design name badges — due Thu 18:00<br>• T021 Sticker for the welcome pack — due Mon 20:00</div><div class="msg bot alert">🔴 BLOCKED — Theo<br>T009 Visit Lincoln Middle School<br>Needs: the info sheet in print from Lina by Thursday</div></div></div>
        <div class="feat-row rev"><div><h3>Sign-in that fits a teen team</h3><p>Start with a personal link — nothing to install, no account. Later, “Sign in with Google” or a password works on any device, used links stop working, and you reset a forgotten password with a one-time link.</p></div>
          <figure class="browser"><div class="bar"><i></i><i></i><i></i><span>Sign in</span></div><img src="${SHOT('signin')}" alt="The sign-in page: Sign in with Google, password, personal link" loading="lazy" width="1280" height="800"></figure></div>
      </section>

      <section id="how"><h2 class="section-t big">How it runs</h2><p class="lede">Pick one. You can move from the first to the second later without losing anything.</p>
        <div class="features how3">
          <div class="feature"><div class="fi">${icon('table')}</div><h3>A Google Sheet <span class="pill ok">recommended</span></h3><p>Copy the Sheet, deploy it as a web app, paste the link into the setup wizard. About 10 minutes, free, nothing to install. The Sheet <i>is</i> the database — you can edit it by hand.</p></div>
          <div class="feature"><div class="fi">${icon('server')}</div><h3>Your own server</h3><p>The same backend on Node + SQLite, with your own domain, a Telegram webhook, nightly backups, a password + Google sign-in and a mirror of your team files. One move from the Sheet.</p></div>
          <div class="feature"><div class="fi">${icon('external')}</div><h3>Your own copy of the website</h3><p>Fork the repo and switch on GitHub Pages if you want to change the code. Your fork keeps getting updates with “Sync fork”.</p></div></div>
        <div class="row" style="margin-top:16px"><a class="btn primary lg" href="${here}#/setup">${icon('zap')} Start the setup</a><a class="btn ghost lg" href="${esc(repo)}/blob/main/setup.md" target="_blank" rel="noopener">Read the guide</a><a class="btn ghost lg" href="${esc(repo)}/blob/main/ARCHITECTURE.md" target="_blank" rel="noopener">How it works inside</a></div>
      </section>

      <section><div class="card safe"><div class="fi">${icon('shield')}</div><div><h3>Made for teams of minors</h3><ul>
        <li>Only the people on your team see your data, and only what their role allows. The public page shows nothing about the team unless you switch it on.</li>
        <li>Profile photos and contacts stay inside the hub. Proof photos are private; only sponsor logos are public.</li>
        <li>Built around HQ's rules: ages 13–18, 19+ as mentors only, one adult per ~35 attendees, every game shipped on itch.io + GitHub.</li>
        <li>No ads, no tracking, no third-party scripts. Your data is yours: export it any time.</li></ul></div></div></section>

      <section id="faq"><h2 class="section-t big">Questions</h2><div class="faq">${FAQ.map(([q, a]) => `<details class="card"><summary><b>${esc(q)}</b></summary><p>${esc(a)}</p></details>`).join('')}</div></section>

      <section class="final card"><img src="assets/daven.png" alt="" width="120" height="82"><div><h2>Ready when your team is</h2><p class="muted">Take the tour, then set up your hub in about 10 minutes.</p></div>
        <div class="row"><a class="btn accent lg" href="${esc(tour)}">${icon('play')} Take the tour</a><a class="btn primary lg" href="${here}#/setup">Set up your Haven</a></div></section>

      ${SELF ? '' : `<form class="card" id="paste"><div class="card-h"><div><h3>Already on a team?</h3><div class="sub">Paste the personal link your lead sent you.</div></div></div>
        <div class="linkbox"><input name="link" placeholder="https://…/?hub=…&u=…&t=…" aria-label="Your personal link"><button class="btn primary" type="submit">Open</button></div><p class="errline small" id="perr" style="margin:6px 0 0"></p></form>`}
    </main>
    <footer class="pub-foot">Made by the Haven Tashkent organizers for every Haven · not an official Hack Club HQ product · <a href="${esc(repo)}" target="_blank" rel="noopener">open source (MIT)</a> · live example: <a href="https://haventash.xyz" target="_blank" rel="noopener">haventash.xyz</a></footer></div>`;
  $$('.role-tabs button', root).forEach(b => { b.onclick = () => {
    $$('.role-tabs button', root).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
    $$('.role-pane', root).forEach(p => { p.hidden = p.dataset.pane !== b.dataset.role; });
  }; });
  $$('a[href^="#"]', root).forEach(a => { const id = a.getAttribute('href').slice(1); if (/^(see|how|faq)$/.test(id)) a.onclick = e => { e.preventDefault(); const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth' }); }; });
  const f = $('#paste', root);
  if (f) f.onsubmit = e => {
    e.preventDefault();
    const p = parseLink(e.target.link.value);
    if (!p || !p.hub) { $('#perr').textContent = 'That doesn\'t look like a Team Hub link. It contains ?hub=…&u=…&t=…'; return; }
    location.href = location.pathname + '?hub=' + encodeURIComponent(p.hub) + '&u=' + encodeURIComponent(p.u) + '&t=' + encodeURIComponent(p.t);
  };
}
