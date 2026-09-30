/* SQLite storage for a self-hosted hub (built into Node 22.13+: node:sqlite). One file: data/hub.db */
import { DatabaseSync } from 'node:sqlite';

export function openStore(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS sheets  (name TEXT PRIMARY KEY, pos INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS props   (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS meta    (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS folders (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS files   (id TEXT PRIMARY KEY, folder TEXT, name TEXT, mime TEXT, descr TEXT, size INTEGER, created INTEGER);
    CREATE TABLE IF NOT EXISTS outbox  (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, payload TEXT NOT NULL,
                                        attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, sent_at INTEGER, error TEXT, created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS outbox_due ON outbox (sent_at, next_at);
    CREATE TABLE IF NOT EXISTS accounts (key TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, hash TEXT NOT NULL, retired TEXT NOT NULL DEFAULT '',
                                         fails INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, key TEXT NOT NULL, created INTEGER NOT NULL, last_used INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_key ON sessions (key);
  `);
  const q = sql => db.prepare(sql);
  const S = {
    db,
    // key/value tables
    getProp: k => { const r = q('SELECT v FROM props WHERE k = ?').get(k); return r ? r.v : null; },
    setProp: (k, v) => q('INSERT INTO props (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, String(v)),
    delProp: k => q('DELETE FROM props WHERE k = ?').run(k),
    allProps: () => Object.fromEntries(q('SELECT k, v FROM props').all().map(r => [r.k, r.v])),
    getMeta: (k, d = null) => { const r = q('SELECT v FROM meta WHERE k = ?').get(k); return r ? r.v : d; },
    setMeta: (k, v) => q('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, String(v)),
    delMeta: k => q('DELETE FROM meta WHERE k = ?').run(k),
    // sheets
    loadSheets: () => q('SELECT name, data FROM sheets ORDER BY pos').all().map(r => ({ name: r.name, data: JSON.parse(r.data) })),
    saveSheet: (name, pos, data) => q('INSERT INTO sheets (name, pos, data) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET pos = excluded.pos, data = excluded.data').run(name, pos, JSON.stringify(data)),
    deleteSheetsExcept: names => { const all = q('SELECT name FROM sheets').all().map(r => r.name); all.filter(n => !names.includes(n)).forEach(n => q('DELETE FROM sheets WHERE name = ?').run(n)); },
    // files
    addFolder: (id, name) => q('INSERT OR IGNORE INTO folders (id, name) VALUES (?, ?)').run(id, name),
    getFolder: id => q('SELECT * FROM folders WHERE id = ?').get(id),
    addFile: f => q('INSERT OR REPLACE INTO files (id, folder, name, mime, descr, size, created) VALUES (?, ?, ?, ?, ?, ?, ?)').run(f.id, f.folder, f.name, f.mime, f.descr || '', f.size, f.created || Date.now()),
    getFile: id => q('SELECT * FROM files WHERE id = ?').get(id),
    filesIn: folder => q('SELECT * FROM files WHERE folder = ? ORDER BY created').all(folder),
    setFileDescr: (id, d) => q('UPDATE files SET descr = ? WHERE id = ?').run(d, id),
    // outbox (emails + Telegram messages are sent after the request, with retries)
    enqueue: (kind, payload) => q('INSERT INTO outbox (kind, payload, next_at, created) VALUES (?, ?, ?, ?)').run(kind, JSON.stringify(payload), Date.now(), Date.now()),
    due: (limit = 20) => q('SELECT * FROM outbox WHERE sent_at IS NULL AND next_at <= ? ORDER BY id LIMIT ?').all(Date.now(), limit),
    markSent: id => q('UPDATE outbox SET sent_at = ?, error = NULL WHERE id = ?').run(Date.now(), id),
    markFailed: (id, attempts, err, retryAt) => q('UPDATE outbox SET attempts = ?, error = ?, next_at = ?, sent_at = ? WHERE id = ?').run(attempts, String(err).slice(0, 500), retryAt || Date.now(), retryAt ? null : -1, id),
    outboxStats: () => ({
      pending: q('SELECT COUNT(*) n FROM outbox WHERE sent_at IS NULL').get().n,
      failed24h: q('SELECT COUNT(*) n FROM outbox WHERE sent_at = -1 AND created > ?').get(Date.now() - 864e5).n,
      mails24h: q("SELECT COUNT(*) n FROM outbox WHERE kind = 'mail' AND created > ?").get(Date.now() - 864e5).n,
    }),
    pruneOutbox: () => q('DELETE FROM outbox WHERE sent_at IS NOT NULL AND created < ?').run(Date.now() - 30 * 864e5),
    // password accounts (hashes only) + sign-in sessions (sha256 of the session id only) — never in the tabs or the exports
    getAccount: key => q('SELECT * FROM accounts WHERE key = ?').get(key),
    accountByName: name => q('SELECT * FROM accounts WHERE username = ?').get(String(name)),
    accountByRetired: hash => q("SELECT * FROM accounts WHERE (',' || retired || ',') LIKE ?").get('%,' + hash + ',%'),
    saveAccount: a => q(`INSERT INTO accounts (key, username, hash, retired, fails, locked_until, created, updated) VALUES (?, ?, ?, ?, 0, 0, ?, ?)
      ON CONFLICT(key) DO UPDATE SET username = excluded.username, hash = excluded.hash, retired = excluded.retired, fails = 0, locked_until = 0, updated = excluded.updated`)
      .run(a.key, a.username, a.hash, a.retired || '', a.created || Date.now(), Date.now()),
    setAccountFails: (key, fails, lockedUntil) => q('UPDATE accounts SET fails = ?, locked_until = ? WHERE key = ?').run(fails, lockedUntil, key),
    dropAccount: key => { q('DELETE FROM accounts WHERE key = ?').run(key); q('DELETE FROM sessions WHERE key = ?').run(key); },
    addSession: (id, key, now, expires) => q('INSERT INTO sessions (id, key, created, last_used, expires) VALUES (?, ?, ?, ?, ?)').run(id, key, now, now, expires),
    getSession: id => q('SELECT * FROM sessions WHERE id = ?').get(id),
    touchSession: (id, now, expires) => q('UPDATE sessions SET last_used = ?, expires = ? WHERE id = ?').run(now, expires, id),
    dropSession: id => q('DELETE FROM sessions WHERE id = ?').run(id),
    dropSessions: (key, exceptId) => q('DELETE FROM sessions WHERE key = ? AND id != ?').run(key, exceptId || ''),
    pruneSessions: () => q('DELETE FROM sessions WHERE expires < ?').run(Date.now()),
    tx(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch (e2) { /* already rolled back */ } throw e; }
    },
    close: () => db.close(),
  };
  return S;
}
