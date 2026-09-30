/* The Google Apps Script services Code.gs uses, implemented on top of SQLite + the file system,
   so the very same Code.gs runs on your own server. Everything here is synchronous (like Apps Script);
   anything slow (email, Telegram) goes into the outbox and is sent right after the request. */
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FakeSheet, FakeSpreadsheet, builder, formatDate, b64encode, b64decode } from '../dev/gas-fakes.js';

const newId = () => randomBytes(24).toString('base64url'); // Drive-like: 32 chars of [A-Za-z0-9_-]

export function createRuntime({ store, filesDir, env, telegram }) {
  // ------------------------------------------------------------------ spreadsheet (all tabs live in memory, saved per request)
  let ss;
  const load = () => {
    const rows = store.loadSheets();
    ss = new FakeSpreadsheet(store.getMeta('ss_id') || (() => { const id = 'srv-' + newId(); store.setMeta('ss_id', id); return id; })(),
      rows.length ? rows.map(r => new FakeSheet(r.name, r.data)) : [new FakeSheet('Sheet1')]);
    ss.url = '';
    ss.name = store.getMeta('ss_name', 'Haven Hub');
    ss.sheets.forEach(s => { s.dirty = false; });
    ss.structureDirty = !rows.length;
  };
  load();
  const persist = () => {
    const names = ss.sheets.map(s => s.name);
    ss.sheets.forEach((s, i) => { if (s.dirty || ss.structureDirty) { store.saveSheet(s.name, i, s.data); s.dirty = false; } });
    if (ss.structureDirty) { store.deleteSheetsExcept(names); store.setMeta('ss_name', ss.name); ss.structureDirty = false; }
  };
  /** Runs fn in one database transaction; on an exception everything is rolled back and reloaded. */
  const withTx = fn => {
    try { return store.tx(() => { const r = fn(); persist(); return r; }); }
    catch (e) { load(); throw e; }
  };
  /** Replaces every tab (used by the one-time import from a Google Sheet). */
  const replaceSheets = sheets => {
    ss.sheets = Object.keys(sheets).map(n => { const s = new FakeSheet(n, sheets[n].map(r => r.map(v => (v === null || v === undefined) ? '' : String(v)))); s.dirty = true; return s; });
    if (!ss.sheets.length) ss.sheets = [new FakeSheet('Sheet1')];
    ss.structureDirty = true;
  };

  // ------------------------------------------------------------------ blobs + files (proof photos live in data/files)
  const blob = (bytes, mime, name, fileId) => {
    let buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
    return { fileId, getBytes: () => buf, getContentType: () => mime, getName: () => name, setName(n) { name = n; return this; } };
  };
  const cache = new Map();
  let folderObj;
  const fileObj = row => ({
    getId: () => row.id, getName: () => row.name, getDescription: () => row.descr || '',
    setDescription(d) { row.descr = d; store.setFileDescr(row.id, d); return this; },
    getBlob: () => blob(readFileSync(join(filesDir, row.id)), row.mime, row.name, row.id),
    getParents: () => { const f = [folderObj(row.folder)]; let i = 0; return { hasNext: () => i < f.length, next: () => f[i++] }; },
  });
  folderObj = id => {
    const row = store.getFolder(id); if (!row) throw new Error('No such folder');
    return {
      getId: () => id, getUrl: () => '', getName: () => row.name,
      createFile(b) {
        const fid = newId(), bytes = b.getBytes();
        writeFileSync(join(filesDir, fid), bytes);
        const r = { id: fid, folder: id, name: b.getName(), mime: b.getContentType(), descr: '', size: bytes.length, created: Date.now() };
        store.addFile(r); return fileObj(r);
      },
      getFiles() { const all = store.filesIn(id).map(fileObj); let i = 0; return { hasNext: () => i < all.length, next: () => all[i++] }; },
    };
  };

  // ------------------------------------------------------------------ Telegram (sends go to the outbox; lookups come from a cache)
  const tgResp = o => ({ getContentText: () => JSON.stringify(o), getResponseCode: () => 200 });
  const serialize = opts => {
    if (typeof opts.payload === 'string') return JSON.parse(opts.payload || '{}');
    const out = {};
    Object.entries(opts.payload || {}).forEach(([k, v]) => {
      if (v && typeof v.getBytes === 'function') out[k] = v.fileId ? { __file: v.fileId, name: v.getName(), mime: v.getContentType() } : { __b64: b64encode(v.getBytes()), name: v.getName(), mime: v.getContentType() };
      else out[k] = v;
    });
    return out;
  };

  const gas = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss, getActive: () => ss, flush() {},
      newDataValidation: () => builder(() => ({})), newConditionalFormatRule: () => builder(() => ({})),
      InterpolationType: { NUMBER: 'NUMBER' },
      getUi: () => { throw new Error('No spreadsheet menu on the server — use: hubctl <command>'); },
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => store.getProp(k), setProperty(k, v) { store.setProp(k, v); return this; },
      deleteProperty(k) { store.delProp(k); return this; }, getProperties: () => store.allProps() }) },
    CacheService: { getScriptCache: () => ({
      get: k => { const x = cache.get(k); if (!x) return null; if (x.exp < Date.now()) { cache.delete(k); return null; } return x.v; },
      put(k, v, s) { cache.set(k, { v: String(v), exp: Date.now() + (s || 600) * 1000 }); }, remove(k) { cache.delete(k); } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {}, hasLock: () => true }) }, // requests already run one at a time
    Utilities: { formatDate, getUuid: () => randomUUID(), base64Encode: b64encode, base64Decode: s => Buffer.from(s, 'base64'), newBlob: (b, m, n) => blob(b, m, n), sleep() {} },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: s => ({ content: s, setMimeType() { return this; }, getContent() { return this.content; } }) },
    HtmlService: { createHtmlOutput: () => builder(() => null) },
    MailApp: {
      sendEmail(o) {
        store.enqueue('mail', { to: o.to, subject: o.subject, body: o.body, htmlBody: o.htmlBody, name: o.name,
          attachments: (o.attachments || []).map(a => ({ filename: a.getName(), mime: a.getContentType(), b64: b64encode(a.getBytes()) })) });
      },
      getRemainingDailyQuota: () => Math.max(0, (Number(env.MAIL_DAILY_LIMIT) || 400) - store.outboxStats().mails24h),
    },
    UrlFetchApp: { fetch(url, opts = {}) {
      const m = /^https:\/\/api\.telegram\.org\/bot([^/]+)\/(\w+)$/.exec(String(url));
      if (!m) throw new Error('On the server, UrlFetchApp only talks to Telegram.');
      const [, token, method] = m;
      if (method === 'getMe' || method === 'getWebhookInfo') return tgResp(telegram.cached(token, method) || { ok: false, description: 'Still asking Telegram — press the button again in a few seconds.' });
      if (method === 'getUpdates') return tgResp({ ok: true, result: [] });           // the server uses a webhook
      if (method === 'deleteWebhook') return tgResp({ ok: true, result: true });       // never remove our own webhook
      store.enqueue('tg', { token, method, payload: serialize(opts) });
      return tgResp({ ok: true, result: {} });
    } },
    DriveApp: {
      createFolder: name => { const id = newId(); store.addFolder(id, name); return folderObj(id); },
      getFolderById: id => folderObj(id),
      getFileById: id => { const r = store.getFile(id); if (!r) throw new Error('No such file'); return fileObj(r); },
    },
    ScriptApp: {
      WeekDay: { SUNDAY: 'SUNDAY' },
      // the server's scheduler runs these (see app.mjs); listed so health checks show them as on
      getProjectTriggers: () => ['eveningReminders', 'weeklyReport'].map(fn => ({ getHandlerFunction: () => fn })),
      deleteTrigger() {}, newTrigger: () => builder(() => null),
      getService: () => ({ getUrl: () => (env.publicUrl() || '') + '/api' }),
    },
    Session: { getScriptTimeZone: () => env.HUB_TZ || 'Asia/Tashkent', getEffectiveUser: () => ({ getEmail: () => env.OWNER_EMAIL || '' }) },
    Logger: { log() {} },
    console: { log() {}, warn: (...a) => console.warn(...a), error: (...a) => console.error(...a) },
  };
  return { gas, withTx, replaceSheets, reload: load, spreadsheet: () => ss, newId, b64decode };
}
