/* "Sign in with Google" without any Google script on the page: the browser goes to accounts.google.com, the person picks
   their account, and Google sends them back here with an ID token in the address (#id_token=…). The hub then checks that
   token with Google (Code.gs: tokeninfo; own server: Google's signature, server/google.mjs) before it trusts the name + email.
   Set up once: Google Cloud → APIs & Services → Credentials → OAuth client ID (Web) → Authorized redirect URIs = redirectUri(). */
const KEY = 'hh:google';
const rand = () => { const a = new Uint8Array(24); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); };

/** Where Google sends people back to: this page without ?query or #route. Register exactly this address with Google. */
export const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, '');

/** purpose: 'signin' | 'join' | 'link'. The page comes back to the current #route afterwards. */
export function googleStart(clientId, purpose, opts = {}) {
  const state = rand(), nonce = rand();
  try { sessionStorage.setItem(KEY, JSON.stringify({ state, nonce, purpose, back: opts.back || location.hash || '#/', at: Date.now() })); }
  catch (e) { return false; }
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri(), response_type: 'id_token', scope: 'openid email profile', nonce, state, prompt: 'select_account' });
  if (opts.hint) q.set('login_hint', opts.hint);
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + q);
  return true;
}

/** Call once on page load, before anything reads the address: Google's answer → { purpose, idToken, nonce, back } or { error }. null = nothing from Google. */
export function googleReturn() {
  const h = location.hash.replace(/^#/, '');
  if (h.startsWith('/') || !/(^|&)(id_token|error)=/.test(h)) return null;
  const q = new URLSearchParams(h);
  let s = null;
  try { s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); } catch (e) { s = null; }
  history.replaceState(null, '', location.pathname + location.search + (s && /^#\/[\w/?=&.-]*$/.test(s.back || '') ? s.back : '#/'));
  if (!s || !q.get('state') || q.get('state') !== s.state || Date.now() - s.at > 20 * 60e3) return { error: 'That Google sign-in did not start on this page — press the button again.' };
  if (q.get('error')) return { purpose: s.purpose, error: q.get('error') === 'access_denied' ? 'Google sign-in was cancelled.' : 'Google said: ' + q.get('error') };
  return { purpose: s.purpose, idToken: q.get('id_token') || '', nonce: s.nonce, back: s.back };
}
