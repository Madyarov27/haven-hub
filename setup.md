# Set up Haven Hub for your Haven

**Time:** about 10 minutes, once. **Cost:** free. **You need:** a Google account you'll keep after the event.

Haven Hub gives your organizing team:

- **A task list for every organizer.** Steps, a deadline, who to ask, and one button each for **Start**, **Done** (with a photo, file or link as proof) and **I'm blocked**.
- **An admin dashboard for you.** It has an overview, an all-tasks table with bulk edits and CSV import, proof review, a timeline, scorecards, and people management.
- **Reminders.** People get one the evening before each deadline, by email and/or a Telegram bot. Leads get instant BLOCKED alerts and a weekly report.
- **A public page for your event.** It shows a countdown, your signup link, your organizing progress and a **Join the team** form.
- **Guest links.** HQ, a mentor or a sponsor can get a read-only view of your progress.

Everything is stored in **a Google Sheet that you own**. The website is shared by every Haven, but it only shows your data to people who have one of your links.

> **Try it first:** the setup wizard is at **https://notazizelse.github.io/haven-hub/#/setup**. It shows every step below with buttons.

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

---

## Daily use

| I want to… | Do this |
|---|---|
| Give someone a task | **All tasks → New task.** Pick one or several people — each gets their own copy and a message |
| Give the same tasks to a lot of people | **All tasks → Import CSV.** Download the template, fill it in, press **Check**, then **Import** |
| Move deadlines or hand tasks over | **All tasks** → tick the tasks → **Shift days** / **Reassign to…** in the bar at the bottom |
| See what's stuck | **Overview → Needs attention** (blocked first, then overdue) |
| Check proof | **Review** → **Approve**, or **Ask for a redo** (they're told what to fix) |
| Add meetings, team rules, milestones | **Meetings & rules** |
| Someone leaves | **People → ⋯ → Remove from the team.** Hand their open tasks to their backup in the same step |
| A link was shared by mistake | **People → ⋯ → Reset link.** The old link stops working immediately |
| Someone lost their link | They use **Organizer sign-in → Email me my link**, or you use **People → ⋯ → Get link** |
| Get the volunteer-hours list for HQ | **People → Volunteer hours (CSV)** |
| Back up everything | **Settings → Export all data**, or just open the Sheet |
| I lost my admin link | Open your Sheet → menu **Haven Hub → Show admin links** |

The golden rule for leads: **never take a task back yourself.** Help the owner, or reassign it to their backup.

---

## Updating

When a new version comes out, admins see an *Update available* banner. Updating takes 2 minutes and keeps all your data and links:

1. Copy the new [`apps-script/Code.gs`](apps-script/Code.gs).
2. In your Sheet, click **Extensions → Apps Script**, select everything in `Code.gs`, and paste over it. Save.
3. Click **Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy**.

**The URL stays the same, so nobody needs a new link.** Don't click *New deployment* — that would create a new URL.

Coming from the first Team Hub (v3)? Paste v4 and deploy a new version as above. The Sheet upgrades itself on the first request: it adds the new columns and keeps every token and Telegram connection. Leads become admins. Then check **Settings**.

---

## Run your own copy of the website (optional)

You don't need to — the shared site works for every Haven. But if you want your own address:

1. Fork **github.com/notazizelse/haven-hub**.
2. Go to **Settings → Pages → Deploy from a branch → `main` / `/docs`**.
3. In `docs/config.js`, set `defaultHub` to your deployment ID (the `AKfy…` part of your Web app URL). Links then work without `?hub=`.
4. In the hub, set **Settings → Hub & data → Website address** to your new address. Every personal link updates.
5. **Custom domain:** add a `CNAME` record pointing to `<your-github-name>.github.io`, then set it in **GitHub → Settings → Pages → Custom domain**.

---

## Privacy and safety

Most people on a Haven team are 13–18, so the hub is built to collect as little as possible:

- **Your data stays in your Google Sheet.** The shared website stores nothing. It only passes requests between people's browsers and your Sheet.
- **Links are keys, not passwords.** They're long random codes. If one leaks, reset it; the hub removes it from the address bar after opening.
- **The public page** shows only what you switch on. Team names are off by default.
- **Guest viewers** never see proof photos, contact details or notes.
- **Email and Telegram messages only go to people in your People tab.** The join form never emails the person who filled it in, so nobody can use your hub to send spam.
- **Proof photos** are stored in a private folder in your Google Drive (*"… — Team Hub proof files"*). Only leads, and the person who uploaded a photo, can open it through the hub.
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

Then open `http://localhost:5178/docs/?demo=1`. The demo runs the **real `Code.gs`** in your browser against in-memory fakes (`dev/gas-fakes.js`), filled with made-up data (`dev/demo-data.js`).

- To see another role, add `&as=admin`, `lead`, `member`, `viewer` or `guest` to the URL.
- `?demo=fresh#/setup` walks the setup wizard.

**Tests** (the real `Code.gs`, run in Node 18+):

```bash
node --test tests/*.test.mjs
```

**Releasing a backend change:**
1. Bump `HUB_VERSION` in `Code.gs` and `latestBackend` in `docs/config.js`.
2. Bump the `?v=` in `docs/index.html`.
3. Keep old API names working (the `ACTIONS` table has aliases), because hubs update at different times.
