/**
 * Made-up "Haven Springfield" team for the local demo (docs/?demo=1 with the repo root served).
 * Everything goes through the real API in Code.gs, so the demo exercises the real backend. Nobody here is a real person.
 */
export function seed(be, gas, hub) {
  const tz = gas.Session.getScriptTimeZone();
  const today = new Date().toLocaleString('sv-SE', { timeZone: tz }).slice(0, 10);
  const day = (n, t = '18:00') => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) + ' ' + t; };
  const ok = (r, what) => { if (!r || !r.ok) throw new Error('Demo seed failed at ' + what + ': ' + (r && r.error)); return r; };

  const s = ok(be.post({ action: 'setup', sheet: gas._ss.getUrl(), hub, site: location.origin + location.pathname.replace(/\/[^/]*$/, ''), name: 'Maya Chen', role: 'Lead organizer', email: 'maya@example.com',
    event: { name: 'Haven Springfield', city: 'Springfield', start: day(44).slice(0, 10), end: day(45).slice(0, 10), timezone: tz, signup: 'https://haven.hackclub.com/' }, starter: true }), 'setup');
  const admin = { u: s.key, t: s.token };
  const as = (who, body) => be.post(Object.assign({}, body, who));
  const person = (p) => { const r = ok(as(admin, { action: 'person.add', person: p }), 'person ' + p.name); const q = new URL(r.link).searchParams; return { u: q.get('u'), t: q.get('t') }; };
  const P = {
    omar: person({ name: 'Omar Haddad', role: 'Program lead', area: 'Program', access: 'lead', handle: '@omar_hd', email: 'omar@example.com', one: 'The Saturday workshop, mentors and the Sunday arcade.' }),
    lina: person({ name: 'Lina Petrova', role: 'Design lead', area: 'Design', email: 'lina@example.com', one: 'Posters, badges and every graphic we post.', ask: 'Maya — money and printing\nOmar — anything about the program', weekend: 'Check-in desk Sat 08:30–11:00, then photos.' }),
    theo: person({ name: 'Theo Martins', role: 'Schools outreach', area: 'Outreach', handle: '@theo_m', one: 'Gets 12 schools to let us talk to one class each.' }),
    priya: person({ name: 'Priya Nair', role: 'Social media', area: 'Growth', email: 'priya@example.com', one: 'Three posts a week and the launch video.' }),
    sam: person({ name: 'Sam Okafor', role: 'Tech lead', area: 'Tech', one: 'The check-in app and the itch.io link checker.' }),
    jonas: person({ name: 'Jonas Weber', role: 'Operations', area: 'Operations', email: 'jonas@example.com', one: 'Food, printing, power, tables, signs.' }),
    rivera: person({ name: 'Ms. Rivera', role: 'HQ Engagement Manager (guest)', access: 'viewer' }),
  };
  const add = (title, owner, due, extra) => ok(as(admin, { action: 'task.add', task: Object.assign({ title, owner, due, mins: 45 }, extra || {}) }), title).task.id;
  const T = {
    poster: add('Put up 3 posters at Springfield High', 'lina', day(-4), { area: 'Design', steps: ['Print 3 posters (Design folder)', 'Ask the IT teacher where to hang them', 'Photo of each poster'], done_when: '3 photos of the posters on the wall', why: 'Posters in schools bring the most signups.' }),
    badges: add('Design name badges', 'lina', day(9), { area: 'Design', mins: 120 }),
    school1: add('Call the IT teacher at Westside School', 'theo', day(-2), { area: 'Outreach', steps: ['Find the number on the school list', 'Call before 15:00', 'Ask for 10 minutes with one class'], done_when: 'Teacher name + date of the class visit', ask: 'Maya — school list' }),
    school2: add('Visit Lincoln Middle School — 10-minute class talk', 'theo', day(3), { area: 'Outreach', mins: 90 }),
    school3: add('Email the info sheet to 5 teachers', 'theo', day(6), { area: 'Outreach' }),
    post1: add('Post the launch reel', 'priya', day(-6), { area: 'Growth', done_when: 'Link to the post' }),
    post2: add('Post "meet the mentors" carousel', 'priya', day(2), { area: 'Growth' }),
    post3: add('Film 3 short clips at the workshop test run', 'priya', day(12), { area: 'Growth', mins: 90 }),
    app: add('Build the check-in page', 'sam', day(5), { area: 'Tech', mins: 240, links: 'Spec | https://example.com/spec' }),
    checker: add('Test the itch.io link checker on 10 games', 'sam', day(20), { area: 'Tech', mins: 60 }),
    food: add('Get two catering quotes', 'jonas', day(-1), { area: 'Operations', done_when: 'Two quotes with prices' }),
    power: add('Count power strips + extension cords', 'jonas', day(8), { area: 'Operations', mins: 30 }),
    mentors: add('Confirm 6 mentors for Saturday', 'omar', day(4), { area: 'Program', mins: 120 }),
    workshop: add('Run the workshop test run with 5 friends', 'omar', day(14), { area: 'Program', mins: 180 }),
  };
  // progress
  const st = (who, id, status, extra) => ok(as(P[who] || admin, Object.assign({ action: 'status', id, status }, extra || {})), id + ' ' + status);
  const img = poster();
  if (img) { const up = ok(as(P.lina, { action: 'upload', id: T.poster, mime: 'image/png', fname: 'poster-wall.png', data: img }), 'upload'); st('lina', T.poster, 'Done', { proof: 'Photo: ' + up.url }); }
  else st('lina', T.poster, 'Done', { proof: 'Posters by the library, the canteen and room 12' });
  st('priya', T.post1, 'Done', { proof: 'https://instagram.com/p/demo-launch-reel' });
  st('jonas', T.food, 'Done', { proof: 'Quotes: Pizza Place 2 400, Green Bowl 2 150 (both for 110 people)' });
  st('theo', T.school1, 'In progress');
  st('theo', T.school2, 'Blocked', { reason: 'Need the info sheet in print from Lina before Thursday' });
  st('sam', T.app, 'In progress');
  st('omar', T.mentors, 'In progress');
  st('lina', T.badges, 'In progress');
  ok(as(admin, { action: 'review', id: T.post1, verdict: 'ok' }), 'review');
  // starter tasks: a few done so the chart has history, some handed out
  const all = be.get(Object.assign({ action: 'me' }, admin)).all;
  const starter = all.filter(t => t.created_by === 'starter');
  starter.slice(0, 2).forEach(t => st(null, t.id, 'Done', { proof: 'Done — see the shared Drive folder' }));
  ok(as(admin, { action: 'task.bulk', ids: starter.slice(3, 5).map(t => t.id), op: 'reassign', owner: 'jonas' }), 'reassign');
  ok(as(admin, { action: 'task.bulk', ids: [starter[5].id], op: 'reassign', owner: 'omar' }), 'reassign2');
  // backdate finished work so charts and "done in 7 days" look like a real month
  const tasks = gas._ss.getSheetByName('Tasks'), h = tasks.data[0], ci = k => h.indexOf(k);
  tasks.data.slice(1).forEach((r, i) => {
    if (r[ci('status')] !== 'Done') return;
    const due = r[ci('due')], back = day(-(i % 9) - 3, '17:30');
    r[ci('done_at')] = due < day(0) ? due.slice(0, 11) + '16:00' : back;
  });
  // content
  ok(as(admin, { action: 'list.save', tab: 'Meetings', rows: [
    { date: day(-7).slice(0, 10), time: '19:00', where: 'Telegram voice', what: 'Kick-off: roles and first tasks' },
    { date: day(0).slice(0, 10), time: '19:00', where: 'Telegram voice', what: 'Launch numbers · school visits' },
    { date: day(7).slice(0, 10), time: '19:00', where: 'Telegram voice', what: 'Mentors + adults check' },
    { date: day(37).slice(0, 10), time: '15:00', where: 'At the venue (2 h)', what: 'Walkthrough, WiFi test, volunteer briefing' },
    { date: day(43).slice(0, 10), time: '20:00', where: 'Telegram voice (20 min)', what: 'Everyone confirms role + arrival time' }] }), 'meetings');
  const me = be.get(Object.assign({ action: 'me' }, admin));
  ok(as(admin, { action: 'list.save', tab: 'Milestones', rows: me.milestones.map((m, i) => Object.assign({}, m, { public: m.public || i === 0, done: i === 0 })).concat([{ date: day(-10).slice(0, 10), label: 'Signups open', kind: 'event', public: true, done: true }]) }), 'milestones');
  ok(as(admin, { action: 'settings.save', values: { instagram: 'https://instagram.com/haven.springfield.hackclub', city_email: 'springfield@haven.hackclub.com' } }), 'settings');
  be.post({ action: 'apply', name: 'Nora Kim', contact: '@nora_draws', age_group: '13-18', interest: 'Design & posters', note: 'I draw pixel art and can make stickers.' });
  be.post({ action: 'apply', name: 'Mr. Alvarez', contact: 'alvarez@example.com', age_group: '19+', interest: 'Mentoring (19+)', note: 'CS teacher, happy to mentor on Saturday.' });
  return { admin, lead: P.omar, member: P.lina, viewer: P.rivera, theo: P.theo };
}

/** A little "poster on a wall" picture for the demo proof (browser only). */
function poster() {
  try {
    const c = document.createElement('canvas'); c.width = 640; c.height = 420; const g = c.getContext('2d');
    g.fillStyle = '#E9E2D6'; g.fillRect(0, 0, 640, 420);
    g.fillStyle = '#FC8616'; g.fillRect(200, 60, 240, 300);
    g.fillStyle = '#783D2B'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('HAVEN', 320, 140); g.font = 'bold 20px sans-serif'; g.fillText('Springfield', 320, 175);
    g.fillStyle = '#fff'; g.font = '16px sans-serif'; g.fillText('Make a game in 2 days', 320, 230); g.fillText('ages 13–18 · free', 320, 256);
    g.fillStyle = '#B8C11F'; g.fillRect(260, 290, 120, 36); g.fillStyle = '#2B1D17'; g.font = 'bold 15px sans-serif'; g.fillText('SIGN UP', 320, 314);
    return c.toDataURL('image/png').split(',')[1];
  } catch (e) { return ''; }
}
