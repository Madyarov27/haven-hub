# Set up Haven Hub for your Haven

**Time:** about 10 minutes, once. **Cost:** free. **You need:** a Google account you'll keep after the event.

Haven Hub gives your organizing team:

- **A task list for every organizer.** Steps, a deadline, who to ask, and one button each for **Start**, **Done** (with a photo, file or link as proof) and **I'm blocked**.
- **An admin dashboard for you.** It has an overview, an all-tasks table with bulk edits and CSV import, proof review, a timeline, scorecards, and people management.
- **Reminders.** People get one the evening before each deadline, by email and/or a Telegram bot. Leads get instant BLOCKED alerts and a weekly report.
- **A public page for your event.** It shows a countdown, your signup link, your organizing progress and a **Join the team** form.
- **Guest links.** HQ, a mentor or a sponsor can get a read-only view of your progress.
- **A team page with a page per person** — photos, roles, their work and their latest activity.
- **A sponsors gallery.** Drop a logo and it shows on your public page; one click copies the sponsors block for your city page on haven.hackclub.com.
- **Sign-in your way.** Personal links to start; then “Sign in with Google” or a password, and a one-time reset link when someone forgets.

Everything is stored in **a Google Sheet that you own**. The website is shared by every Haven, but it only shows your data to people who have one of your links.

> **Try it first:** take the **[2-minute guided tour](https://notazizelse.github.io/haven-hub/?demo=1&tour=1)** — the real app on a made-up team, nothing is saved. The setup wizard is at **https://notazizelse.github.io/haven-hub/#/setup**; it shows every step below with buttons. How the parts fit together: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## How it fits together

```
Your Google Sheet ── the database. You can open it and edit it by hand.
   └─ Apps Script (Code.gs) ── the hub's server. It runs as you, for free, inside your Google account.
          ▲
          │  personal links: https://notazizelse.github.io/haven-hub/?hub=<your id>&u=<name>&t=<secret>
          │
The website (shared by all Havens) ── what everyone opens on their phone or laptop.
```

---

## Step 1 — Make your copy of the Sheet

**Option A: template (fastest).** Open the template link in the setup wizard, then click **Make a copy**. The code comes with it. Keep the new tab open.

**Option B: by hand (2 extra minutes)**

1. Open **[sheets.new](https://sheets.new)** and name the Sheet, for example *Haven Springfield — Team Hub*.
2. Click **Extensions → Apps Script**.
3. Delete everything in `Code.gs`.
4. Paste the whole of [`apps-script/Code.gs`](apps-script/Code.gs). The wizard has a **Copy Code.gs** button for this.
5. Press **Save** (Ctrl+S).

## Step 2 — Deploy it as a web app

1. In your Sheet, click **Extensions → Apps Script**.
2. Top right, click **Deploy → New deployment**.
3. Click the ⚙ gear next to *Select type* and choose **Web app**.
4. Set **Execute as** to **Me** and **Who has access** to **Anyone**. Then click **Deploy**.
5. Click **Authorize access** and pick your account.
6. Google warns *"Google hasn't verified this app"*. That's normal for a script you made yourself. Click **Advanced → Go to … (unsafe) → Allow**.
7. Copy the **Web app URL**. It starts with `https://script.google.com/macros/s/AKfy…` and ends with **`/exec`**.

> **Why "Anyone"?** It means anyone can *reach* the hub. The hub still only answers people with a personal link, and it only shows the public-page fields you choose. Nobody gets access to your Google account or your Drive.

## Step 3 — Connect it and name your event

1. Open **https://notazizelse.github.io/haven-hub/#/setup**.
2. Paste the Web app URL. The wizard checks it.
3. Paste the address of **your Sheet**, copied from the browser bar. This proves the hub is yours: only the person who can open the Sheet can claim it.
4. Enter your event name, city, dates, time zone, your name and (optionally) your email.
5. Choose whether you want:
   - **the Haven starter checklist:** 13 tasks with dates counted back from your event, plus team rules and milestones;
   - **the public page;**
   - **the join form.**
6. Click **Create my hub**.

You now have **your admin link**. Bookmark it — it's your key. If you gave your email, it was also sent to you.

## Step 4 — Add your team

1. Go to **Dashboard → People → Add organizer**.
2. Fill in their name and role, plus an email and/or Telegram username if you have them.
3. Leave **Email them their link now** on, or send the link yourself: copy the ready-made message, or use **Share on Telegram**.

Each person opens their link and sees **only their own tasks**. They don't need an account or a password.

**Access levels:**

| Access | Can do |
|---|---|
| **Member** | See and report their own tasks |
| **Lead** | Everything a member can, plus: see all tasks, add, edit, import and bulk-edit tasks, approve proof or ask for a redo |
| **Admin** | Everything a lead can, plus: manage people, applications, meetings, rules, milestones and settings |
| **Guest viewer** | Read-only overview, timeline, scorecards, calendar and team. No proof photos, contacts or notes. Good for HQ, a mentor or a sponsor |

## Step 5 — Reminders (on already) and the Telegram bot (optional)

- **Email reminders** work straight away. They go to people who haven't connected Telegram. Free Gmail can send **100 emails a day**.
- **To add the Telegram bot** (3 minutes):
  1. In Telegram, open **@BotFather**, send `/newbot`, and name it after your event.
  2. Copy the token (it looks like `123456789:AAE…`) → **Dashboard → Settings → Telegram bot** → paste it → **Save token**.
  3. Everyone opens **Profile → Connect Telegram → Start**.
  4. Add the bot to your organizer group and send **`/setgroup`** there (you need to be a lead). The bot then posts BLOCKED alerts, finished tasks, new tasks and a daily digest in that group. Team members can also report with `T014 DONE — link` or `T014 BLOCKED — what I need`.
  5. For `T014 DONE` messages to work: **BotFather → /mybots → your bot → Bot Settings → Group Privacy → Turn off**.

The bot only ever talks to people on your team, and ignores everyone else.

## Step 6 — Public page and join form (optional)

Go to **Settings → Public page** and copy your public link: `https://notazizelse.github.io/haven-hub/?hub=<your id>`. Put it in your Instagram bio, on posters and in your Telegram channel.

**What guests see:**
- your event name, dates and a countdown;
- your signup link — use **your city's page on haven.hackclub.com**, because HQ's form is what counts for funding;
- your social links;
- the **% of organizing tasks done** and any milestones you marked *Public*;
- the **Join the team** form.

**Team names are hidden unless you turn them on.** Most organizers are under 18, so ask them first.

Join-form answers appear in **Dashboard → Applications**. Accepting someone opens *Add organizer* already filled in. If someone is 19+, the hub reminds you of HQ's age rule: they can't organize or take part, but they can mentor or volunteer.

If the person is **already on the team** (same email, Telegram username or name), the application says so: close it as theirs, give them a task in that area, or open their page — nobody gets a second account. A first name alone is only flagged as a *maybe*.

## Step 7 — Sponsors (optional)

**Dashboard → Sponsors → drop a logo** (PNG, JPG, WebP or SVG). The website shrinks it, you name the sponsor, pick the kind (*Prize sponsor*, *In-kind*, *Venue*, *Partner*…) and an optional one-line “what they give”. Public sponsors appear as **Supported by** on your public page; switch *Show on the public page* off while you wait for their OK to name them.

- Uploaded logos are the only public pictures in the hub: a Google Sheet hub keeps them in a Drive folder shared *anyone with the link* (*"… — public pictures (sponsor logos)"*); your own server serves them at `/files/pub/…`. If your Google account doesn't allow public files (some school accounts), small logos are kept in the Sheet instead.
- **Copy for haven.hackclub.com** gives you the `sponsors` part of your city page document ([SITE_DATA.md](https://github.com/hackclub/haven/blob/main/SITE_DATA.md)) with the same logos and links.
- Only add sponsors who confirmed **in writing**.

## Step 8 — Sign in with Google (optional, 5 minutes)

People can then sign in with their Google account, and new people can **Sign up with Google** on the join form (their name and email come filled in and verified). It works without any Google script on the page: the browser goes to accounts.google.com and comes back with a signed token that the hub checks with Google.

1. Open **[Google Cloud → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)** (any Google account; create a project when asked).
2. **OAuth consent screen:** *External*, app name e.g. *Haven Springfield Team Hub*, scopes `openid`, `email`, `profile`. Then **Publish app** (*In production*). These basic scopes need no Google review.
3. **Create credentials → OAuth client ID → Web application.** Add the two addresses that **Dashboard → Settings → Sign in with Google** shows you (with copy buttons):
   - *Authorized JavaScript origins:* your website's origin, e.g. `https://notazizelse.github.io`
   - *Authorized redirect URIs:* the website address, e.g. `https://notazizelse.github.io/haven-hub/`
4. Copy the **Client ID** (`…apps.googleusercontent.com`) into **Settings → Sign in with Google**. On your own server instead run `~/haven/hubctl set-secret GOOGLE_CLIENT_ID` and paste it.

**Who can sign in with Google:** someone who connected Google in **Profile → Sign in with Google**, or whose Gmail address you saved in **People** (Google must say the address is verified). Anyone else is told they are not on the team yet and can apply with one click. On your own server, a person's personal link stops working once they connect Google — like after making a password.

---

## Daily use

| I want to… | Do this |
|---|---|
| Give someone a task | **All tasks → New task.** Pick one or several people — each gets their own copy and a message |
| Give the same tasks to a lot of people | **All tasks → Import CSV.** Download the template, fill it in, press **Check**, then **Import** |
| Move deadlines or hand tasks over | **All tasks** → tick the tasks → **Shift days** / **Reassign to…** in the bar at the bottom. Everyone affected gets a message (switch off **Tell people** for silent fixes) |
| Rework the whole plan | **All tasks → Export CSV**, edit it in Sheets/Excel (keep the `id` column; empty id = new task), then **Import CSV → Update the whole plan → Check → Apply**. You see every change per person first; you can drop tasks missing from the file and renumber everything by date. Each person gets one message |
| See what's stuck | **Overview → Needs attention** (blocked first, then overdue) |
| Check proof | **Review** → **Approve**, or **Ask for a redo** (they're told what to fix) |
| Add meetings, team rules, milestones | **Meetings & rules** |
| Someone leaves | **People → ⋯ → Remove from the team.** Hand their open tasks to their backup in the same step |
| A link was shared by mistake | **People → ⋯ → Reset link.** The old link stops working immediately |
| Someone forgot their password (own server) | **People → ⋯ → Send a password reset link.** Send it on Telegram, by email, or copy it. It works once, for 24 hours; their username and Telegram stay. (**Reset sign-in** starts over completely with a new link) |
| See everything about someone | **Team → click them** (or People → click the row): their job, contacts, open and finished tasks with proof, hours and latest activity. Admins edit, reset and remove from there |
| Add a sponsor | **Sponsors → drop the logo** → name it → Save. **Copy for haven.hackclub.com** for HQ's city page |
| Add my photo | **Profile → Add your photo** (or the camera on your page). Admins can set anyone's from their page |
| Someone lost their link | They use **Organizer sign-in → Email me my link**, or you use **People → ⋯ → Get link** |
| Get the volunteer-hours list for HQ | **People → Volunteer hours (CSV)** |
| Back up everything | **Settings → Export all data**, or just open the Sheet |
| I lost my admin link | Open your Sheet → menu **Haven Hub → Show admin links** |

**Task-change messages.** When a task is added, deleted, dropped, moved to someone else, gets a new date or new wording, its owner hears about it (Telegram, or email when Telegram isn't connected) and every admin gets one short summary saying who was told how — or who couldn't be reached. On your own server, quick edits are bundled: the messages go out once nobody has edited for a minute. Switch it off in **Settings → Reminders → Tell people when their tasks change**, or per change with the **Tell people** switch.

The golden rule for leads: **never take a task back yourself.** Help the owner, or reassign it to their backup.

---

## Updating

When a new version comes out, admins see an *Update available* banner. Updating takes 2 minutes and keeps all your data and links:

1. Copy the new [`apps-script/Code.gs`](apps-script/Code.gs).
2. In your Sheet, click **Extensions → Apps Script**, select everything in `Code.gs`, and paste over it. Save.
3. Click **Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy**.

**The URL stays the same, so nobody needs a new link.** Don't click *New deployment* — that would create a new URL.

On your own server, run `~/haven/hubctl deploy` instead.

Coming from the first Team Hub (v3)? Paste v4 and deploy a new version as above. The Sheet upgrades itself on the first request: it adds the new columns and keeps every token and Telegram connection. Leads become admins. Then check **Settings**.

---

## Run your own copy of the website (optional)

You don't need to — the shared site works for every Haven. But if you want your own address:

1. Fork **github.com/notazizelse/haven-hub**.
2. Go to **Settings → Pages → Deploy from a branch → `main` / `/docs`**.
3. In `docs/config.js`, set `defaultHub` to your deployment ID (the `AKfy…` part of your Web app URL). Links then work without `?hub=`.
4. In the hub, set **Settings → Hub & data → Website address** to your new address. Every personal link updates.
5. **Custom domain:** add a `CNAME` record pointing to `<your-github-name>.github.io`, then set it in **GitHub → Settings → Pages → Custom domain**.

## Run it on your own server (optional)

Have a Linux server or VPS? The same `Code.gs` can run there on Node, with SQLite as the database. It gives you:
- instant Telegram replies (a webhook instead of checking every minute);
- no Google limits (email, timers, 1–3 s page loads);
- your own domain.

It needs **a normal user account**: no root, no Docker, no open ports. Cloudflare Tunnel makes the outgoing connection that puts the hub on your domain with HTTPS.

**1. Install (about 5 minutes, as your normal user):**

```bash
mkdir -p ~/haven/bin && cd ~/haven
curl -fsSL https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-x64.tar.xz | tar -xJ && mv node-v24.21.0-linux-x64 node
curl -fsSL -o bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && chmod +x bin/cloudflared
git clone https://github.com/notazizelse/haven-hub app && (cd app && PATH=~/haven/node/bin:$PATH npm ci --omit=dev)
ln -s ~/haven/app/server/hubctl ~/haven/hubctl && cp app/server/env.example .env && chmod 600 .env
```

Then edit `~/haven/.env`: set `PUBLIC_URL` (your domain), `HUB_TZ`, `SMTP_USER` / `SMTP_PASS` (a Gmail App Password), and `CF_TUNNEL_TOKEN` (see step 2).

```bash
~/haven/hubctl start && ~/haven/hubctl install-cron
```

The cron job restarts the hub after a reboot and checks it every 2 minutes.

**2. Put it on your domain (Cloudflare, free):**
1. Add your domain to Cloudflare.
2. At your registrar, change the domain's **nameservers** to the two Cloudflare gives you.
3. Go to **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**. Copy the token into `CF_TUNNEL_TOKEN`.
4. In the tunnel, add a **Public hostname**: your domain → `http://localhost:8787`.
5. Run `~/haven/hubctl restart`.

No domain yet? `QUICK_TUNNEL=1` gives a temporary `https://….trycloudflare.com` address for testing. It changes on every restart.

**3. Either start a new hub, or move your existing Google Sheet hub:**
- **New hub:** open your domain → **Set up** → paste the code from `~/haven/hubctl setup-code`.
- **Move an existing hub:**
  1. Run `~/haven/hubctl import-code`.
  2. In your Sheet, click **Haven Hub → Move this hub to my own server…** and paste your domain and the code.
  3. People, tasks, personal links, Telegram connections, the bot and the proof photos all move. The Sheet becomes a frozen backup, and every old link forwards to the new address.
  4. To undo: clear `moved_to` in the Sheet's Settings tab, then **Haven Hub → Turn on reminders**.

**Every day:**

| Command | Does |
|---|---|
| `hubctl status` | Is it up? People, tasks, messages waiting, last backup |
| `hubctl logs` / `hubctl logs tunnel` | What happened |
| `hubctl deploy` | Update to the newest version (git pull, then restart — about 2 s) |
| `hubctl admin-links` | Lost your admin link |
| `hubctl reset-link KEY` | A personal link leaked, or someone (you too) forgot their password: prints a fresh link |
| `hubctl backup` | Take a backup now |
| `hubctl set-webhook` | Point the Telegram bot at the server again |

**Username + password sign-in (own server only).** Organizers open their personal link once, then **Profile → Make your password**. From then on they sign in at the hub with their username (or email) and password — the browser can save it — and **their personal links stop working**; messages link to the sign-in page instead. Passwords are stored only as scrypt hashes in the server's database (never in the tabs or exports); 5 wrong tries lock an account for 15 minutes. Forgot it? An admin uses **People → ⋯ → Send a password reset link** (one-time, 24 hours; the server keeps only its hash).

**Sign in with Google on your own server:** set `GOOGLE_CLIENT_ID` (`hubctl set-secret GOOGLE_CLIENT_ID`) — see **Step 8**. The server checks Google's signature itself against Google's published keys; no Google library is needed.

**Backups:**
- **Nightly:** `~/haven/backups/hub-YYYY-MM-DD.db` (the last 14 are kept), plus the proof files.
- **Weekly:** admins get an emailed export every Sunday.
- **To restore:** run `hubctl stop`, copy a backup over `~/haven/data/hub.db`, then run `hubctl start`.

---

## Privacy and safety

Most people on a Haven team are 13–18, so the hub is built to collect as little as possible:

- **Your data stays in your Google Sheet.** The shared website stores nothing. It only passes requests between people's browsers and your Sheet.
- **Links are keys, not passwords.** They're long random codes. If one leaks, reset it; the hub removes it from the address bar after opening.
- **The public page** shows only what you switch on. Team names are off by default.
- **Guest viewers** never see proof photos, contact details or notes.
- **Email and Telegram messages only go to people in your People tab.** The join form never emails the person who filled it in, so nobody can use your hub to send spam.
- **Proof photos** are stored in a private folder in your Google Drive (*"… — Team Hub proof files"*). Only leads, and the person who uploaded a photo, can open it through the hub.
- **Profile photos** are small pictures kept in the People tab. The team sees them; they never appear on the public page.
- **Sponsor logos** are the only public pictures (see Step 7).
- **Google sign-in** only tells the hub a person's Google id, name, email and picture. The hub never sees a Google password and asks for no other access.
- **HQ age rule:** anyone 19 or older at the event can't organize or take part — only mentor or volunteer.

---

## Troubleshooting

| You see | Fix |
|---|---|
| *"This link doesn't work (any more)"* | The link was reset, or the person was removed. Send a fresh one from **People → ⋯ → Get link** |
| *"Could not reach the hub"* | Check your internet. If it keeps happening: the deployment must be **Who has access: Anyone**, and the URL must end in `/exec` |
| *"The hub answered with a web page instead of data"* | Same as above. Also make sure you deployed a **Web app**, not an API executable |
| *"This hub needs an update"* | The website is newer than your Code.gs. See **Updating** above |
| Setup says *"That is not the Google Sheet this hub runs on"* | Paste the address of the Sheet whose **Extensions → Apps Script** you deployed |
| Setup says the hub is *already set up* | Use your admin link. Lost it? In the Sheet: **Haven Hub → Show admin links** |
| No reminders arrive | **Settings → About → Run a health check.** If reminders are off: in the Sheet, **Haven Hub → Turn on reminders** |
| The bot is silent | **Settings → Telegram bot → Check the bot.** It lists exactly what's wrong |
| Dates look an hour off | Check **Settings → Event → Time zone** |
| I changed Code.gs but nothing changed | You need to deploy a **New version** (see **Updating**) |

Still stuck? Open an issue on [GitHub](https://github.com/notazizelse/haven-hub/issues).

---

## For maintainers

**Publishing the template Sheet** (so others can use Option A):

1. Create a Sheet with `Code.gs` pasted in (Option B, steps 1–5). **Don't set it up or deploy it.**
2. Click **Share → General access → Anyone with the link → Viewer**.
3. Copy the Sheet's URL and replace `/edit…` at the end with `/copy`.
4. Put that link in `docs/config.js` as `templateSheet`.

**Develop locally.** No build step and no dependencies:

```bash
python dev/serve.py
```

Then open `http://localhost:5178/docs/?demo=1`. The demo runs the **real `Code.gs`** in your browser against in-memory fakes (`docs/demo/gas-fakes.js`), filled with made-up data (`docs/demo/demo-data.js`). It runs on GitHub Pages too — that is the guided tour (`?demo=1&tour=1`) — from `docs/demo/Code.gs`, a copy kept in step by `npm run sync` (a test fails while they differ).

- To see another role, add `&as=admin`, `lead`, `member`, `viewer` or `guest` to the URL.
- `?demo=fresh#/setup` walks the setup wizard.
- `node dev/screenshots.mjs` (with the dev server running) redraws the screenshots on the showcase page from the demo, using your installed Chrome or Edge.

**Tests** (the real `Code.gs`, run in Node 22.13+; GitHub Actions runs them on every push and pull request):

```bash
node --test tests/*.test.mjs
```

**Releasing a backend change:**
1. Bump `HUB_VERSION` in `Code.gs`, `latestBackend` in `docs/config.js`, `version` in `docs/release.js` and `package.json`.
2. Bump the `?v=` in `docs/index.html`, run `npm run sync`, and add a `CHANGELOG.md` entry.
3. Keep old API names working (the `ACTIONS` table has aliases), and show new pages only when the backend lists the feature (`FEATURES` in Code.gs), because hubs update at different times.

**The shared Google sign-in client** (optional): to let Sheet hubs on the shared website use Google without their own client, the maintainer creates one OAuth client with origin `https://notazizelse.github.io` and redirect URI `https://notazizelse.github.io/haven-hub/`, and puts its id in `SHARED_GOOGLE_CLIENT_ID` in Code.gs.
