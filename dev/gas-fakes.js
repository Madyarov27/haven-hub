/**
 * In-memory fakes of the Google Apps Script services Code.gs uses — enough to run the real backend in Node tests
 * (tests/api.test.mjs) and in the browser (docs/?demo=1 when you serve the repo root). Not used in production.
 *
 *   const gas = createGas({ tz: 'Asia/Tashkent' });
 *   const backend = loadBackend(codeText, gas);     // → { doGet, doPost, call(name, ...args) }
 */

const pad = n => String(n).padStart(2, '0');

function a1(ref) { // "A1", "B2", "A:Z" → {r, c, nr, nc} (whole columns → 1000 rows)
  const m = String(ref).match(/^([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/);
  if (!m) throw new Error('Bad A1 ref ' + ref);
  const col = s => s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const c1 = col(m[1]), r1 = m[2] ? Number(m[2]) : 1, c2 = m[3] ? col(m[3]) : c1, r2 = m[4] ? Number(m[4]) : (m[2] ? r1 : 1000);
  return { r: r1, c: c1, nr: r2 - r1 + 1, nc: c2 - c1 + 1 };
}

class FakeRange {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = this.sheet.data[this.r - 1 + i] || [];
      out.push(Array.from({ length: this.nc }, (_, j) => { const v = row[this.c - 1 + j]; return v === undefined ? '' : v; }));
    }
    return out;
  }
  setValues(v) {
    if (v.length !== this.nr || v.some(r => r.length !== this.nc)) throw new Error(`setValues: expected ${this.nr}x${this.nc}, got ${v.length}x${v[0] && v[0].length}`);
    v.forEach((row, i) => row.forEach((x, j) => this.sheet.set(this.r + i, this.c + j, x)));
    return this;
  }
  setValue(x) { this.sheet.set(this.r, this.c, x); return this; }
  setFormula(f) { return this.setValue(f); }
  setFormulas(f) { return this.setValues(f); }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet.set(this.r + i, this.c + j, ''); return this; }
  getValue() { return this.getValues()[0][0]; }
}
['setNumberFormat', 'setFontWeight', 'setBackground', 'setFontColor', 'setFontSize', 'setDataValidation'].forEach(k => { FakeRange.prototype[k] = function () { return this; }; });

class FakeSheet {
  constructor(name) { this.name = name; this.data = []; }
  getName() { return this.name; }
  set(r, c, v) { while (this.data.length < r) this.data.push([]); const row = this.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; }
  getLastRow() { for (let i = this.data.length; i > 0; i--) if ((this.data[i - 1] || []).some(v => v !== '' && v !== null && v !== undefined)) return i; return 0; }
  getLastColumn() { return this.data.reduce((m, row) => { for (let j = row.length; j > 0; j--) if (row[j - 1] !== '' && row[j - 1] !== undefined) return Math.max(m, j); return m; }, 0); }
  getRange(r, c, nr, nc) { if (typeof r === 'string') { const x = a1(r); return new FakeRange(this, x.r, x.c, x.nr, x.nc); } return new FakeRange(this, r, c, nr || 1, nc || 1); }
  getDataRange() { return new FakeRange(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  deleteRow(r) { this.data.splice(r - 1, 1); }
  clear() { this.data = []; }
}
['setFrozenRows', 'clearConditionalFormatRules', 'setConditionalFormatRules', 'setColumnWidth'].forEach(k => { FakeSheet.prototype[k] = function () { return this; }; });

class FakeSpreadsheet {
  constructor(id) { this.id = id; this.sheets = [new FakeSheet('Sheet1')]; this.name = 'Untitled spreadsheet'; this.tz = ''; }
  getId() { return this.id; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  getSheets() { return this.sheets.slice(); }
  insertSheet(n, i) { const s = new FakeSheet(n); if (i === undefined) this.sheets.push(s); else this.sheets.splice(i, 0, s); return s; }
  deleteSheet(s) { if (this.sheets.length < 2) throw new Error('Cannot delete the only sheet'); this.sheets = this.sheets.filter(x => x !== s); }
  rename(n) { this.name = n; }
  setSpreadsheetTimeZone(tz) { this.tz = tz; }
  toast() {}
}

function builder(result) { // chainable no-op builder: every method returns itself, build() returns result
  return new Proxy({}, { get: (_, k) => k === 'build' || k === 'create' ? () => result() : () => builder(result) });
}

function b64encode(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 255); return btoa(s);
}
function b64decode(str) {
  if (typeof Buffer !== 'undefined') return Array.from(Buffer.from(str, 'base64'));
  const s = atob(str); return Array.from(s, ch => ch.charCodeAt(0));
}

function formatDate(date, tz, pattern) {
  const parts = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(date).forEach(p => { parts[p.type] = p.value; });
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const off = Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const offS = off === 0 ? 'Z' : (off > 0 ? '+' : '-') + pad(Math.floor(Math.abs(off) / 60)) + ':' + pad(Math.abs(off) % 60);
  return pattern.replace(/yyyy|MM|dd|HH|mm|ss|XXX/g, t => ({ yyyy: parts.year, MM: parts.month, dd: parts.day, HH: parts.hour, mm: parts.minute, ss: parts.second, XXX: offS }[t]));
}

export function createGas(opts = {}) {
  const tz = opts.tz || 'Asia/Tashkent';
  const ss = new FakeSpreadsheet(opts.sheetId || '1FakeSheetIdForTheHavenHubDemo0000000000');
  const props = {}, cache = {}, mails = [], telegram = [], triggers = [], files = {}, folders = {};
  let fileSeq = 0;
  const tgBot = opts.bot || { username: 'demo_hub_bot' };

  const blob = (bytes, mime, name) => ({ bytes, mime, name, getBytes: () => bytes, getContentType: () => mime, getName: () => name, setName(n) { name = n; return this; } });
  const iter = arr => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
  const folder = name => {
    const id = 'folder' + (++fileSeq), f = { id, name, getId: () => id, getUrl: () => 'https://drive.google.com/drive/folders/' + id,
      createFile(b) { const fid = 'file' + (++fileSeq) + 'x'.repeat(20); let desc = ''; const file = { getId: () => fid, getName: () => b.getName(), getBlob: () => b, setDescription(d) { desc = d; return this; }, getDescription: () => desc, getParents: () => iter([f]) }; files[fid] = file; return file; } };
    folders[id] = f; return f;
  };

  const gas = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss, getActive: () => ss, flush() {},
      newDataValidation: () => builder(() => ({})), newConditionalFormatRule: () => builder(() => ({})),
      InterpolationType: { NUMBER: 'NUMBER' },
      getUi: () => ({ alert() {}, prompt: () => ({ getSelectedButton: () => 'CANCEL', getResponseText: () => '' }), showModalDialog() {}, createMenu: () => builder(() => null), Button: { OK: 'OK' }, ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL' } }),
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null), setProperty(k, v) { props[k] = String(v); return this; }, deleteProperty(k) { delete props[k]; return this; }, getProperties: () => Object.assign({}, props) }) },
    CacheService: { getScriptCache: () => ({
      get: k => { const x = cache[k]; return x && x.exp > Date.now() ? x.v : null; }, put(k, v, s) { cache[k] = { v: String(v), exp: Date.now() + (s || 600) * 1000 }; }, remove(k) { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {}, hasLock: () => true }) },
    Utilities: {
      formatDate, getUuid: () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, () => (Math.random() * 16 | 0).toString(16))),
      base64Encode: b64encode, base64Decode: b64decode, newBlob: blob, sleep() {},
    },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: s => ({ content: s, setMimeType() { return this; }, getContent() { return this.content; } }) },
    HtmlService: { createHtmlOutput: () => builder(() => null) },
    MailApp: { sendEmail(o) { mails.push(o); }, getRemainingDailyQuota: () => 100 - mails.length },
    UrlFetchApp: { fetch(url, o) {
      const method = String(url).split('/').pop(), payload = typeof o.payload === 'string' ? JSON.parse(o.payload || '{}') : (o.payload || {});
      telegram.push({ method, payload });
      let res = { ok: true, result: true };
      if (method === 'getMe') res = { ok: true, result: { id: 1, is_bot: true, username: tgBot.username, can_join_groups: true, can_read_all_group_messages: true } };
      if (method === 'getWebhookInfo') res = { ok: true, result: { url: '', pending_update_count: 0 } };
      if (method === 'getUpdates') res = { ok: true, result: (gas._updates || []).splice(0) };
      return { getContentText: () => JSON.stringify(res), getResponseCode: () => 200 };
    } },
    DriveApp: {
      createFolder: folder, getFolderById: id => { if (!folders[id]) throw new Error('no folder'); return folders[id]; },
      getFileById: id => { if (!files[id]) throw new Error('no file'); return files[id]; },
    },
    ScriptApp: {
      WeekDay: { SUNDAY: 'SUNDAY' },
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: t => { const i = triggers.indexOf(t); if (i >= 0) triggers.splice(i, 1); },
      newTrigger: fn => builder(() => { const t = { fn, getHandlerFunction: () => fn }; triggers.push(t); return t; }),
      getService: () => ({ getUrl: () => '' }),
    },
    Session: { getScriptTimeZone: () => tz, getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
    Logger: { log() {} },
    console: opts.quiet === false ? console : { log() {}, warn() {}, error() {} },
    // test/demo handles
    _ss: ss, _props: props, _mails: mails, _telegram: telegram, _triggers: triggers, _files: files, _updates: [],
  };
  return gas;
}

const GLOBALS = ['SpreadsheetApp', 'PropertiesService', 'CacheService', 'LockService', 'Utilities', 'ContentService', 'HtmlService', 'MailApp', 'UrlFetchApp', 'DriveApp', 'ScriptApp', 'Session', 'Logger', 'console'];

/** Evaluates Code.gs with the fakes as its globals. Returns doGet/doPost plus call(fnName, ...args) for anything else. */
export function loadBackend(code, gas) {
  const names = ['doGet', 'doPost', 'eveningReminders', 'weeklyReport', 'pollTelegram', 'upgrade', 'refreshLinks', 'buildProgress', 'botDoctor', 'installTriggers', 'addMissingTokens', 'resetToken', 'onOpen'];
  // eslint-disable-next-line no-new-func
  const factory = new Function(...GLOBALS, code + `\n;return { ${names.join(', ')}, __eval: (s) => eval(s) };`);
  const api = factory(...GLOBALS.map(k => gas[k]));
  return {
    api,
    get(params) { return JSON.parse(api.doGet({ parameter: params }).getContent()); },
    post(body) { return JSON.parse(api.doPost({ postData: { contents: JSON.stringify(body) } }).getContent()); },
    call(name, ...args) { return api[name] ? api[name](...args) : api.__eval(name)(...args); },
  };
}
