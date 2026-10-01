#!/usr/bin/env node
/* Talks to the running Haven Hub server through its private socket (~/haven/run/admin.sock).
   Usually called through hubctl:  hubctl status | admin-links | reset-link <key> | import-code | setup-code |
                                   backup | export | set-webhook | remind | weekly-report */
import { request } from 'node:http';
import { join } from 'node:path';
import { homedir } from 'node:os';

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) { console.log('Usage: hubctl <status|admin-links|reset-link KEY|set-setting KEY VALUE|import-code|setup-code|backup|export|set-webhook|remind|weekly-report>'); process.exit(1); }
const socketPath = join(process.env.HAVEN_HOME || join(homedir(), 'haven'), 'run', 'admin.sock');
const req = request({ socketPath, path: '/', method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
  let out = ''; res.on('data', c => { out += c; });
  res.on('end', () => {
    const r = JSON.parse(out || '{}');
    if (!r.ok) { console.error('✖ ' + r.error); process.exit(1); }
    console.log(typeof r.result === 'string' ? r.result : JSON.stringify(r.result, null, 2));
  });
});
req.on('error', e => { console.error('✖ The hub is not running (' + e.code + '). Start it: hubctl start'); process.exit(1); });
req.end(JSON.stringify({ cmd, args }));
