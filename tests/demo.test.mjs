// The demo on GitHub Pages (docs/?demo=1, the guided tour) runs docs/demo/Code.gs — it must be the real backend.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('docs/demo/Code.gs is the same as apps-script/Code.gs (run: npm run sync)', () => {
  assert.equal(readFileSync(new URL('../docs/demo/Code.gs', import.meta.url), 'utf8'), readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'));
});
