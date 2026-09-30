/* Settings (admins): event, public page, reminders, Telegram bot, hub & data. */
import { $, esc, icon, toast, busy, field, formValues, copy, download, zones } from '../ui.js';

export function settings(ctx) {
  const D = ctx.D, S = D.settings || {}, CFG = ctx.cfg, pub = ctx.api.publicUrl();
  const tz = zones(); if (S.timezone && !tz.includes(S.timezone)) tz.unshift(S.timezone);
  const form = (id, title, sub, inner, extra) => `<form class="card" id="${id}"><div class="card-h"><div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div></div>${inner}
    <div class="row" style="margin-top:4px"><button class="btn primary" type="submit">Save</button>${extra || ''}</div></form>`;
  ctx.el.innerHTML = `<div class="grid-2" style="align-items:start"><div class="stack">
    ${form('s-event', 'Event', 'Shown on the website, in emails and bot messages.', `<div class="form-grid">
      ${field({ label: 'Event name', name: 'event_name', value: S.event_name, required: true, full: true, placeholder: 'Haven Springfield' })}
      ${field({ label: 'City', name: 'city', value: S.city })}
      ${field({ label: 'Time zone', name: 'timezone', type: 'select', value: S.timezone, options: tz })}
      ${field({ label: 'First day', name: 'event_start', type: 'date', value: S.event_start })}
      ${field({ label: 'Last day', name: 'event_end', type: 'date', value: S.event_end })}
      ${field({ label: 'Greeting word', name: 'greeting', value: S.greeting, placeholder: 'Hi', hint: 'e.g. Salom, Hola, Привет' })}
      ${field({ label: 'Who people ask when stuck', name: 'contact_name', value: S.contact_name, placeholder: 'the first admin', hint: 'Used in “Ask … for your link”.' })}</div>`)}
    ${form('s-rem', 'Reminders', `Every day at the hour below (${esc(S.timezone)}), people get what's due tomorrow + anything overdue.`, `
      ${field({ label: 'Reminder hour', name: 'reminder_hour', type: 'select', value: S.reminder_hour, options: Array.from({ length: 24 }, (_, h) => [String(h), String(h).padStart(2, '0') + ':00']) })}
      ${field({ label: 'Email reminders', name: 'email_reminders', type: 'toggle', value: S.email_reminders, hint: 'For people who haven\'t connected Telegram (and have an email). Free Gmail sends up to 100 emails a day.' })}
      ${field({ label: 'Tell people when their tasks change', name: 'change_alerts', type: 'toggle', value: S.change_alerts, hint: 'A new task, a new date, a new owner or a removed task: the person gets a message (Telegram, or email) and admins a short summary. Quick edits are bundled into one message.' })}
      ${field({ label: 'Weekly report', name: 'weekly_report', type: 'toggle', value: S.weekly_report, hint: 'Sunday 19:00 to leads (+ a short post in the Telegram group).' })}
      ${field({ label: 'Tell leads about every finished task', name: 'done_alerts', type: 'toggle', value: S.done_alerts, hint: 'Telegram DM with the proof photos.' })}
      ${field({ label: 'Post finished tasks in the Telegram group', name: 'group_done_posts', type: 'toggle', value: S.group_done_posts })}`,
      `<button class="btn ghost" type="button" id="tmail">${icon('mail')} Send me a test email</button>`)}
    <div class="card" id="s-bot"><div class="card-h"><div><h3>Telegram bot <span class="muted small">(optional)</span></h3><div class="sub">Reminders in Telegram, BLOCKED alerts, and posts in your organizer group. Only talks to people on your team.</div></div>${D.bot ? `<span class="pill ok">${icon('check')} @${esc(D.bot)}</span>` : '<span class="pill">off</span>'}</div>
      ${D.bot ? '' : `<ol class="how"><li>In Telegram open <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a> → <code>/newbot</code> → name it “${esc(S.event_name)} Team”.</li><li>Copy the token it gives you (looks like <code>123456789:AAE…</code>) and paste it below. Never post it anywhere else.</li><li>Everyone presses <b>Connect Telegram</b> in their Profile.</li><li>Add the bot to your organizer group and send <code>/setgroup</code> there (as a lead).</li></ol>`}
      <div class="linkbox"><input type="password" id="tok" placeholder="${D.bot ? 'Paste a new token to replace it' : '123456789:AAE…'}" autocomplete="off" aria-label="Bot token"><button class="btn primary" id="tsave">Save token</button></div>
      ${D.bot ? `<div class="actions"><button class="btn soft" id="bcheck">${icon('zap')} Check the bot</button><button class="btn ghost" data-test="me">Test message to me</button><button class="btn ghost" data-test="group">Test to the group</button><button class="btn danger ghost" id="tdel">Turn the bot off</button></div>` : ''}
      <div id="bout" class="small" style="margin-top:10px;white-space:pre-line"></div></div>
  </div><div class="stack">
    ${form('s-pub', 'Public page', `What anyone sees at your hub link without a personal link. <a href="${esc(pub)}" target="_blank" rel="noopener">Open it ${icon('external')}</a>`, `
      <div class="field"><label>Public link — put it in your bio or on posters</label><div class="linkbox"><input readonly value="${esc(pub)}"><button class="btn soft" type="button" id="cpub">${icon('copy')} Copy</button></div></div>
      ${field({ label: 'Show the public page', name: 'public_page', type: 'toggle', value: S.public_page, hint: 'Off = only a sign-in screen.' })}
      ${field({ label: 'Tagline', name: 'tagline', value: S.tagline })}
      ${field({ label: 'Participant signup link', name: 'signup_url', type: 'url', value: S.signup_url, placeholder: 'https://haven.hackclub.com/yourcity', hint: 'HQ\'s official signup page — it is what counts for funding.' })}
      <div class="form-grid">${field({ label: 'Public email', name: 'city_email', type: 'email', value: S.city_email, placeholder: 'yourcity@haven.hackclub.com' })}
      ${field({ label: 'Instagram link', name: 'instagram', type: 'url', value: S.instagram, placeholder: 'https://instagram.com/haven.yourcity.hackclub' })}
      ${field({ label: 'Telegram channel link', name: 'telegram_channel', type: 'url', value: S.telegram_channel, placeholder: 'https://t.me/…' })}
      ${field({ label: 'Other website', name: 'website', type: 'url', value: S.website })}</div>
      ${field({ label: 'Show organizing progress', name: 'public_show_progress', type: 'toggle', value: S.public_show_progress, hint: '% of tasks done + milestones marked Public.' })}
      ${field({ label: 'Show the team (first names + roles)', name: 'public_show_team', type: 'toggle', value: S.public_show_team, hint: 'Most organizers are under 18 — ask the team before you turn this on.' })}
      ${field({ label: '“Join the team” form', name: 'join_form', type: 'toggle', value: S.join_form, hint: 'Answers land in Applications.' })}
      ${field({ label: 'Text above the form', name: 'join_intro', type: 'textarea', value: S.join_intro, attrs: 'rows="2" style="min-height:60px"' })}`)}
    ${form('s-hub', 'Hub & data', 'Advanced — you rarely need to change these.', `
      ${field({ label: 'Website address', name: 'site_url', type: 'url', value: S.site_url, hint: 'Change it only if you run your own copy of the website.' })}
      ${field({ label: 'Hub ID (web-app deployment)', name: 'hub_id', value: S.hub_id, hint: 'Part of every personal link. Filled in automatically.' })}`,
      `${D.sheetUrl ? `<a class="btn ghost" href="${esc(D.sheetUrl)}" target="_blank" rel="noopener">${icon('external')} Open the Google Sheet</a>` : ''}<button class="btn ghost" type="button" id="exp">${icon('download')} Export all data</button>`)}
    <div class="card"><div class="card-h"><h3>About this hub</h3><button class="btn ghost sm" id="hchk">Run a health check</button></div>
      <p class="small muted" style="margin:0">Backend v${esc(D.version)} · website latest v${esc(CFG.latestBackend || '?')} · <a href="${esc(CFG.repo || '#')}" target="_blank" rel="noopener">Haven Hub on GitHub</a></p><div id="hout" class="small" style="margin-top:8px"></div></div>
  </div></div>`;

  const save = async (e, id) => {
    e.preventDefault();
    const f = $('#' + id), v = formValues(f), b = f.querySelector('button[type=submit]');
    Object.keys(v).forEach(k => { if (typeof v[k] === 'boolean') v[k] = v[k] ? 'yes' : 'no'; });
    busy(b, true);
    const r = await ctx.api.post('settings.save', { values: v });
    busy(b, false);
    if (!r.ok) return toast(r.error, 'err');
    D.settings = r.settings; D.event = Object.assign(D.event || {}, r.event); ctx.api.cache(D);
    toast(r.warning || 'Saved.', r.warning ? 'err' : 'ok');
    if (id === 's-event') ctx.render();
  };
  ['s-event', 's-rem', 's-pub', 's-hub'].forEach(id => { $('#' + id).onsubmit = e => save(e, id); });
  $('#cpub').onclick = () => copy(pub, 'Public link copied.');
  $('#exp').onclick = async e => { const btn = e.currentTarget;
    busy(btn, true, 'Exporting…'); const r = await ctx.api.get('export'); busy(btn, false);
    if (!r.ok) return toast(r.error, 'err');
    download(`haven-hub-export-${r.exported.slice(0, 10)}.json`, JSON.stringify(r, null, 2), 'application/json'); toast('Downloaded — personal links are not included.');
  };
  $('#tmail').onclick = async e => { const btn = e.currentTarget; busy(btn, true, 'Sending…'); const r = await ctx.api.post('bottest', { target: 'email' }); busy(btn, false); toast(r.detail || r.error, r.ok ? 'ok' : 'err'); };
  $('#hchk').onclick = async e => {
    const btn = e.currentTarget;
    busy(btn, true, 'Checking…'); const r = await ctx.api.get('health'); busy(btn, false);
    if (!r.ok) return toast(r.error, 'err');
    const has = f => r.triggers.includes(f), row = (ok, t) => `<div>${ok ? '✅' : '⚠️'} ${t}</div>`, sv = r.server;
    $('#hout').innerHTML = (sv
      ? row(true, `Running on your own server · up ${sv.uptimeMin} min`) + row(sv.email, sv.email ? 'Email is set up' : 'Email not set up — SMTP_USER / SMTP_PASS in ~/haven/.env') +
        row(!sv.outbox.failed24h, `${sv.outbox.pending} message(s) waiting to send · ${sv.outbox.failed24h} failed today`) + row(!!sv.lastBackup, sv.lastBackup ? 'Last backup ' + esc(sv.lastBackup.slice(0, 16).replace('T', ' ')) : 'No backup yet (runs nightly)')
      : row(has('eveningReminders'), `Daily reminders ${has('eveningReminders') ? 'on' : 'off — in the Sheet: Haven Hub → Turn on reminders'}`) +
        row(!r.bot || has('pollTelegram'), r.bot ? (has('pollTelegram') ? 'Bot checks Telegram every minute' : 'Bot timer missing — press “Check the bot”') : 'No Telegram bot (optional)') +
        row(!!r.hubId, r.hubId ? 'Hub ID set' : 'Hub ID missing — open the hub once from your admin link')) +
      row(r.mailQuota === null || r.mailQuota > 10, r.mailQuota === null ? 'Email not authorised yet' : `${r.mailQuota} emails left today`) +
      row(!r.lastError, r.lastError ? 'Last error: ' + esc(r.lastError) : 'No errors recorded') + `<div class="muted">Time zone ${esc(r.tz)} · backend v${esc(r.version)}</div>`;
  };
  // Telegram
  const out = $('#bout'), say = h => { out.innerHTML = h; };
  $('#tsave').onclick = async e => { const btn = e.currentTarget;
    const tok = $('#tok').value.trim(); if (!tok) return toast('Paste the token from @BotFather first.', 'err');
    busy(btn, true, 'Checking with Telegram…'); const r = await ctx.api.post('tg.setToken', { token: tok }); busy(btn, false);
    say(esc(r.report || r.error || ''));
    if (!r.ok) return toast(r.error || 'Telegram did not accept that token.', 'err');
    D.bot = r.bot; toast(`Bot @${r.bot} is on.`); ctx.refresh();
  };
  const del = $('#tdel');
  if (del) del.onclick = async () => { const r = await ctx.api.post('tg.setToken', { token: '' }); if (!r.ok) return toast(r.error, 'err'); D.bot = ''; toast('Bot turned off.'); ctx.render(); };
  ctx.el.querySelectorAll('[data-test]').forEach(b => { b.onclick = async () => { say('Sending…'); const r = await ctx.api.post('bottest', { target: b.dataset.test }); say((r.ok ? '✅ ' : '❌ ') + esc(r.detail || r.error || '')); }; });
  const chk = $('#bcheck');
  if (chk) chk.onclick = async () => {
    say('Asking Telegram…');
    const r = await ctx.api.get('botinfo'); if (!r.ok) return say('❌ ' + esc(r.error));
    const i = r.info, row = (ok, text, fix) => `<div>${ok ? '✅' : '❌'} ${text}${!ok && fix ? `<br><span class="muted">→ ${fix}</span>` : ''}</div>`;
    say([row(i.tokenOk, i.tokenOk ? 'Telegram accepts the token (@' + esc(i.username) + ')' : 'Telegram rejected the token: ' + esc(i.tokenError || ''), 'get a fresh token from @BotFather and paste it above'),
      ...(i.mode === 'webhook'
        ? [row(i.polling, 'Telegram delivers messages to the hub instantly (webhook)', 'wait a minute and check again — or on the server: hubctl set-webhook')]
        : [row(!i.webhook, 'No webhook blocking the bot', 'save the token again'), row(i.polling, 'Timer checks messages every minute', 'save the token again')]),
      row(i.reminders, 'Daily reminders are on', 'in the Sheet: Haven Hub → Turn on reminders'),
      row(i.canReadAll !== false, 'Bot can read group messages (for “T014 DONE”)', 'BotFather → /mybots → your bot → Bot Settings → Group Privacy → Turn off'),
      row(i.groupSet, 'Organizer group is set', 'add the bot to the group and send /setgroup there'),
      row(i.connected > 0, `${i.connected} of ${i.total} people connected${i.missing && i.missing.length ? ' — not yet: ' + esc(i.missing.slice(0, 8).join(', ')) : ''}`),
      row(!i.lastError, i.lastError ? 'Last error: ' + esc(i.lastError) : 'No errors recorded')].join(''));
  };
}
