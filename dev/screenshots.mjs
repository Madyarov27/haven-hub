// Makes the screenshots on the Haven Hub showcase page (docs/assets/tour/*.webp) from the demo — made-up data only.
//   1. python dev/serve.py            (the demo at http://localhost:5178/docs/?demo=1)
//   2. node dev/screenshots.mjs       (finds Chrome or Edge; set CHROME=path to pick one)
// Uses the browser's DevTools protocol directly (Node's built-in WebSocket), so there is nothing to install.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.HUB_DEMO || 'http://localhost:5178/docs/';
const OUT = fileURLToPath(new URL('../docs/assets/tour/', import.meta.url));
const W = 1280, H = 800, PORT = 9333;
const SHOTS = [
  ['overview', 'admin', 'admin'], ['tasks', 'admin', 'admin/tasks'], ['timeline', 'admin', 'admin/timeline'], ['team', 'admin', 'team'],
  ['person', 'lead', 'team/lina'], ['sponsors', 'admin', 'admin/sponsors'], ['applications', 'admin', 'admin/applications'], ['review', 'admin', 'admin/review'],
  ['member', 'member', 'tasks'], ['files', 'member', 'files'], ['viewer', 'viewer', 'admin'], ['public', 'guest', ''], ['signin', 'guest', 'signin'],
];
const browsers = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const exe = browsers.find(p => existsSync(p));
if (!exe) { console.error('No Chrome or Edge found — set CHROME=/path/to/chrome'); process.exit(1); }

const profile = mkdtempSync(join(tmpdir(), 'hub-shots-'));
const chrome = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, seq = 0; const waiting = new Map();
const send = (method, params = {}) => new Promise((ok, bad) => { const id = ++seq; waiting.set(id, { ok, bad }); ws.send(JSON.stringify({ id, method, params })); });
try {
  let page = null;
  for (let i = 0; i < 50 && !page; i++) { await sleep(200); try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch (e) { /* not up yet */ } }
  if (!page) throw new Error('the browser did not start');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  ws.onmessage = m => { const d = JSON.parse(m.data); const w = waiting.get(d.id); if (w) { waiting.delete(d.id); d.error ? w.bad(new Error(d.error.message)) : w.ok(d.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const ready = `(() => { const v = document.querySelector('#view') || document.querySelector('.pub-main') || document.querySelector('.wiz'); return !!v && v.innerText.length > 40 && !document.querySelector('.skel') && document.fonts.status === 'loaded'; })()`;
  mkdirSync(OUT, { recursive: true });
  for (const [name, as, route] of SHOTS) {
    await send('Page.navigate', { url: `${BASE}?demo=1&shot=1&as=${as}#/${route}` });
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) { await sleep(250); ok = (await send('Runtime.evaluate', { expression: ready, returnByValue: true })).result.value; }
    await sleep(900); // charts + images
    const shot = await send('Page.captureScreenshot', { format: 'webp', quality: 82, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    writeFileSync(join(OUT, name + '.webp'), Buffer.from(shot.data, 'base64'));
    console.log((ok ? '✓ ' : '? ') + name);
  }
} catch (e) { console.error('✖ ' + e.message); process.exitCode = 1; }
finally { try { ws && ws.close(); } catch (e) { /* ignore */ } chrome.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Windows may hold it a moment */ } }
