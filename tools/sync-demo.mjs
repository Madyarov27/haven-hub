// Copies apps-script/Code.gs into docs/demo/ so the demo (docs/?demo=1) runs the real backend on GitHub Pages too.
// Run after every change to Code.gs:  npm run sync      (tests/demo.test.mjs fails while the two differ)
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
copyFileSync(root + 'apps-script/Code.gs', root + 'docs/demo/Code.gs');
console.log('docs/demo/Code.gs updated');
