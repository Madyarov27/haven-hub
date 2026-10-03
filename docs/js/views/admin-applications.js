/* Applications (admins): people who used the public "Join the team" form. Accept → a personal link, like everyone else.
   Someone who is already on the team (same email, Telegram or name) is flagged: open their page or close it as theirs — no second account. */
import { esc, icon, avatar, toast, empty, ago, first } from '../ui.js';
import { personDrawer, linkModal } from './admin-people.js';
import { taskDrawer } from './admin-tasks.js';

let tab = 'new';
const contactLink = c => /^@\w{4,}$/.test(c) ? `https://t.me/${c.slice(1)}` : /^[^\s@]+@[^\s@]+\.\w+$/.test(c) ? `mailto:${c}` : '';
const AREA = { 'Design & posters': 'Design', 'Social media & video': 'Growth', 'Schools & outreach': 'Outreach', 'Sponsors & partners': 'Sponsors', 'Tech & website': 'Tech', 'Event weekend help': 'Operations', 'Mentoring (19+)': 'Mentors' };

export function applications(ctx) {
  const A = ctx.D.applications || [], by = s => A.filter(a => a.status === s);
  const list = by(tab), onTeam = by('new').filter(a => a.match && !a.match.maybe && a.match.active).length;
  ctx.el.innerHTML = `<p class="lede">People who filled in “Join the team” on your <a href="${esc(ctx.api.publicUrl())}" target="_blank" rel="noopener">public page</a>. Message them, then accept — they get a personal link like everyone else.${onTeam ? ` <b>${onTeam} ${onTeam === 1 ? 'is' : 'are'} already on the team</b> — close those as theirs instead.` : ''}</p>
    <div class="toolbar"><div class="seg">${[['new', 'New'], ['accepted', 'Accepted'], ['declined', 'Declined']].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'new' && by('new').length ? ` <span class="cnt">${by('new').length}</span>` : ` <span class="muted">${by(k).length}</span>`}</button>`).join('')}</div></div>
    ${list.length ? `<div class="cards">${list.map(a => card(ctx, a)).join('')}</div>` : `<div class="card">${empty({ title: tab === 'new' ? 'No new applications' : 'Nothing here', text: tab === 'new' ? 'Share your public page — the join form is at the bottom.' : '' })}</div>`}`;
  ctx.el.querySelector('.seg').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; applications(ctx); } };
  ctx.el.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = A.find(x => x.id === b.closest('[data-id]').dataset.id), m = a.match;
    const c = a.contact || '', email = a.email || (/@.+\./.test(c) && !c.startsWith('@') ? c : '');
    const preset = { name: a.name, handle: /^@\w+$/.test(c) ? c : '', email, area: AREA[a.interest] || a.interest || '', access: a.age_group === '19+' ? 'viewer' : 'member', role: a.age_group === '19+' ? 'Mentor / volunteer' : '' };
    if (b.dataset.a === 'page') return ctx.go('team/' + m.key);
    if (b.dataset.a === 'task') return taskDrawer(ctx, null, { owner: m.key, area: AREA[a.interest] || '' });
    if (b.dataset.a === 'theirs') {
      const r = await ctx.api.post('application.update', { id: a.id, status: 'accepted', person: m.key });
      if (!r.ok) return toast(r.error, 'err');
      Object.assign(a, r.application); toast(`Closed — it's on ${first(m.name)}'s page now.`); return ctx.render();
    }
    if (b.dataset.a === 'accept') return personDrawer(ctx, null, preset, a.id);
    if (b.dataset.a === 'quick') {
      b.disabled = true;
      const r = await ctx.api.post('person.add', { person: Object.assign({ invite: !!preset.email }, preset), fromApplication: a.id });
      b.disabled = false;
      if (!r.ok) return toast(r.error + ' — use Edit first.', 'err');
      a.status = 'accepted'; ctx.refresh({ silent: true });
      return linkModal(ctx, r.person, r, r.emailed ? `${a.name} is on the team — invite emailed ✓` : `${a.name} is on the team — send the link`);
    }
    const r = await ctx.api.post('application.update', { id: a.id, status: b.dataset.a });
    if (!r.ok) return toast(r.error, 'err');
    Object.assign(a, r.application); toast(b.dataset.a === 'declined' ? 'Declined.' : 'Moved back.'); ctx.render();
  };
}

function card(ctx, a) {
  const link = contactLink(a.contact), m = a.match, here = m && m.active && !m.maybe;
  const matchBox = !m ? '' : m.active
    ? `<div class="banner ${m.maybe ? '' : 'info'} match">${avatar(m.name, 'sm')}<div><b>${m.maybe ? 'Maybe already on the team' : 'Already on the team'}:</b> <a href="#/team/${esc(m.key)}">${esc(m.name)}</a>${m.role ? ` — ${esc(m.role)}` : ''}${m.area ? ` · ${esc(m.area)}` : ''}<div class="small">same ${esc(m.how)}${m.maybe ? ' — check before you accept' : ''}. ${here ? `They want to help with <b>${esc(a.interest || 'something new')}</b> too.` : ''}</div></div></div>`
    : `<div class="banner match">${icon('alert')}<div><b>Was on the team:</b> ${esc(m.name)} (removed). Add them back in People → Removed if you want them again.</div></div>`;
  const acts = a.status === 'accepted' && a.person ? `<a class="btn ghost sm" href="#/team/${esc(a.person)}">${icon('user')} Open ${esc(first(ctx.nameOf(a.person)))}'s page</a>`
    : here && a.status === 'new' ? `<button class="btn primary sm" data-a="theirs">${icon('check')} Close — it's ${esc(first(m.name))}'s</button><button class="btn soft sm" data-a="task">${icon('plus')} Give ${esc(first(m.name))} a task</button><button class="btn ghost sm" data-a="page">${icon('user')} Their page</button>`
    : a.status !== 'accepted' ? `<button class="btn primary sm" data-a="quick">${icon('userPlus')} Accept & invite</button><button class="btn soft sm" data-a="accept">${icon('edit')} Edit first</button>${m && m.maybe && m.active ? `<button class="btn ghost sm" data-a="theirs">It's ${esc(first(m.name))}</button>` : ''}` : '';
  return `<div class="card ${here && a.status === 'new' ? 'app-dup' : ''}" data-id="${esc(a.id)}"><div class="person-card">${avatar(a.name)}<div class="info"><b>${esc(a.name)}</b> ${a.age_group === '19+' ? '<span class="pill warn">19+</span>' : '<span class="pill">13–18</span>'}${a.verified ? ' <span class="pill ok" title="Signed up with Google — the email is confirmed">G verified</span>' : ''}
      <div class="small muted">${esc(ago(a.time, ctx.tz))}${a.handled_by ? ' · ' + esc(a.status) + ' by ' + esc(a.handled_by) : ''}</div></div></div>
    <p style="margin:10px 0 4px"><b>Wants to help with:</b> ${esc(a.interest || '—')}</p>${a.note ? `<p class="small" style="white-space:pre-line">${esc(a.note)}</p>` : ''}
    <p class="small">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${icon(link.startsWith('mailto') ? 'mail' : 'message')} ${esc(a.contact)}</a>` : esc(a.contact)}${a.email && a.email !== a.contact ? ` · <a href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : ''}</p>
    ${matchBox}
    ${a.age_group === '19+' ? `<div class="banner" style="margin:8px 0">${icon('alert')}<div class="small">Hack Club rule: people 19+ can't organize or participate — they can help as a mentor or volunteer.</div></div>` : ''}
    <div class="actions">${acts}${a.status === 'new' ? '<button class="btn ghost sm" data-a="declined">Decline</button>' : a.person ? '' : '<button class="btn ghost sm" data-a="new">Move back to New</button>'}</div></div>`;
}
