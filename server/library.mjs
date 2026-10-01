/* The team files repo on your own server: a mirror of a public GitHub repo (Dashboard → Settings → Team files), pulled every few
   minutes, listed on the Files page and served at /files/raw/<path> — so the team gets the files even if GitHub is slow or blocked.
   Plain git through execFile (no shell, no new dependencies). The mirror only ever follows GitHub: never edit files in it by hand. */
import { execFile } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, createReadStream, statSync } from 'node:fs';
import { join, extname } from 'node:path';

export const REPO_RE = /^[\w.-]{1,39}\/[\w.-]{1,100}$/;
export const BRANCH_RE = /^\w[\w.\/-]{0,59}$/; // never starts with "-" (it goes on a git command line)
const INLINE = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const DOWNLOAD = { '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.zip': 'application/zip', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.mov': 'video/quicktime' };

export function createLibrary({ dataDir, log = () => {}, git = 'git', urlFor = repo => `https://github.com/${repo}.git` }) {
  const dir = join(dataDir, 'team-repo');
  let state = { repo: '', branch: '', head: '', syncedAt: 0, tree: [], error: '' }, byPath = new Map(), queue = Promise.resolve();
  const run = (args, cwd) => new Promise((ok, bad) => execFile(git, args, { cwd, timeout: 180e3, maxBuffer: 64 << 20, windowsHide: true,
    env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo' }) }, (e, out, err) => e ? bad(new Error(String(err || e.message).trim().split('\n').pop())) : ok(out)));

  async function index() {
    const out = await run(['ls-tree', '-r', '-l', '-z', 'HEAD'], dir), tree = [];
    out.split('\0').filter(Boolean).forEach(line => {
      const tab = line.indexOf('\t'), meta = line.slice(0, tab).split(/\s+/), path = line.slice(tab + 1);
      if (meta[1] !== 'blob' || path.split('/').some(p => p.startsWith('.'))) return; // no .gitignore, .gitkeep, .github/…
      tree.push({ path, size: Number(meta[3]) || 0, sha: meta[2] });
    });
    tree.sort((a, b) => a.path.localeCompare(b.path));
    return tree;
  }
  /** Clone or fast-forward the mirror (one at a time). → { changed, head, before, added, removed } */
  function sync(repo, branch = 'main', { force } = {}) {
    const p = queue.then(async () => {
      repo = String(repo || '').trim(); branch = String(branch || 'main').trim();
      if (!repo) { state = Object.assign({}, state, { repo: '', tree: [], head: '', error: '' }); byPath = new Map(); return { changed: false }; }
      if (!REPO_RE.test(repo) || !BRANCH_RE.test(branch)) { state.error = 'Team files repo or branch looks wrong.'; return { changed: false }; }
      const before = state.repo === repo && state.branch === branch ? state.head : '', old = state.tree, url = urlFor(repo);
      try {
        const origin = existsSync(join(dir, '.git')) ? (await run(['remote', 'get-url', 'origin'], dir).catch(() => '')).trim() : '';
        if (origin !== url || force === 'reclone') {
          rmSync(dir, { recursive: true, force: true }); mkdirSync(dataDir, { recursive: true });
          await run(['clone', '--depth', '1', '--single-branch', '--branch', branch, '--', url, dir], dataDir);
        } else {
          await run(['fetch', '--depth', '1', 'origin', branch], dir);
          await run(['reset', '--hard', '--quiet', 'FETCH_HEAD'], dir);
        }
        const head = (await run(['rev-parse', 'HEAD'], dir)).trim();
        const changed = head !== state.head || repo !== state.repo;
        const tree = changed || !state.tree.length ? await index() : state.tree;
        state = { repo, branch, head, syncedAt: Date.now(), tree, error: '' };
        byPath = new Map(tree.map(f => [f.path, f]));
        if (!changed || !before) return { changed, head, before };
        const was = new Map(old.map(f => [f.path, f.sha]));
        return { changed, head, before, added: tree.filter(f => !was.has(f.path) || was.get(f.path) !== f.sha).map(f => f.path), removed: old.filter(f => !byPath.has(f.path)).map(f => f.path) };
      } catch (e) {
        state = Object.assign({}, state, { syncedAt: Date.now(), error: 'Could not update the team files from GitHub: ' + e.message });
        log('team files: ' + e.message);
        return { changed: false, error: e.message };
      }
    });
    queue = p.catch(() => {});
    return p;
  }
  return {
    dir,
    state: () => state,
    sync,
    /** Pulls when the repo changed in Settings or the last pull is older than everyMin minutes. */
    async maybeSync(repo, branch, everyMin = 5) {
      repo = String(repo || ''); branch = String(branch || 'main');
      if (repo === state.repo && branch === state.branch && Date.now() - state.syncedAt < Math.max(1, everyMin) * 60e3) return null;
      if (!repo && !state.repo) return null;
      return sync(repo, branch);
    },
    /** For files.list: the mirror's tree, when it mirrors the repo the hub is set to. */
    listing(files) {
      if (!files || !files.repo || files.repo !== state.repo) return { tree: null, syncing: !!(files && files.repo) };
      return { tree: state.tree.map(f => [f.path, f.size]), head: state.head.slice(0, 7), syncedAt: state.syncedAt ? new Date(state.syncedAt).toISOString() : '', error: state.error };
    },
    /** GET /files/raw/<path>: only files GitHub has in the repo; pictures, PDFs and videos open in the browser, everything else downloads. */
    serve(rel, req, res) {
      const f = byPath.get(rel);
      if (!f) { res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); return res.end('Not found'); }
      const file = join(dir, ...rel.split('/')), ext = extname(rel).toLowerCase(), etag = '"' + f.sha + '"';
      let size; try { size = statSync(file).size; } catch (e) { res.writeHead(404); return res.end(); }
      const name = rel.split('/').pop(), inline = Object.prototype.hasOwnProperty.call(INLINE, ext);
      const head = { 'Content-Type': INLINE[ext] || DOWNLOAD[ext] || 'application/octet-stream', 'Content-Length': size, ETag: etag, 'Cache-Control': 'public, max-age=300',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox", 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': head['Cache-Control'] }); return res.end(); }
      res.writeHead(200, head);
      if (req.method === 'HEAD') return res.end();
      createReadStream(file).pipe(res);
    },
  };
}
