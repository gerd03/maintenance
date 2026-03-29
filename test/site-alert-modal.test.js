const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const styleCss = fs.readFileSync(path.join(projectRoot, 'assets/css/style.css'), 'utf8');
const siteAlertJs = fs.readFileSync(path.join(projectRoot, 'assets/js/site-alert.js'), 'utf8');

const publicPages = [
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

test('site alert script and styles define the shared Supabase notice modal', () => {
  assert.match(styleCss, /\.site-alert-modal/);
  assert.match(styleCss, /body\.site-alert-modal-open/);
  assert.match(styleCss, /\.site-alert-panel/);
  assert.match(siteAlertJs, /Technical Server-Side Error/);
  assert.match(siteAlertJs, /SUPABASE EDGE FUNCTIONS needs attention to keep the website working properly\./);
  assert.match(siteAlertJs, /paused or deactivated after 90 days/);
  assert.match(siteAlertJs, /window\.AOASSiteAlert/);
  assert.match(siteAlertJs, /window\.close\(\)/);
  assert.match(siteAlertJs, /about:blank/);
  assert.match(siteAlertJs, /openModal\(\);/);
});

test('public html entry pages load the shared site alert modal script', () => {
  publicPages.forEach(({ relativePath, contents }) => {
    assert.match(
      contents,
      /\/assets\/js\/site-alert\.js\?v=20260330c/,
      `Expected ${relativePath} to load the shared site alert script.`
    );
  });
});
