const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const guardJs = fs.readFileSync(path.join(projectRoot, 'assets/js/devtools-guard.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(projectRoot, 'admin.html'), 'utf8');

const guardedPages = [
  'index.html',
  'careers.html',
  'privacy.html',
  'terms.html',
  'insights.html',
  'locations/australia.html',
  'services/index.html',
  'services/bookkeeping.html',
  'services/customer-service.html',
  'services/data-entry.html',
  'services/ndis-admin.html',
  'services/payroll.html',
  'services/tax-compliance.html',
].map((relativePath) => ({
  relativePath,
  contents: fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'),
}));

test('devtools guard blocks common inspect shortcuts and shuts down the page', () => {
  assert.match(guardJs, /key === 'f12'/);
  assert.match(guardJs, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(guardJs, /event\.shiftKey/);
  assert.match(guardJs, /key === 'u'/);
  assert.match(guardJs, /contextmenu/);
  assert.match(guardJs, /window\.outerWidth - window\.innerWidth/);
  assert.match(guardJs, /window\.outerHeight - window\.innerHeight/);
  assert.match(guardJs, /window\.console\.dir/);
  assert.match(guardJs, /window\.close\(\)/);
  assert.match(guardJs, /about:blank/);
  assert.match(guardJs, /window\.AOASDevtoolsGuard/);
});

test('public pages and admin load the shared devtools guard script', () => {
  guardedPages.forEach(({ relativePath, contents }) => {
    assert.match(
      contents,
      /\/assets\/js\/devtools-guard\.js\?v=20260330a/,
      `Expected ${relativePath} to load the shared devtools guard script.`
    );
  });

  assert.match(adminHtml, /\/assets\/js\/devtools-guard\.js\?v=20260330a/);
});
