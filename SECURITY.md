# Security

Haven Hub holds the names, contacts and work of teenage organizing teams, so we take reports seriously.

## Reporting a problem

Please **don't open a public issue** for a security problem. Use GitHub's **Security → Report a vulnerability** on this repository (private), or email the maintainer listed on the GitHub profile. Say what you found, how to reproduce it, and what someone could do with it. We'll answer within a few days.

## What is in scope

- `apps-script/Code.gs` — permissions (`ACTIONS` levels), what each role and the public page can read, the join form, Google sign-in checks.
- `server/` — sessions, passwords, reset links, Google token checks, the Telegram webhook, file serving (`/files/raw`, `/files/pub`), the admin socket.
- `docs/` — anything that could leak a personal link or token, or run someone else's script.

## How the hub protects people (short version)

- Personal links are 128-bit random tokens, checked by the backend on every request; reset makes the old one useless.
- Passwords (own server): scrypt; sessions and reset links are stored only as SHA-256 hashes; lockout after 5 wrong tries.
- Google sign-in: the ID token is verified with Google (signature, issuer, audience, expiry, single-use nonce); only verified emails match.
- The public page shows only what an admin switches on; team names are off by default. Proof files are private; only sponsor logos are public pictures.
- Exports leave out tokens, chat ids and Google ids. The server serves strict security headers (CSP, no framing, no referrer).

See [ARCHITECTURE.md](ARCHITECTURE.md) for the details.
