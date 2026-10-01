/* Applications (admins): people who used the public "Join the team" form. Accept → Add-organizer drawer, prefilled. */
import { esc, icon, avatar, toast, empty, ago } from '../ui.js';
import { personDrawer, linkModal } from './admin-people.js';

let tab = 'new';
const contactLink = c => /^@\w{4,}$/.test(c) ? `https://t.me/${c.slice(1)}` : /^[^\s@]+@[^\s@]+\.\w+$/.test(c) ? `mailto:${c}` : '';

export function applications(ctx) {
  const A = ctx.D.applications || [], by = s => A.filter(a => a.status === s);
  const list = by(tab);
  ctx.el.innerHTML = `<p class="lede">People who filled in “Join the team” on your <a href="${esc(ctx.api.publicUrl())}" target="_blank" rel="noopener">public page</a>. Message them, then accept — they get a personal link like everyone else.</p>
    <div class="toolbar"><div class="seg">${[['new', 'New'], ['accepted', 'Accepted'], ['declined', 'Declined']].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'new' && by('new').length ? ` <span class="cnt">${by('new').length}</span>` : ` <span class="muted">${by(k).length}</span>`}</button>`).join('')}</div></div>
    ${list.length ? `<div class="cards">${list.map(a => {
      const link = contactLink(a.contact);
      return `<div class="card" data-id="${esc(a.id)}"><div class="person-card">${avatar(a.name)}<div class="info"><b>${esc(a.name)}</b> ${a.age_group === '19+' ? '<span class="pill warn">19+</span>' : '<span class="pill">13–18</span>'}
        <div class="small muted">${esc(ago(a.time, ctx.tz))}${a.handled_by ? ' · ' + esc(a.status) + ' by ' + esc(a.handled_by) : ''}</div></div></div>
        <p style="margin:10px 0 4px"><b>Wants to help with:</b> ${esc(a.interest || '—')}</p>${a.note ? `<p class="small" style="white-space:pre-line">${esc(a.note)}</p>` : ''}
        <p class="small">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${icon(link.startsWith('mailto') ? 'mail' : 'message')} ${esc(a.contact)}</a>` : esc(a.contact)}</p>
        ${a.age_group === '19+' ? `<div class="banner" style="margin:8px 0">${icon('alert')}<div class="small">Hack Club rule: people 19+ can't organize or participate — they can help as a mentor or volunteer.</div></div>` : ''}
        <div class="actions">${a.status !== 'accepted' ? `<button class="btn primary sm" data-a="quick">${icon('userPlus')} Accept & invite</button><button class="btn soft sm" data-a="accept">${icon('edit')} Edit first</button>` : ''}${a.status === 'new' ? '<button class="btn ghost sm" data-a="declined">Decline</button>' : '<button class="btn ghost sm" data-a="new">Move back to New</button>'}</div></div>`;
    }).join('')}</div>` : `<div class="card">${empty({ title: tab === 'new' ? 'No new applications' : 'Nothing here', text: tab === 'new' ? 'Share your public page — the join form is at the bottom.' : '' })}</div>`}`;
  ctx.el.querySelector('.seg').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; applications(ctx); } };
  ctx.el.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = A.find(x => x.id === b.closest('[data-id]').dataset.id);
    const c = a.contact || '', preset = { name: a.name, handle: /^@\w+$/.test(c) ? c : '', email: /@.+\./.test(c) && !c.startsWith('@') ? c : '', area: a.interest || '', access: a.age_group === '19+' ? 'viewer' : 'member', role: a.age_group === '19+' ? 'Mentor / volunteer' : '' };
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
