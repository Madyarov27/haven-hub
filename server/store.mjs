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
    tx(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch (e2) { /* already rolled back */ } throw e; }
    },
    close: () => db.close(),
  };
  return S;
}
