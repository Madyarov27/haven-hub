/* The front door when no hub is chosen: what Haven Hub is, "Set up your Haven", "I have a personal link". */
import { $, esc, icon } from '../ui.js';
import { parseLink } from '../api.js';

const FEATURES = [
  ['check', 'Tasks people actually finish', 'Steps, a deadline, who to ask — and one button each for Start, Done (with a photo, file or link as proof) and “I\'m blocked”.'],
  ['grid', 'A real admin dashboard', 'Overview, an all-tasks table with bulk edits and CSV import, proof review, a timeline and a scorecard per person.'],
  ['userPlus', 'Add organizers in seconds', 'Everyone gets a personal link by email, Telegram or copy-paste. No accounts, no passwords, nothing to install.'],
  ['bell', 'Reminders that work', 'The evening before every deadline by Telegram bot and/or email, instant BLOCKED alerts to leads, and a weekly report.'],
  ['globe', 'A public page for your event', 'Countdown, your signup link, organizing progress and a “Join the team” form that lands in your dashboard.'],
  ['file', 'Your data, in your Google Sheet', 'Everything lives in a Sheet you own and can edit by hand. Free forever: Google Sheets + Apps Script + this website.'],
];

export function landing(root, ctx) {
  const repo = ctx.cfg.repo || '#';
  document.title = 'Haven Hub — the team hub for Hack Club Haven organizers';
  root.innerHTML = `<div class="pub"><header class="hero"><div class="hero-in">
      <div class="hero-top"><img src="assets/logo-white.png" alt="Hack Club Haven" width="132" height="84"><a class="btn ghost sm" href="${esc(repo)}" target="_blank" rel="noopener">${icon('external')} GitHub</a></div>
      <h1>Haven Hub</h1>
      <p class="tagline">The free team hub for Hack Club Haven organizers. Every organizer gets their own task list, you get a proper admin dashboard, and your event gets a public page — all running on a Google Sheet you own.</p>
      <div class="row"><a class="btn accent lg" href="#/setup">${icon('zap')} Set up your Haven — about 10 min</a><a class="btn ghost lg" href="${esc(repo)}/blob/main/setup.md" target="_blank" rel="noopener">Read the guide</a></div>
    </div></header>
    <main class="pub-main">
      <form class="card" id="paste"><div class="card-h"><div><h3>Already on a team?</h3><div class="sub">Paste the personal link your lead sent you.</div></div></div>
        <div class="linkbox"><input name="link" placeholder="https://…/?hub=…&u=…&t=…" aria-label="Your personal link"><button class="btn primary" type="submit">Open</button></div><p class="errline small" id="perr" style="margin:6px 0 0"></p></form>
      <h2 class="section-t">What you get</h2>
      <div class="features">${FEATURES.map(([i, t, d]) => `<div class="feature"><div class="fi">${icon(i)}</div><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
      <h2 class="section-t">How it works</h2>
      <div class="card"><ol class="steps-h">
        <li><div><b>Copy the Google Sheet.</b><div class="muted">The code comes with it. Nothing to install.</div></div></li>
        <li><div><b>Deploy it as a web app.</b><div class="muted">Six clicks in Google Apps Script — the wizard shows each one.</div></div></li>
        <li><div><b>Paste the link here.</b><div class="muted">Name your event, and you're in your dashboard. Add your team, and each person gets their own link.</div></div></li>
      </ol><div class="row" style="margin-top:16px"><a class="btn primary" href="#/setup">Start the setup</a></div></div>
    </main>
    <footer class="pub-foot">Built by the Haven Tashkent organizers for every Haven · not an official Hack Club HQ product · <a href="${esc(repo)}" target="_blank" rel="noopener">open source (MIT)</a></footer></div>`;
  $('#paste').onsubmit = e => {
    e.preventDefault();
    const p = parseLink(e.target.link.value);
    if (!p || !p.hub) { $('#perr').textContent = 'That doesn\'t look like a Team Hub link. It contains ?hub=…&u=…&t=…'; return; }
    location.href = location.pathname + '?hub=' + encodeURIComponent(p.hub) + '&u=' + encodeURIComponent(p.u) + '&t=' + encodeURIComponent(p.t);
  };
}
