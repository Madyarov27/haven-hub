/* The guided tour of the demo (?demo=1&tour=1): one card at a time, switching between what the admin, a lead, an organizer,
   a guest viewer and the public see — on made-up data, with the real backend running in the browser. */
import { esc, icon } from '../ui.js';

export const STEPS = [
  { as: 'admin', r: 'admin', t: 'The lead\'s dashboard', x: 'What is overdue, blocked and due this week, your milestones, everyone\'s progress and a workload chart. The first thing you open every day.', spot: '.kpis' },
  { as: 'admin', r: 'admin/tasks', t: 'Every task in one table', x: 'Search and filter, reassign or shift many tasks at once, import a CSV — or export the whole plan, edit it in a spreadsheet and update everything in one go.', spot: '.tbl' },
  { as: 'admin', r: 'admin/review', t: 'Proof, not promises', x: 'Every “Done” comes with a photo, a file or a link. Approve it, or ask for a redo in one sentence — the owner gets the message straight away.' },
  { as: 'admin', r: 'admin/timeline', t: 'Timeline', x: 'Every deadline, week by week, with your milestones marked. Click any task to change it.' },
  { as: 'admin', r: 'team', t: 'The team', x: 'Photos, roles and how each person is doing. Open anyone…', spot: '.people-cards' },
  { as: 'admin', r: 'team/lina', t: 'A page for every person', x: 'Their job, how to reach them, open and finished tasks with proof, hours given, and what they did lately. Admins edit, reset and remove from here.', spot: '.profile-head' },
  { as: 'admin', r: 'admin/people', t: 'People and sign-in', x: 'Add organizers one by one or paste a list. They sign in with a personal link, “Sign in with Google” or a password — and a forgotten password is a reset link away.' },
  { as: 'admin', r: 'admin/applications', t: 'Applications', x: 'The public “Join the team” form lands here. Priya is already on the team, so she is flagged — nobody gets a second account.', spot: '.app-dup' },
  { as: 'admin', r: 'admin/sponsors', t: 'Sponsors', x: 'Drop a logo and it is on your public page. One click copies the sponsors block for your city page on haven.hackclub.com.', spot: '.sp-admin' },
  { as: 'member', r: 'tasks', t: 'What an organizer sees', x: 'Only their own tasks: the steps, the deadline, who to ask — and Start, Done + proof, or “I\'m blocked”. Reminders come the evening before, by Telegram or email.', spot: '.task' },
  { as: 'member', r: 'files', t: 'Files', x: 'Posters, logos, slides and every Canva or Sheets link, sorted by role. Each task shows exactly what you need for it.' },
  { as: 'member', r: 'calendar', t: 'Calendar', x: 'Tasks, meetings and milestones on one month grid. Pick a day to act on it.' },
  { as: 'viewer', r: 'admin', t: 'Guest viewers', x: 'HQ, a mentor or a sponsor get a read-only view of your progress — without contacts, proof photos or notes.' },
  { as: 'guest', r: '', t: 'Your public page', x: 'A countdown, the signup link, your sponsors, your progress and the join form — with “Sign up with Google”. No account needed to see it.', spot: '.sp-card' },
  { as: 'admin', r: 'admin', t: 'That\'s Haven Hub', x: 'Free, open source, and it runs on a Google Sheet you own — or on your own server. Setting it up takes about 10 minutes.', end: true },
];
const KEY = 'hh:tour';

export function tourBar(ctx) {
  let i = 0; try { i = Math.min(STEPS.length - 1, Math.max(0, Number(sessionStorage.getItem(KEY)) || 0)); } catch (e) { i = 0; }
  const box = document.createElement('div');
  box.className = 'tour'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Guided tour');
  document.body.appendChild(box); document.body.classList.add('touring');
  const route = () => location.hash.replace(/^#\/?/, '').split('?')[0].replace(/\/$/, '');
  const base = location.pathname;
  const spot = s => {
    document.querySelectorAll('.tour-spot').forEach(x => x.classList.remove('tour-spot'));
    if (!s.spot) return;
    let n = 0; const t = setInterval(() => { const el = document.querySelector(s.spot); if (el || ++n > 30) { clearInterval(t); if (el) { el.classList.add('tour-spot'); el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } } }, 150);
  };
  const go = n => {
    i = Math.min(STEPS.length - 1, Math.max(0, n)); try { sessionStorage.setItem(KEY, String(i)); } catch (e) { /* private mode */ }
    const s = STEPS[i], who = window.__hub && window.__hub.as;
    if (s.as !== who) { ctx.api.demoAs(s.as); ctx.D = null; }
    if (route() !== s.r) location.hash = '#/' + s.r; else ctx.render();
    draw(); spot(s); window.scrollTo(0, 0);
  };
  const draw = () => {
    const s = STEPS[i], role = { admin: 'Admin', lead: 'Lead', member: 'Organizer', viewer: 'Guest viewer', guest: 'Public' }[s.as];
    box.innerHTML = `<div class="tour-top"><span class="tour-n">${i + 1} / ${STEPS.length}</span><span class="pill ${s.as === 'admin' ? 'admin' : s.as === 'viewer' ? 'viewer' : 'lead'}">seeing it as: ${esc(role)}</span><button class="icon-btn sm" data-t="x" aria-label="End the tour">${icon('x')}</button></div>
      <h3>${esc(s.t)}</h3><p>${esc(s.x)}</p>
      <div class="tour-dots" aria-hidden="true">${STEPS.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'seen' : ''}"></i>`).join('')}</div>
      ${s.end ? `<div class="actions"><a class="btn accent" href="${esc(base)}#/setup">${icon('zap')} Set up your Haven</a><a class="btn ghost" href="${esc(base)}#/about">Back to Haven Hub</a></div>`
        : `<div class="actions"><button class="btn ghost sm" data-t="back" ${i === 0 ? 'disabled' : ''}>${icon('left')} Back</button><button class="btn primary" data-t="next">Next ${icon('right')}</button></div>`}`;
  };
  box.onclick = e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    if (b.dataset.t === 'next') go(i + 1);
    if (b.dataset.t === 'back') go(i - 1);
    if (b.dataset.t === 'x') { try { sessionStorage.removeItem(KEY); } catch (er) { /* ignore */ } location.href = base + '?demo=1&as=' + encodeURIComponent((window.__hub && window.__hub.as) || 'admin') + location.hash; }
  };
  document.addEventListener('keydown', e => { if (e.target.closest && e.target.closest('input,textarea,select')) return; if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); });
  go(i);
}
