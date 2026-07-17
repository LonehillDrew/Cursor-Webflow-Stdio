/**
 * Storage — data model, localStorage persistence, JSON import/export.
 * Keys: tfs-projects, tfs-project-<id>, tfs-vault-notes, tfs-vault-folders, tfs-prefs
 */
'use strict';

window.TFS = window.TFS || {};

TFS.Storage = (() => {
  const PFX = 'tfs-';

  /* ---------- helpers ---------- */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => Date.now();

  const _get = k => { try { return JSON.parse(localStorage.getItem(PFX + k)); } catch { return null; } };
  const _set = (k, v) => { localStorage.setItem(PFX + k, JSON.stringify(v)); };
  const _del = k => { localStorage.removeItem(PFX + k); };

  /* ---------- project registry ---------- */
  function listProjects() {
    return _get('projects') || [];
  }

  function saveRegistry(reg) { _set('projects', reg); }

  /* ---------- new blank project ---------- */
  function createProject(name) {
    const id = uid();
    const proj = {
      id, name: name || 'Untitled',
      created: now(), modified: now(),
      readonly: false,
      viewport: { x: 0, y: 0, zoom: 1 },
      layers: [{ id: 'layer-1', name: 'Default', visible: true, locked: false, colour: null, order: 0 }],
      objects: [],
      edges: []
    };
    _set('project-' + id, proj);
    const reg = listProjects();
    reg.push({ id, name: proj.name, created: proj.created, modified: proj.modified, readonly: false, order: reg.length });
    saveRegistry(reg);
    return proj;
  }

  /* ---------- load / save ---------- */
  function loadProject(id) {
    const stored = _get('project-' + id);
    if (stored) return stored;
    // Fallback: build from source data (first open before seed)
    if (id === 'old' || id === 'new') return _builtIn(id, false);
    return null;
  }

  function saveProject(proj) {
    if (!proj || proj.readonly) return;
    proj.modified = now();
    _set('project-' + proj.id, proj);
    const reg = listProjects();
    const idx = reg.findIndex(r => r.id === proj.id);
    if (idx >= 0) {
      reg[idx].name = proj.name;
      reg[idx].modified = proj.modified;
      reg[idx].readonly = false;
    } else {
      reg.push({ id: proj.id, name: proj.name, created: proj.created, modified: proj.modified, readonly: false, order: reg.length });
    }
    saveRegistry(reg);
  }

  function deleteProject(id) {
    _del('project-' + id);
    const reg = listProjects().filter(r => r.id !== id);
    saveRegistry(reg);
  }

  function renameProject(id, name) {
    const proj = loadProject(id);
    if (!proj || proj.readonly) return;
    proj.name = name;
    saveProject(proj);
  }

  function duplicateProject(srcId, newName) {
    const src = loadProject(srcId);
    if (!src) return null;
    const dup = JSON.parse(JSON.stringify(src));
    dup.id = uid();
    dup.name = newName || src.name + ' (copy)';
    dup.created = now();
    dup.modified = now();
    dup.readonly = false;
    _set('project-' + dup.id, dup);
    const reg = listProjects();
    reg.push({ id: dup.id, name: dup.name, created: dup.created, modified: dup.modified, readonly: false, order: reg.length });
    saveRegistry(reg);
    return dup;
  }

  /**
   * Convert v4 flat data (sections + nodes + array edges) into a v5 project.
   * Nodes live in src.nodes (NOT nested under sections).
   * Edges are arrays: ["from","to"] or ["from","to",{dashed,label}].
   */
  function _builtIn(id, editable) {
    const src = id === 'old' ? window.TANDEM_OLD_FLOW : window.TANDEM_NEW_FLOW;
    if (!src) return null;
    const isEditable = editable !== false;
    const proj = {
      id,
      name: id === 'old' ? 'Old Flow' : 'New Flow',
      created: now(),
      modified: now(),
      readonly: !isEditable,
      viewport: { x: 0, y: 0, zoom: 1 },
      layers: [{ id: 'layer-1', name: 'Default', visible: true, locked: false, colour: null, order: 0 }],
      objects: [],
      edges: [],
      sections: (src.sections || []).map(s => ({ id: s.id, label: s.label, colour: s.colour }))
    };

    const secMap = {};
    (src.sections || []).forEach((sec, si) => {
      secMap[sec.id] = { label: sec.label, colour: sec.colour || _sectionColour(si), index: si };
    });

    // Group flat nodes by section for layout
    const bySection = {};
    (src.nodes || []).forEach(n => {
      const sid = n.section || 'home';
      if (!bySection[sid]) bySection[sid] = [];
      bySection[sid].push(n);
    });

    const spacingX = 200;
    const spacingY = 110;
    let row = 0;
    (src.sections || []).forEach(sec => {
      const nodes = bySection[sec.id] || [];
      const secColour = sec.colour || _sectionColour(secMap[sec.id] ? secMap[sec.id].index : 0);
      nodes.forEach((n, ni) => {
        const col = ni % 4;
        if (ni > 0 && col === 0) row++;
        proj.objects.push({
          id: n.id,
          type: 'rect',
          x: 80 + col * spacingX,
          y: 60 + row * spacingY,
          w: 170,
          h: 56,
          label: n.label,
          section: sec.id,
          style: {
            fill: secColour,
            stroke: '#555',
            strokeWidth: 1.5,
            fontSize: 12,
            fontColour: '#e8e8e8'
          },
          layerId: 'layer-1',
          note: '',
          external: !!n.external
        });
      });
      if (nodes.length) row++;
    });

    // Orphan nodes (section id missing from sections list)
    (src.nodes || []).forEach(n => {
      if (proj.objects.some(o => o.id === n.id)) return;
      proj.objects.push({
        id: n.id, type: 'rect',
        x: 80, y: 60 + row * spacingY, w: 170, h: 56,
        label: n.label, section: n.section || '',
        style: { fill: '#3a3a5c', stroke: '#555', strokeWidth: 1.5, fontSize: 12, fontColour: '#e8e8e8' },
        layerId: 'layer-1', note: '', external: !!n.external
      });
      row++;
    });

    (src.edges || []).forEach(e => {
      let source, target, meta = {};
      if (Array.isArray(e)) {
        source = e[0];
        target = e[1];
        if (e[2] && typeof e[2] === 'object') meta = e[2];
      } else if (e && typeof e === 'object') {
        source = e.from || e.source;
        target = e.to || e.target;
        meta = e;
      } else {
        return;
      }
      if (!source || !target) return;
      proj.edges.push({
        id: uid(),
        source,
        target,
        label: meta.label || '',
        style: {
          stroke: '#888',
          strokeWidth: 1.5,
          dashed: !!meta.dashed,
          arrowHead: 'triangle'
        },
        layerId: 'layer-1'
      });
    });

    return proj;
  }

  function _sectionColour(i) {
    const pal = ['#4a7c59', '#5b8a6b', '#7fae8c', '#3f6b4c', '#c9922f', '#8a6d3b', '#5c7a99', '#7a5c99'];
    return pal[i % pal.length];
  }

  /** Seed Old/New Flow as editable projects once (Decision: not read-only). */
  function ensureBuiltIns() {
    const reg = listProjects();
    const ids = new Set(reg.map(r => r.id));
    ['old', 'new'].forEach(id => {
      if (ids.has(id) && _get('project-' + id)) return;
      const proj = _builtIn(id, true);
      if (!proj) return;
      proj.readonly = false;
      _set('project-' + id, proj);
      if (!ids.has(id)) {
        reg.unshift({
          id: proj.id,
          name: proj.name,
          created: proj.created,
          modified: proj.modified,
          readonly: false,
          order: -2 + (id === 'new' ? 1 : 0),
          builtIn: true,
          desc: id === 'old'
            ? 'Original Tandem site map — editable'
            : 'New mega-menu flow — editable'
        });
      }
    });
    // Normalise order
    reg.forEach((r, i) => { if (r.order == null) r.order = i; });
    saveRegistry(reg);
  }

  function projectStats(proj) {
    if (!proj) return { nodes: 0, edges: 0, sections: 0 };
    const sectionIds = new Set();
    (proj.objects || []).forEach(o => { if (o.section) sectionIds.add(o.section); });
    if (proj.sections) proj.sections.forEach(s => sectionIds.add(s.id));
    return {
      nodes: (proj.objects || []).length,
      edges: (proj.edges || []).length,
      sections: sectionIds.size || (proj.sections || []).length
    };
  }

  /* ---------- JSON import / export ---------- */
  function exportJSON(proj) {
    const blob = new Blob([JSON.stringify(proj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (proj.name || 'chart').replace(/[^a-z0-9_-]/gi, '_') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** Full backup: all projects + vault */
  function exportBackup() {
    ensureBuiltIns();
    const projects = listProjects().map(r => {
      const full = loadProject(r.id);
      return full || r;
    });
    const payload = {
      type: 'tfs-backup',
      version: 5,
      exported: new Date().toISOString(),
      projects,
      vaultNotes: getVaultNotes(),
      vaultFolders: getVaultFolders(),
      prefs: getPrefs()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tandem-flow-studio-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
    return payload;
  }

  function importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          // Full backup restore
          if (data.type === 'tfs-backup' && Array.isArray(data.projects)) {
            let count = 0;
            data.projects.forEach(p => {
              if (!p || !p.id) return;
              p.readonly = false;
              if (!p.layers) p.layers = [{ id: 'layer-1', name: 'Default', visible: true, locked: false, colour: null, order: 0 }];
              if (!p.objects) p.objects = [];
              if (!p.edges) p.edges = [];
              // Keep built-in ids; generate new for others if colliding as copies
              _set('project-' + p.id, p);
              count++;
            });
            const reg = data.projects.map((p, i) => ({
              id: p.id, name: p.name, created: p.created, modified: p.modified,
              readonly: false, order: i, builtIn: p.id === 'old' || p.id === 'new'
            }));
            saveRegistry(reg);
            if (data.vaultNotes) saveVaultNotes(data.vaultNotes);
            if (data.vaultFolders) saveVaultFolders(data.vaultFolders);
            if (data.prefs) setPrefs(data.prefs);
            resolve({ type: 'backup', count, notes: (data.vaultNotes || []).length });
            return;
          }

          if (!data.objects && !data.nodes) { reject('Invalid project file'); return; }

          // Single project — convert v4-style if needed
          let proj = data;
          if (data.nodes && !data.objects) {
            // Treat as source format
            window.__TFS_IMPORT_TMP = data;
            const fakeId = 'import';
            const srcOld = window.TANDEM_OLD_FLOW;
            window.TANDEM_OLD_FLOW = data;
            proj = _builtIn('old', true);
            window.TANDEM_OLD_FLOW = srcOld;
            if (!proj) { reject('Could not convert project'); return; }
          }

          proj.id = uid();
          proj.created = now();
          proj.modified = now();
          proj.readonly = false;
          if (!proj.name) proj.name = 'Imported chart';
          if (!proj.layers) proj.layers = [{ id: 'layer-1', name: 'Default', visible: true, locked: false, colour: null, order: 0 }];
          if (!proj.objects) proj.objects = [];
          if (!proj.edges) proj.edges = [];
          // Normalise edge arrays if present
          proj.edges = proj.edges.map(e => {
            if (Array.isArray(e)) {
              const meta = e[2] && typeof e[2] === 'object' ? e[2] : {};
              return {
                id: uid(), source: e[0], target: e[1], label: meta.label || '',
                style: { stroke: '#888', strokeWidth: 1.5, dashed: !!meta.dashed, arrowHead: 'triangle' },
                layerId: 'layer-1'
              };
            }
            if (!e.id) e.id = uid();
            return e;
          });
          _set('project-' + proj.id, proj);
          const reg = listProjects();
          reg.push({ id: proj.id, name: proj.name, created: proj.created, modified: proj.modified, readonly: false, order: reg.length });
          saveRegistry(reg);
          resolve({ type: 'project', count: 1, project: proj });
        } catch (e) { reject(e.message || String(e)); }
      };
      reader.readAsText(file);
    });
  }

  /* ---------- preferences ---------- */
  function getPrefs() { return _get('prefs') || { editMode: true, grid: true, snap: false, minimap: true }; }
  function setPrefs(p) { _set('prefs', p); }

  /* ---------- vault ---------- */
  function getVaultNotes() { return _get('vault-notes') || []; }
  function saveVaultNotes(n) { _set('vault-notes', n); }
  function getVaultFolders() { return _get('vault-folders') || ['General']; }
  function saveVaultFolders(f) { _set('vault-folders', f); }

  /* ---------- reorder registry ---------- */
  function reorderProjects(orderedIds) {
    const reg = listProjects();
    const map = {};
    reg.forEach(r => { map[r.id] = r; });
    const reordered = orderedIds.map((id, i) => { const r = map[id]; if (r) r.order = i; return r; }).filter(Boolean);
    reg.forEach(r => { if (!orderedIds.includes(r.id)) { r.order = reordered.length; reordered.push(r); } });
    saveRegistry(reordered);
  }

  return {
    uid, listProjects, createProject, loadProject, saveProject,
    deleteProject, renameProject, duplicateProject,
    exportJSON, exportBackup, importJSON,
    getPrefs, setPrefs,
    getVaultNotes, saveVaultNotes, getVaultFolders, saveVaultFolders,
    reorderProjects, ensureBuiltIns, projectStats, _builtIn
  };
})();
