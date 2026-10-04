# Changelog

A hub keeps working when the website is newer than its backend: new pages appear once the hub's `Code.gs` lists the feature. To update a Google Sheet hub, paste the new `Code.gs` and deploy a **new version** of the same deployment ([setup.md → Updating](setup.md#updating)); on your own server run `hubctl deploy`.

## Unreleased

- **Referral page, part 1.** `apps-script/referrals/Code.gs` — a small separate web app on its own “Referrals” Sheet (`time · name · code`): a visitor opens `?code=…`, types their name, the row is saved and they go on to HQ's signup page with `?ref=<code>`, so HQ counts the referral. Set `SIGNUP_URL` and `EVENT_NAME` at the top for your city. It is not part of the hub backend.

## 4.5.1 — 2026-10-03

- **Last seen = the last time someone opened the hub.** Every visit stamps a new `last_seen` column in People (at most every 5 minutes); People, Team, the person pages, Scorecards (“Silent” = not on the hub for 5+ days) and the weekly report use it. Before, it was the last thing they *did*.
- Privacy and terms pages (`docs/privacy.html`, `docs/terms.html`) — Google asks for them before an OAuth app can be published.

## 4.5.0 — 2026-10-03

- **Showcase + guided tour.** The front page of the shared website is now a tour of what every role gets, with screenshots of the real app, and `?demo=1&tour=1` walks through it live — the real backend in the browser on a made-up team. The demo now lives in `docs/demo/`, so it works on GitHub Pages.
- **Sponsors page.** A logo gallery: drop a picture to add a sponsor (it is shrunk in the browser), set the kind, a public one-liner, a private note, order and visibility. Public sponsors appear as *Supported by* on the public page. *Copy for haven.hackclub.com* exports the `sponsors` block for the city page on HQ's site. Logos are public pictures: a public Drive folder, or `/files/pub/` on your own server.
- **Profile photos.** Everyone can add a photo (made small in the browser); admins can set anyone's. Shown next to names everywhere, never on the public page.
- **A page per person** (`#/team/<key>`): photo, job, contacts, open and finished tasks with proof, hours given, on-time rate and their latest activity; admins edit, reset and remove from there. The Team page is a grid of photo cards with progress for leads.
- **Applications know your team.** An applicant with the same email, Telegram username or name as someone on the team (or someone removed) is flagged — close it as theirs, give them a task, or open their page. A first name alone is a *maybe*.
- **Sign in with Google.** Optional, no Google script on the page. People connect Google in Profile, or match the verified email an admin saved; new people can *Sign up with Google* on the join form. Apps Script checks tokens with Google's `tokeninfo`; the server checks the signature itself (`server/google.mjs`).
- **Password reset links** (own server): *People → ⋯ → Send a password reset link* — by Telegram, email or copy; one use, 24 hours, keeps the username.
- Settings: *Sign in with Google* card with the exact addresses to register. `hubUrl_()` adds `?hub=` to links in admin messages. Neutral defaults (time zone `UTC`, example domains). GitHub Actions runs the tests.

## 4.4.0 — 2026-10-01
Change the team on the fly: unassigned tasks and *Take this task*, per-task handover when someone leaves, inline access and area in People, *Add several*, *Accept & invite*.

## 4.3.0 — 2026-10-01
Files: team links (Canva, Figma, Sheets…) plus a public team-files repo, and *What you need* on every task.

## 4.2.1 — 2026-10-01
A hub can move to its own domain; old `?hub=` links follow it.

## 4.2.0 — 2026-09-30
Task-change alerts, a month calendar, username + password sign-in on your own server, *Export CSV → Update the whole plan* with renumbering.

## 4.1.0 — 2026-09-30
Run Haven Hub on your own server: Node + SQLite, Cloudflare Tunnel, Telegram webhook, outbox, backups, `hubctl`, one-click move from a Google Sheet.

## 4.0.0 — 2026-09-30
The shareable Haven Hub: admin dashboard, roles, email reminders and invites, public event page, join form, guest viewers.
