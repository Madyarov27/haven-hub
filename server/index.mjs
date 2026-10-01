#!/usr/bin/env node
/* Haven Hub server — start with:  hubctl start   (or: node server/index.mjs)
   Settings come from the environment or ~/haven/.env (see server/env.example). Listens on 127.0.0.1 only;
   Cloudflare Tunnel (cloudflared) makes it reachable at your domain with HTTPS. */
import { createServer } from 'node:http';
import { readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHub } from './app.mjs';

const argHome = process.argv.indexOf('--home');
const HOME = argHome > 0 ? resolve(process.argv[argHome + 1]) : process.env.HAVEN_HOME || join(homedir(), 'haven');
const envFile = process.env.HAVEN_ENV || join(HOME, '.env');
const env = {};
if (existsSync(envFile)) readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2'); });
Object.keys(process.env).forEach(k => { if (/^(PUBLIC_URL|SITE_URL|HUB_NAME|ALLOWED_ORIGINS|PORT|HOST|SMTP_|MAIL_|HUB_TZ|OWNER_EMAIL|TG_|DATA_DIR|BACKUP_DIR|TEAM_REPO|GOOGLE_|ATTEND_|UPLOAD_)/.test(k)) env[k] = process.env[k]; });
const log = (...a) => console.log(new Date().toISOString(), ...a);
const dataDir = resolve(env.DATA_DIR || join(HOME, 'data'));
env.PUBLIC_URL_FILE = join(HOME, 'run', 'public_url'); // written by "hubctl quick-tunnel" while testing without a domain

const hub = await createHub({ dataDir, backupDir: env.BACKUP_DIR || join(HOME, 'backups'), env, log });
const crashed = hub.store.getMeta('clean_exit', '1') === '0';
hub.store.setMeta('clean_exit', '0');

const port = Number(env.PORT || 8787), host = env.HOST || '127.0.0.1';
const server = createServer(hub.handle);
server.listen(port, host, () => log(`Haven Hub on http://${host}:${port}  public: ${hub.env.publicUrl() || '(not set)'}`));

// admin commands for hubctl — a socket only this user can open
const sock = join(HOME, 'run', 'admin.sock');
if (process.platform !== 'win32') {
  try { rmSync(sock, { force: true }); } catch (e) { /* ignore */ }
  const adm = createServer(async (req, res) => {
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', async () => {
      try { const { cmd, args = [] } = JSON.parse(body || '{}'); if (!hub.admin[cmd]) throw new Error('Unknown command: ' + cmd); res.end(JSON.stringify({ ok: true, result: await hub.admin[cmd](...args) }, null, 2)); }
      catch (e) { res.end(JSON.stringify({ ok: false, error: e.message })); }
    });
  });
  adm.listen(sock, () => chmodSync(sock, 0o600));
}

const every = (ms, fn) => setInterval(() => fn().catch(e => log('timer: ' + (e.stack || e))), ms);
every(30e3, () => hub.tick());
every(5e3, () => hub.drain());
setTimeout(() => hub.tick().catch(e => log('first tick: ' + e.message)), 2000);
if (crashed) setTimeout(() => hub.admin['notify-admins']('⚠️ The Team Hub server restarted after a crash (' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC). Everything is back up.').catch(() => {}), 15e3);

const stop = sig => {
  log('stopping (' + sig + ')');
  hub.store.setMeta('clean_exit', '1');
  server.close(); hub.close();
  process.exit(0);
};
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
process.on('uncaughtException', e => log('uncaught: ' + (e.stack || e)));
process.on('unhandledRejection', e => log('unhandled: ' + (e && e.stack || e)));
