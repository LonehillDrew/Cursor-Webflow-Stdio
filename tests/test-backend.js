/**
 * Test 1 — Backend / coding (data model, _builtIn, persistence)
 * Run with: node tests/test-backend.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { passed++; process.stdout.write('.'); }
  else { failed++; failures.push(msg); process.stdout.write('F'); }
}

function loadScript(filename, sandbox) {
  const code = fs.readFileSync(path.join(ROOT, filename), 'utf8');
  vm.runInNewContext(code, sandbox, { filename });
}

function makeSandbox() {
  const store = {};
  const sandbox = {
    window: {},
    console,
    Date,
    Math,
    JSON,
    Array,
    Object,
    Set,
    Map,
    Promise,
    Blob: class Blob {
      constructor(parts) { this.parts = parts; this.size = parts.reduce((n, p) => n + String(p).length, 0); }
    },
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    document: { createElement: () => ({ click: () => {}, style: {} }) },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      _store: store
    }
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  return sandbox;
}

function runSuite(passLabel) {
  passed = 0;
  failed = 0;
  failures.length = 0;
  process.stdout.write('\n[' + passLabel + '] ');

  const sb = makeSandbox();
  loadScript('assets/js/data-old.js', sb);
  loadScript('assets/js/data-new.js', sb);
  loadScript('assets/js/storage.js', sb);

  const old = sb.window.TANDEM_OLD_FLOW;
  const neu = sb.window.TANDEM_NEW_FLOW;
  const S = sb.window.TFS.Storage;

  // Source data integrity
  assert(!!old && !!neu, 'Source flows loaded');
  assert(old.nodes.length === 42, 'Old Flow has 42 nodes (got ' + (old && old.nodes.length) + ')');
  assert(old.sections.length === 8, 'Old Flow has 8 sections');
  assert(old.edges.length === 57, 'Old Flow has 57 edges (got ' + (old && old.edges.length) + ')');
  assert(neu.nodes.length === 34, 'New Flow has 34 nodes (got ' + (neu && neu.nodes.length) + ')');
  assert(neu.sections.length === 8, 'New Flow has 8 sections');
  assert(neu.edges.length === 42, 'New Flow has 42 edges (got ' + (neu && neu.edges.length) + ')');

  // Edges are arrays
  assert(Array.isArray(old.edges[0]), 'Old edges are arrays');
  assert(Array.isArray(neu.edges[0]), 'New edges are arrays');
  const dashed = neu.edges.find(e => e[2] && e[2].dashed);
  assert(!!dashed, 'New Flow has dashed edge with meta object');

  // Nodes are flat (not nested in sections)
  assert(!old.sections[0].nodes, 'Old sections do not nest nodes');
  assert(typeof old.nodes[0].section === 'string', 'Old nodes have section string');

  // _builtIn conversion
  const builtOld = S._builtIn('old', true);
  const builtNew = S._builtIn('new', true);
  assert(!!builtOld, '_builtIn old returns project');
  assert(!!builtNew, '_builtIn new returns project');
  assert(builtOld.objects.length === 42, '_builtIn old objects=42 (got ' + builtOld.objects.length + ')');
  assert(builtOld.edges.length === 57, '_builtIn old edges=57 (got ' + builtOld.edges.length + ')');
  assert(builtNew.objects.length === 34, '_builtIn new objects=34 (got ' + builtNew.objects.length + ')');
  assert(builtNew.edges.length === 42, '_builtIn new edges=42 (got ' + builtNew.edges.length + ')');
  assert(builtOld.readonly === false, 'Built-in old is editable');
  assert(builtNew.readonly === false, 'Built-in new is editable');

  // Edge sources resolve to objects
  const oldIds = new Set(builtOld.objects.map(o => o.id));
  const danglingOld = builtOld.edges.filter(e => !oldIds.has(e.source) || !oldIds.has(e.target));
  assert(danglingOld.length === 0, 'Old edges have no dangling refs (got ' + danglingOld.length + ')');
  const newIds = new Set(builtNew.objects.map(o => o.id));
  const danglingNew = builtNew.edges.filter(e => !newIds.has(e.source) || !newIds.has(e.target));
  assert(danglingNew.length === 0, 'New edges have no dangling refs (got ' + danglingNew.length + ')');

  // Section colours from source
  assert(builtOld.objects[0].style.fill === '#4a7c59' || !!builtOld.objects[0].style.fill, 'Objects have fill colour');
  const homeNode = builtOld.objects.find(o => o.id === 'Home');
  assert(!!homeNode && homeNode.section === 'home', 'Home node mapped with section');

  // ensureBuiltIns + persistence
  S.ensureBuiltIns();
  const loaded = S.loadProject('old');
  assert(!!loaded && loaded.objects.length === 42, 'ensureBuiltIns persists Old Flow');
  assert(loaded.readonly === false, 'Persisted Old Flow is editable');

  // CRUD
  const proj = S.createProject('Test Chart');
  assert(!!proj.id && proj.objects.length === 0, 'createProject works');
  proj.objects.push({ id: 'n1', type: 'rect', x: 0, y: 0, w: 100, h: 40, label: 'A', style: {}, layerId: 'layer-1', note: '' });
  S.saveProject(proj);
  const reloaded = S.loadProject(proj.id);
  assert(reloaded.objects.length === 1, 'save/load project works');

  const dup = S.duplicateProject(proj.id, 'Test Copy');
  assert(dup && dup.id !== proj.id && dup.objects.length === 1, 'duplicateProject works');

  S.renameProject(proj.id, 'Renamed');
  assert(S.loadProject(proj.id).name === 'Renamed', 'renameProject works');

  S.deleteProject(dup.id);
  assert(!S.loadProject(dup.id), 'deleteProject works');

  // Stats
  const stats = S.projectStats(builtOld);
  assert(stats.nodes === 42 && stats.edges === 57 && stats.sections === 8, 'projectStats correct for Old Flow');

  // Backup shape
  const notes = [{ id: 'note1', title: 'N', body: '# hi', folder: 'General', tags: [], created: 1, modified: 1 }];
  S.saveVaultNotes(notes);
  S.saveVaultFolders(['General', 'Research']);
  // exportBackup uses DOM download — verify data assembly via list
  const all = S.listProjects();
  assert(all.some(p => p.id === 'old') && all.some(p => p.id === 'new'), 'Registry includes old and new');
  assert(S.getVaultNotes().length === 1, 'Vault notes persist');
  assert(S.getVaultFolders().includes('Research'), 'Vault folders persist');

  // Import single project normalisation
  return { passed, failed, failures: failures.slice() };
}

const r1 = runSuite('Pass 1');
console.log('\nPass 1: ' + r1.passed + ' passed, ' + r1.failed + ' failed');
if (r1.failures.length) r1.failures.forEach(f => console.log('  - ' + f));

const r2 = runSuite('Pass 2');
console.log('\nPass 2: ' + r2.passed + ' passed, ' + r2.failed + ' failed');
if (r2.failures.length) r2.failures.forEach(f => console.log('  - ' + f));

const ok = r1.failed === 0 && r2.failed === 0;
console.log('\n=== TEST 1 BACKEND: ' + (ok ? '2/2 PASS' : 'FAIL') + ' ===');
process.exit(ok ? 0 : 1);
