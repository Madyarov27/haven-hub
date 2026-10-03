/* "Sign in with Google" on your own server: checks Google's ID token itself (no Google library, no new dependencies).
   The website sends the person to accounts.google.com and gets back an ID token (a JWT signed by Google). Here we check
   the signature against Google's public keys (JWKS, cached as long as Google says), then iss, aud (our client id), exp and the nonce. */
import { createPublicKey, verify } from 'node:crypto';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const b64json = s => JSON.parse(Buffer.from(String(s), 'base64url').toString('utf8'));

export function createGoogle({ fetchImpl = fetch, clientIds = () => [], now = () => Date.now() } = {}) {
  let keys = new Map(), until = 0, loading = null;
  async function load() {
    const r = await fetchImpl(JWKS_URL);
    if (!r.ok && r.status) throw new Error('Google keys: HTTP ' + r.status);
    const j = await r.json(), cc = String((r.headers && r.headers.get && r.headers.get('cache-control')) || ''), m = cc.match(/max-age=(\d+)/);
    keys = new Map((j.keys || []).filter(k => k.kty === 'RSA' && k.kid).map(k => [k.kid, createPublicKey({ key: k, format: 'jwk' })]));
    until = now() + Math.min(Number(m ? m[1] : 3600), 86400) * 1000;
  }
  async function key(kid) {
    if (!keys.has(kid) || now() > until) { loading = loading || load().finally(() => { loading = null; }); await loading; }
    return keys.get(kid);
  }
  /** → { sub, email, email_verified, name, picture } — or throws with a short reason. */
  async function verifyIdToken(token, nonce) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3 || parts.some(p => !/^[\w-]+$/.test(p))) throw new Error('not a Google ID token');
    const head = b64json(parts[0]), c = b64json(parts[1]);
    if (head.alg !== 'RS256') throw new Error('unexpected signature type');
    const k = await key(head.kid);
    if (!k || !verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), k, Buffer.from(parts[2], 'base64url'))) throw new Error('bad signature');
    const t = now() / 1000, ids = clientIds().filter(Boolean);
    if (!ISSUERS.includes(c.iss)) throw new Error('not from Google');
    if (!ids.length || !ids.includes(c.aud)) throw new Error('made for another website');
    if (!(Number(c.exp) > t - 60)) throw new Error('expired');
    if (c.iat && Number(c.iat) > t + 300) throw new Error('from the future');
    if (!nonce || c.nonce !== nonce) throw new Error('nonce mismatch');
    return { sub: String(c.sub || ''), email: String(c.email || '').toLowerCase(), email_verified: c.email_verified === true || c.email_verified === 'true', name: String(c.name || ''), picture: String(c.picture || '') };
  }
  return { verifyIdToken, _reset: () => { keys = new Map(); until = 0; } };
}
