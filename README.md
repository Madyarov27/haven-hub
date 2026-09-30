# Haven Hub

**The free team hub for [Hack Club Haven](https://haven.hackclub.com) organizers.** Every organizer gets their own task list, leads get a proper admin dashboard, and your event gets a public page — all running on a Google Sheet you own.

**→ [Set up your Haven (about 10 minutes)](setup.md)** · **Open the website: https://notazizelse.github.io/haven-hub/**

| For organizers | For leads & admins | For everyone else |
|---|---|---|
| Their tasks only: steps, deadline, who to ask | Overview: overdue, blocked, next 7 days, milestones, workload chart | Public event page: countdown, signup link, progress |
| **Start** · **Done + proof** (photo, file, link) · **I'm blocked** | All-tasks table: search, filters, bulk reassign/shift, CSV import | **Join the team** form → Applications |
| Reminders by email or Telegram the evening before | Review proof: approve or ask for a redo | Read-only **guest links** for HQ, mentors, sponsors |
| Calendar, team, rules, profile | People: add organizers, invite by email/Telegram, reset links, remove + reassign | |
| | Timeline, scorecards, volunteer-hours CSV, settings, Telegram bot | |

## How it works

- **Backend:** one file, [`apps-script/Code.gs`](apps-script/Code.gs), bound to a Google Sheet and deployed as an Apps Script web app. The Sheet *is* the database — tabs for Settings, People, Tasks, Log, Meetings, Rules, Milestones and Applications. It also sends email (MailApp) and runs an optional team-only Telegram bot.
- **Frontend:** a static site in [`docs/`](docs/) (plain ES modules, no build step), served by GitHub Pages and **shared by every Haven**. `?hub=<deployment id>` picks the Haven. Personal links add `&u=<name>&t=<secret>`; the site keeps that key in the browser and removes it from the address bar.
- **Auth:** long random per-person links, checked on the server for every action. Roles: admin, lead, member, guest viewer.
- **Brand:** colours, fonts (Darumadrop One, Jua, Nunito), logos and Daven come from HQ's [public Haven brand guide](https://www.figma.com/design/V1S8l3ju7K75ABGowht1gj/-PUBLIC--Haven-Brand-Guide).

## Repo

```
apps-script/Code.gs        the whole backend — paste it into Apps Script
apps-script/appsscript.json optional manifest
docs/                      the website (GitHub Pages: main /docs)
dev/                       local demo: Apps Script fakes + made-up data, python dev/serve.py
tests/                     node --test tests/*.test.mjs — runs the real Code.gs against the fakes
setup.md                   the setup guide
```

## Develop

```bash
python dev/serve.py                 # then open http://localhost:5178/docs/?demo=1
node --test tests/*.test.mjs
```

`?demo=1` runs the real `Code.gs` in the browser with made-up data (`&as=admin|lead|member|viewer|guest`, or `?demo=fresh#/setup`).

---

Built by the Haven Tashkent organizers for every Haven. Not an official Hack Club HQ product. MIT licence.
