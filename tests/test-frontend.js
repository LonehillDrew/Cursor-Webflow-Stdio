/**
 * Test 2 — Frontend UX / working functions
 * Structure, theme, scripts, no browser popups, required DOM hooks.
 * Run with: node tests/test-frontend.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { passed++; process.stdout.write('.'); }
  else { failed++; failures.push(msg); process.stdout.write('F'); }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function runSuite(passLabel) {
  passed = 0;
  failed = 0;
  failures.length = 0;
  process.stdout.write('\n[' + passLabel + '] ');

  const index = read('index.html');
  const studio = read('studio.html');
  const vault = read('vault.html');
  const css = read('assets/css/styles.css');
  const dash = read('assets/js/dashboard.js');
  const studioJs = read('assets/js/studio.js');
  const vaultJs = read('assets/js/vault.js');
  const tools = read('assets/js/tools.js');
  const canvas = read('assets/js/canvas.js');
  const ui = read('assets/js/ui.js');
  const storage = read('assets/js/storage.js');

  // Pages exist and brand
  assert(index.includes('Tandem Flow Studio'), 'index brands Tandem Flow Studio');
  assert(studio.includes('Tandem Flow Studio'), 'studio brands Tandem Flow Studio');
  assert(vault.includes('Tandem Flow Studio'), 'vault brands Tandem Flow Studio');

  // Dashboard structure (v4-style)
  assert(index.includes('id="hero-cards"'), 'Dashboard has hero-cards');
  assert(index.includes('id="project-list"'), 'Dashboard has project-list');
  assert(index.includes('id="backup-btn"'), 'Dashboard has Backup all');
  assert(index.includes('id="dup-old-btn"') && index.includes('id="dup-new-btn"'), 'Dashboard has duplicate quick actions');
  assert(index.includes('ui.js'), 'index loads ui.js');

  // Studio structure
  assert(studio.includes('data-tool="rect"'), 'Studio has shape tools');
  assert(studio.includes('data-tool="edge"'), 'Studio has edge tool');
  assert(studio.includes('data-panel-tab="notes"'), 'Studio has Notes tab');
  assert(studio.includes('id="notes-content"'), 'Studio has notes-content');
  assert(studio.includes('ui.js'), 'studio loads ui.js');
  assert(studio.includes('canvas.js') && studio.includes('tools.js'), 'studio loads canvas+tools');

  // Vault structure
  assert(vault.includes('data-vault-tab="all"'), 'Vault has All tab');
  assert(vault.includes('data-vault-tab="folders"'), 'Vault has Folders tab');
  assert(vault.includes('data-vault-tab="tags"'), 'Vault has Tags tab');
  assert(vault.includes('id="vault-empty"'), 'Vault has empty state');
  assert(vault.includes('id="export-vault-btn"'), 'Vault has export button');
  assert(vault.includes('ui.js'), 'vault loads ui.js');

  // Obsidian theme tokens
  assert(css.includes('--background-primary: #1a1a2e'), 'CSS uses deep Obsidian primary #1a1a2e');
  assert(css.includes('--interactive-accent: #4878c6'), 'CSS has accent #4878c6');
  assert(css.includes('.hero-card'), 'CSS has hero-card styles');
  assert(css.includes('.modal-overlay') && css.includes('.modal-input'), 'CSS has modal styles');
  assert(css.includes('.vault-tabs'), 'CSS has vault tabs');
  assert(css.includes('.pinned-note'), 'CSS has pinned note styles');

  // No native browser popups in app JS (allow TFS.UI.*)
  const appFiles = [dash, studioJs, vaultJs, tools, storage];
  const names = ['dashboard.js', 'studio.js', 'vault.js', 'tools.js', 'storage.js'];
  appFiles.forEach((src, i) => {
    const stripped = src
      .replace(/TFS\.UI\.prompt\(/g, 'UI_PROMPT(')
      .replace(/TFS\.UI\.confirm\(/g, 'UI_CONFIRM(')
      .replace(/TFS\.UI\.confirmDelete\(/g, 'UI_CONFIRM_DEL(')
      .replace(/TFS\.UI\.alert\(/g, 'UI_ALERT(')
      .replace(/await this\.confirm\(/g, 'UI_CONFIRM(')
      .replace(/this\.confirm\(/g, 'UI_CONFIRM(');
    assert(!/\bprompt\s*\(/.test(stripped), names[i] + ' has no native prompt()');
    assert(!/\bconfirm\s*\(/.test(stripped), names[i] + ' has no native confirm()');
  });

  // UI module
  assert(ui.includes('TFS.UI') && ui.includes('prompt(') && ui.includes('confirm('), 'ui.js exports modal API');

  // Zoom filter (tool lock fix)
  assert(canvas.includes('.filter(') && canvas.includes("toolName !== 'select'"), 'canvas zoom filter protects drawing tools');
  assert(canvas.includes('dblclick.zoom'), 'canvas disables dblclick zoom');

  // Shape tool returns to select
  assert(tools.includes("setTool('select')"), 'Shape/text tools return to select');

  // Storage critical fixes
  assert(storage.includes('src.nodes'), 'storage reads flat src.nodes');
  assert(storage.includes('Array.isArray(e)'), 'storage parses array edges');
  assert(storage.includes('ensureBuiltIns'), 'storage has ensureBuiltIns');
  assert(storage.includes('exportBackup') && storage.includes('tfs-backup'), 'storage has full backup');
  assert(storage.includes('readonly: false') || storage.includes('readonly = false'), 'built-ins editable');

  // Notes feature
  assert(studioJs.includes('_renderNotesPanel') && studioJs.includes('Pinned notes'), 'studio has pinned notes panel');

  // Vendored libs present (no CDN)
  ['d3.min.js', 'marked.min.js', 'jspdf.umd.min.js', 'html2canvas.min.js'].forEach(v => {
    assert(fs.existsSync(path.join(ROOT, 'assets/vendor', v)), 'vendor/' + v + ' exists');
  });
  assert(!index.includes('cdn.') && !studio.includes('cdn.'), 'No CDN in HTML');

  // Required source files
  ['assets/js/data-old.js', 'assets/js/data-new.js', 'assets/js/storage.js',
   'assets/js/canvas.js', 'assets/js/tools.js', 'assets/js/panels.js',
   'assets/js/studio.js', 'assets/js/dashboard.js', 'assets/js/vault.js', 'assets/js/ui.js',
   'assets/css/styles.css', '.github/workflows/static.yml'].forEach(f => {
    assert(fs.existsSync(path.join(ROOT, f)), f + ' exists');
  });

  return { passed, failed, failures: failures.slice() };
}

function httpCheck(cb) {
  const mime = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.yml': 'text/yaml', '.md': 'text/plain'
  };
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const file = path.join(ROOT, urlPath.replace(/^\//, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const paths = ['/', '/index.html', '/studio.html', '/vault.html',
      '/assets/css/styles.css', '/assets/js/storage.js', '/assets/js/ui.js',
      '/assets/js/data-old.js', '/assets/vendor/d3.min.js'];
    let done = 0;
    let httpFails = 0;
    paths.forEach(p => {
      http.get('http://127.0.0.1:' + port + p, res => {
        if (res.statusCode !== 200) httpFails++;
        res.resume();
        done++;
        if (done === paths.length) {
          server.close();
          cb(httpFails === 0, paths.length, httpFails);
        }
      }).on('error', () => {
        httpFails++;
        done++;
        if (done === paths.length) {
          server.close();
          cb(false, paths.length, httpFails);
        }
      });
    });
  });
}

const r1 = runSuite('Pass 1');
console.log('\nPass 1 structure: ' + r1.passed + ' passed, ' + r1.failed + ' failed');
if (r1.failures.length) r1.failures.forEach(f => console.log('  - ' + f));

const r2 = runSuite('Pass 2');
console.log('\nPass 2 structure: ' + r2.passed + ' passed, ' + r2.failed + ' failed');
if (r2.failures.length) r2.failures.forEach(f => console.log('  - ' + f));

httpCheck((ok, total, fails) => {
  console.log('\nHTTP smoke: ' + (ok ? 'PASS' : 'FAIL') + ' (' + (total - fails) + '/' + total + ' assets)');
  const allOk = r1.failed === 0 && r2.failed === 0 && ok;
  console.log('\n=== TEST 2 FRONTEND: ' + (allOk ? '2/2 PASS' : 'FAIL') + ' ===');
  process.exit(allOk ? 0 : 1);
});
