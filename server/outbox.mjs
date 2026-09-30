/* Telegram + email delivery for a self-hosted hub.
   Code.gs never waits for the network: it puts messages in the outbox, and this worker sends them with retries. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Telegram Bot API: a small cache for getMe/getWebhookInfo (Code.gs reads them synchronously) + the webhook. */
export function createTelegram({ fetchImpl = fetch, env, log = () => {} }) {
  const cache = new Map();
  const call = async (token, method, body, form) => {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, form ? { method: 'POST', body: form } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    let j; try { j = await res.json(); } catch (e) { j = { ok: false, description: 'HTTP ' + res.status }; }
    return j;
  };
  const tg = {
    call,
    cached: (token, method) => { const c = cache.get(token); return c ? c[method] : null; },
    async refresh(token) {
      if (!token) return null;
      const [getMe, getWebhookInfo] = await Promise.all([call(token, 'getMe'), call(token, 'getWebhookInfo')]);
      cache.set(token, { getMe, getWebhookInfo, at: Date.now() });
      return cache.get(token);
    },
    webhookUrl: () => env.publicUrl() ? env.publicUrl() + '/tg/' + env.TG_PATH : '',
    async setWebhook(token) {
      const url = tg.webhookUrl();
      if (!token || !url) return { ok: false, description: 'No bot token or no public address yet.' };
      const r = await call(token, 'setWebhook', { url, secret_token: env.TG_SECRET, allowed_updates: ['message'], max_connections: 10 });
      if (!r.ok) log('telegram setWebhook failed: ' + r.description);
      await tg.refresh(token);
      return r;
    },
  };
  return tg;
}

/** Email over SMTP (Gmail with an App Password by default). nodemailer is loaded only when there is something to send. */
export function createMailer({ env, transport }) {
  let t = transport;
  return {
    configured: () => !!(t || (env.SMTP_USER && env.SMTP_PASS)),
    async send(m) {
      if (!t) {
        if (!env.SMTP_USER || !env.SMTP_PASS) throw new Error('Email is not set up on the server (SMTP_USER / SMTP_PASS in .env).');
        const nodemailer = (await import('nodemailer')).default;
        t = nodemailer.createTransport({ host: env.SMTP_HOST || 'smtp.gmail.com', port: Number(env.SMTP_PORT || 465), secure: Number(env.SMTP_PORT || 465) === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } });
      }
      await t.sendMail({ from: { name: m.name || 'Haven Hub', address: env.SMTP_FROM || env.SMTP_USER }, to: m.to, subject: m.subject, text: m.body, html: m.htmlBody,
        attachments: (m.attachments || []).map(a => ({ filename: a.filename, contentType: a.mime, content: Buffer.from(a.b64, 'base64') })) });
    },
  };
}

const backoff = n => Math.min(3600e3, 15e3 * 2 ** n); // 15 s, 30 s, 1 min … up to 1 h

/** Sends everything that is due. Returns how many items it handled. */
export async function drainOutbox({ store, telegram, mailer, filesDir, log = () => {} }) {
  const due = store.due(25);
  for (const item of due) {
    const p = JSON.parse(item.payload), attempts = item.attempts + 1;
    try {
      if (item.kind === 'mail') {
        await mailer.send(p);
        store.markSent(item.id);
      } else if (item.kind === 'tg') {
        const fileKey = Object.keys(p.payload).find(k => p.payload[k] && (p.payload[k].__file || p.payload[k].__b64));
        let form = null, body = p.payload;
        if (fileKey) {
          form = new FormData();
          Object.entries(p.payload).forEach(([k, v]) => {
            if (k === fileKey) { const bytes = v.__file ? readFileSync(join(filesDir, v.__file)) : Buffer.from(v.__b64, 'base64'); form.append(k, new Blob([bytes], { type: v.mime || 'application/octet-stream' }), v.name || 'file'); }
            else form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
          });
        }
        const r = await telegram.call(p.token, p.method, body, form);
        if (r.ok) store.markSent(item.id);
        else if (r.error_code === 429) store.markFailed(item.id, attempts, r.description, Date.now() + ((r.parameters && r.parameters.retry_after) || 5) * 1000);
        else if (r.error_code >= 400 && r.error_code < 500) { store.markFailed(item.id, attempts, r.description, 0); store.setProp('BOT_LAST_ERROR', new Date().toISOString().slice(0, 16).replace('T', ' ') + ' · ' + p.method + ': ' + r.description); }
        else throw new Error(r.description || 'Telegram error');
      } else store.markFailed(item.id, attempts, 'unknown kind', 0);
    } catch (e) {
      log(`outbox ${item.kind} #${item.id} failed (try ${attempts}): ${e.message}`);
      store.markFailed(item.id, attempts, e.message, attempts >= 8 ? 0 : Date.now() + backoff(attempts));
    }
  }
  return due.length;
}
