/* Password sign-in for a self-hosted hub (Apps Script hubs keep personal links only).
   Code.gs never sees a password: the server checks it, keeps the sign-in session, and hands Code.gs the person's secret
   token for each request. Once someone makes a password their personal links stop working.
   Passwords: scrypt (N=2^15, r=8, p=1, 16-byte salt), stored as "scrypt$15$8$1$salt$hash". Sessions: only their sha256 is stored. */
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const LOG_N = 15, R = 8, P = 1, KEYLEN = 32, MAXMEM = 96 * 1024 * 1024;
const SESSION_MS = 90 * 864e5, LOCK_AFTER = 5, LOCK_MS = 15 * 60e3;
export const SESSION_RE = /^hs_[A-Za-z0-9_-]{40,}$/;
const USER_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const COMMON = new Set(['password', 'password1', 'password123', '12345678', '123456789', '1234567890', '87654321', 'qwerty12', 'qwerty123', 'qwertyuiop',
  '1q2w3e4r', '1q2w3e4r5t', 'asdfghjk', 'zxcvbnm1', 'iloveyou', 'letmein1', 'football', 'admin123', 'abc12345', 'abcd1234', 'haven2026', 'hackclub', 'tashkent',
  'uzbekistan', 'parol123', 'gamejam1']);
// an unknown username costs the same time as a real one, so timing doesn't tell who has an account
const DUMMY = 'scrypt$15$8$1$' + 'A'.repeat(22) + '$' + 'A'.repeat(43);

export const sha256 = s => createHash('sha256').update(String(s)).digest('hex');
const kdf = (pw, salt, n, r, p, len) => new Promise((ok, bad) => scrypt(String(pw).normalize('NFC'), salt, len, { N: 1 << n, r, p, maxmem: MAXMEM }, (e, k) => e ? bad(e) : ok(k)));

export async function hashPassword(pw) {
  const salt = randomBytes(16), k = await kdf(pw, salt, LOG_N, R, P, KEYLEN);
  return `scrypt$${LOG_N}$${R}$${P}$${salt.toString('base64url')}$${k.toString('base64url')}`;
}
export async function checkPassword(pw, stored) {
  const m = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([\w-]+)\$([\w-]+)$/.exec(String(stored || ''));
  if (!m || Number(m[1]) > 20) return false;
  const want = Buffer.from(m[5], 'base64url'), got = await kdf(pw, Buffer.from(m[4], 'base64url'), Number(m[1]), Number(m[2]), Number(m[3]), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}
export function usernameProblem(u) {
  return USER_RE.test(String(u || '')) ? '' : 'Username: 3–30 characters — small letters, digits, dot, dash or underscore.';
}
export function passwordProblem(pw, username) {
  pw = String(pw || '');
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (pw.length > 128) return 'That password is too long (max 128 characters).';
  if (username && pw.toLowerCase().includes(String(username).toLowerCase())) return 'Don\'t put your username in your password.';
  if (COMMON.has(pw.toLowerCase()) || /^(.)\1+$/.test(pw) || /^(0123456789|123456789|abcdefgh)/i.test(pw)) return 'That password is too easy to guess. Try a short sentence you will remember.';
  return '';
}

export function createAccounts({ store }) {
  return {
    /** { username } of this person's account, or null */
    info(key) { const a = key && store.getAccount(key); return a ? { username: a.username } : null; },
    drop(key) { store.dropAccount(key); },
    /** Someone used a link that was switched off when they made a password → { key, username } */
    retired(token) { const a = token && store.accountByRetired(sha256(token)); return a ? { key: a.key, username: a.username } : null; },
    async create(key, username, password, oldToken) {
      const hash = await hashPassword(password);
      return () => { // runs inside the request's transaction, together with the token change
        if (store.getAccount(key)) return 'You already have an account — change your password in Profile.';
        if (store.accountByName(username)) return 'That username is taken — pick another one.';
        store.saveAccount({ key, username, hash, retired: sha256(oldToken) });
        return '';
      };
    },
    newSession(key) {
      const id = 'hs_' + randomBytes(32).toString('base64url'), now = Date.now();
      store.addSession(sha256(id), key, now, now + SESSION_MS);
      return id;
    },
    /** session id → person key ('' if unknown or expired). Sessions last 90 days from the last use. */
    session(id) {
      if (!SESSION_RE.test(String(id || ''))) return '';
      const h = sha256(id), s = store.getSession(h), now = Date.now();
      if (!s) return '';
      if (s.expires < now) { store.dropSession(h); return ''; }
      if (now - s.last_used > 3600e3) store.touchSession(h, now, now + SESSION_MS);
      return s.key;
    },
    endSession(id) { if (SESSION_RE.test(String(id || ''))) store.dropSession(sha256(id)); },
    endOtherSessions(key, keepId) { store.dropSessions(key, keepId ? sha256(keepId) : ''); },
    /** 5 wrong passwords in a row lock the account for 15 minutes. Same answer for unknown usernames. */
    async login(account, password) {
      const now = Date.now(), a = account || null;
      if (a && a.locked_until > now) return { ok: false, error: 'Too many wrong passwords — try again in 15 minutes, or ask your lead to reset your sign-in.' };
      const good = await checkPassword(password, a ? a.hash : DUMMY);
      if (!a || !good) {
        if (a) { const f = a.fails + 1; store.setAccountFails(a.key, f >= LOCK_AFTER ? 0 : f, f >= LOCK_AFTER ? now + LOCK_MS : 0); }
        return { ok: false, error: 'Wrong username or password.' };
      }
      if (a.fails || a.locked_until) store.setAccountFails(a.key, 0, 0);
      return { ok: true, key: a.key };
    },
    async setPassword(key, current, password) {
      const a = store.getAccount(key);
      if (!a) return 'You don\'t have a password yet.';
      if (!(await checkPassword(current, a.hash))) return 'Your current password is wrong.';
      const bad = passwordProblem(password, a.username);
      if (bad) return bad;
      store.saveAccount(Object.assign({}, a, { hash: await hashPassword(password) }));
      return '';
    },
  };
}
