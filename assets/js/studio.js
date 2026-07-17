/**
 * Studio — page controller for the flow chart editor.
 * Wires canvas, tools, panels, undo/redo, minimap, keyboard shortcuts.
 */
'use strict';
window.TFS = window.TFS || {};

TFS.Studio = class {
  constructor() {
    this.project = null;
    this.editMode = true;
    this.activeLayerId = null;
    this.activeTool = null;
    this._tools = {};
    this._saveTimer = null;
    this._lastSaveText = '';

    // Undo / redo
    this.history = new TFS.History(this);
  }

  init() {
    // Parse chart ID from URL
    const params = new URLSearchParams(location.search);
    const chartId = params.get('chart');
    if (!chartId) { location.href = 'index.html'; return; }

    // Load project
    this.project = TFS.Storage.loadProject(chartId);
    if (!this.project) { location.href = 'index.html'; return; }

    // If read-only project, start in view mode
    if (this.project.readonly) this.editMode = false;
    this.activeLayerId = this.project.layers[0] ? this.project.layers[0].id : null;

    // Title
    document.getElementById('project-name').textContent = this.project.name;
    document.title = this.project.name + ' — Tandem Flow Studio';

    // Canvas
    this.canvas = new TFS.Canvas(document.getElementById('canvas-area'), this);

    // Panels
    this.propsPanel = new TFS.PropertiesPanel(document.getElementById('props-content'), this);
    this.layersPanel = new TFS.LayersPanel(document.getElementById('layers-content'), this);

    // Init tools
    this._tools = {
      select: new TFS.SelectTool(this),
      rect: new TFS.ShapeTool(this, 'rect'),
      circle: new TFS.ShapeTool(this, 'circle'),
      diamond: new TFS.ShapeTool(this, 'diamond'),
      hex: new TFS.ShapeTool(this, 'hex'),
      ellipse: new TFS.ShapeTool(this, 'ellipse'),
      parallelogram: new TFS.ShapeTool(this, 'parallelogram'),
      edge: new TFS.EdgeTool(this),
      text: new TFS.TextTool(this),
      freehand: new TFS.FreehandTool(this)
    };
    this.setTool('select');

    // Toolbar wiring
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
    });

    // Edit / View toggle
    const modeBtn = document.getElementById('mode-toggle');
    modeBtn.addEventListener('click', () => {
      if (this.project.readonly) return;
      this.editMode = !this.editMode;
      this._updateModeUI();
    });
    this._updateModeUI();

    // Grid toggle
    const gridBtn = document.getElementById('grid-toggle');
    const prefs = TFS.Storage.getPrefs();
    this.canvas.showGrid(prefs.grid !== false);
    gridBtn.addEventListener('click', () => {
      prefs.grid = !prefs.grid;
      TFS.Storage.setPrefs(prefs);
      this.canvas.showGrid(prefs.grid);
    });

    // Zoom buttons
    document.getElementById('zoom-in').addEventListener('click', () => this.canvas.zoomIn());
    document.getElementById('zoom-out').addEventListener('click', () => this.canvas.zoomOut());
    document.getElementById('zoom-fit').addEventListener('click', () => this.canvas.fitAll(this.project));

    // Auto-layout
    const layoutBtn = document.getElementById('auto-layout');
    if (layoutBtn) layoutBtn.addEventListener('click', () => {
      if (!this.editMode || this.project.readonly) return;
      this.canvas.autoLayout(this.project);
      this.history.push('auto-layout');
      this.save();
      this.canvas.render(this.project);
      this.canvas.fitAll(this.project);
    });

    // Undo / Redo buttons
    document.getElementById('undo-btn').addEventListener('click', () => this.history.undo());
    document.getElementById('redo-btn').addEventListener('click', () => this.history.redo());

    // Export buttons
    document.getElementById('export-png').addEventListener('click', () => TFS.Exporter.exportPNG(this));
    document.getElementById('export-jpg').addEventListener('click', () => TFS.Exporter.exportJPG(this));
    document.getElementById('export-pdf').addEventListener('click', () => TFS.Exporter.exportPDF(this));
    document.getElementById('export-json').addEventListener('click', () => TFS.Storage.exportJSON(this.project));

    // Delete key
    document.addEventListener('keydown', e => this._onKey(e));

    // Panel tabs
    document.querySelectorAll('[data-panel-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-panel-tab]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.panel-tab-content').forEach(c => c.classList.remove('active'));
        const target = document.getElementById(tab.dataset.panelTab + '-content');
        if (target) target.classList.add('active');
      });
    });

    // Rename project
    const nameEl = document.getElementById('project-name');
    nameEl.addEventListener('dblclick', async () => {
      if (this.project.readonly) return;
      const n = await TFS.UI.prompt('Rename project', this.project.name);
      if (n && n.trim()) {
        this.project.name = n.trim();
        nameEl.textContent = n.trim();
        document.title = n.trim() + ' — Tandem Flow Studio';
        this.save();
      }
    });

    // Notes tab
    this.notesPanel = document.getElementById('notes-content');
    this._renderNotesPanel();

    // Minimap
    this._initMinimap();

    // Mobile panel toggle
    const panelToggle = document.getElementById('panel-toggle');
    if (panelToggle) panelToggle.addEventListener('click', () => {
      document.getElementById('right-panel').classList.toggle('open');
    });

    // Initial render
    this.canvas.render(this.project);
    this.canvas.fitAll(this.project);
    this.layersPanel.render();
    this.propsPanel.render();
    this._updateSaveIndicator();
  }

  setTool(name) {
    if (this.activeTool) this.activeTool.deactivate();
    this.activeTool = this._tools[name] || this._tools.select;
    this.activeTool.activate();
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === name);
    });
    // Enable/disable zoom based on tool
    if (name === 'freehand') {
      // Zoom disabled during draw in tool itself
    } else {
      this.canvas.svg.call(this.canvas.zoom);
    }
  }

  onSelectionChange() {
    this.propsPanel.render();
    this._renderNotesPanel();
  }

  onViewportChange(transform) {
    this._updateMinimap(transform);
  }

  save() {
    TFS.Storage.saveProject(this.project);
    this._updateSaveIndicator();
    this._renderNotesPanel();
  }

  _renderNotesPanel() {
    const el = this.notesPanel || document.getElementById('notes-content');
    if (!el || !this.project) return;
    el.innerHTML = '';
    const heading = document.createElement('h3');
    heading.className = 'panel-heading';
    heading.textContent = 'Pinned notes';
    el.appendChild(heading);

    const withNotes = (this.project.objects || []).filter(o => o.note && o.note.trim());
    if (withNotes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'panel-empty';
      empty.textContent = 'No pinned notes yet. Select a node and add a note in Properties.';
      el.appendChild(empty);
    } else {
      withNotes.forEach(o => {
        const card = document.createElement('div');
        card.className = 'pinned-note';
        const title = document.createElement('strong');
        title.textContent = (o.label || o.id || 'Node').split('\n')[0];
        card.appendChild(title);
        const body = document.createElement('p');
        body.textContent = o.note.length > 120 ? o.note.slice(0, 120) + '…' : o.note;
        card.appendChild(body);
        card.onclick = () => {
          this.canvas.selection.clear();
          this.canvas.selection.add(o.id);
          this.canvas.render(this.project);
          this.propsPanel.render();
          // Switch to properties tab
          document.querySelectorAll('[data-panel-tab]').forEach(t => t.classList.toggle('active', t.dataset.panelTab === 'props'));
          document.querySelectorAll('.panel-tab-content').forEach(c => c.classList.remove('active'));
          const props = document.getElementById('props-content');
          if (props) props.classList.add('active');
        };
        el.appendChild(card);
      });
    }

    if (this.editMode && !this.project.readonly) {
      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-sm btn-primary';
      addBtn.style.marginTop = '8px';
      addBtn.textContent = '+ Add note to selection';
      addBtn.onclick = async () => {
        const sel = [...this.canvas.selection];
        if (sel.length !== 1) {
          await TFS.UI.alert('Select a single node first.', 'Add note');
          return;
        }
        const obj = this.project.objects.find(o => o.id === sel[0]);
        if (!obj) return;
        const note = await TFS.UI.prompt('Note for "' + (obj.label || obj.id).split('\n')[0] + '"', obj.note || '');
        if (note === null) return;
        obj.note = note;
        this.history.push('add-note');
        this.save();
        this.propsPanel.render();
      };
      el.appendChild(addBtn);
    }
  }

  _updateModeUI() {
    const btn = document.getElementById('mode-toggle');
    btn.textContent = this.editMode ? '✏️ Edit' : '👁 View';
    btn.title = this.editMode ? 'Switch to view mode' : 'Switch to edit mode';
    document.body.classList.toggle('view-mode', !this.editMode);
    const toolbar = document.getElementById('drawing-tools');
    if (toolbar) toolbar.style.display = this.editMode ? '' : 'none';
    this.propsPanel.render();
    this.canvas.render(this.project);
  }

  _updateSaveIndicator() {
    const ind = document.getElementById('save-indicator');
    if (ind) {
      ind.textContent = 'Saved';
      ind.classList.add('show');
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => ind.classList.remove('show'), 2000);
    }
  }

  /* ---------- keyboard shortcuts ---------- */
  _onKey(e) {
    // Don't capture when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    const ctrl = e.ctrlKey || e.metaKey;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!this.editMode || this.project.readonly) return;
      const ids = [...this.canvas.selection];
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      this.project.objects = this.project.objects.filter(o => !idSet.has(o.id));
      this.project.edges = this.project.edges.filter(e => !idSet.has(e.id) && !idSet.has(e.source) && !idSet.has(e.target));
      this.canvas.selection.clear();
      this.history.push('delete');
      this.save();
      this.canvas.render(this.project);
      this.propsPanel.render();
      e.preventDefault();
    }

    if (ctrl && e.key === 'z') { e.preventDefault(); this.history.undo(); }
    if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); this.history.redo(); }
    if (ctrl && e.key === 'a') {
      e.preventDefault();
      this.project.objects.forEach(o => this.canvas.selection.add(o.id));
      this.canvas.render(this.project);
      this.onSelectionChange();
    }

    // Tool shortcuts
    if (e.key === 'v' || e.key === 'V') this.setTool('select');
    if (e.key === 'r' || e.key === 'R') this.setTool('rect');
    if (e.key === 'c' && !ctrl) this.setTool('circle');
    if (e.key === 'e' || e.key === 'E') this.setTool('edge');
    if (e.key === 't' || e.key === 'T') this.setTool('text');
    if (e.key === 'p' || e.key === 'P') this.setTool('freehand');
    if (e.key === 'Escape') { this.canvas.selection.clear(); this.canvas.render(this.project); this.onSelectionChange(); }

    // ? for shortcuts help
    if (e.key === '?') { this._showShortcuts(); }
  }

  _showShortcuts() {
    const existing = document.getElementById('shortcuts-modal');
    if (existing) { existing.remove(); return; }
    const m = document.createElement('div');
    m.id = 'shortcuts-modal';
    m.className = 'modal-overlay';
    m.innerHTML = `<div class="modal-box"><h2>Keyboard Shortcuts</h2>
      <div class="shortcut-grid">
        <span>V</span><span>Select tool</span>
        <span>R</span><span>Rectangle</span>
        <span>C</span><span>Circle</span>
        <span>E</span><span>Edge/connect</span>
        <span>T</span><span>Text</span>
        <span>P</span><span>Pen/freehand</span>
        <span>Del</span><span>Delete selected</span>
        <span>Ctrl+Z</span><span>Undo</span>
        <span>Ctrl+Y</span><span>Redo</span>
        <span>Ctrl+A</span><span>Select all</span>
        <span>Esc</span><span>Deselect</span>
        <span>?</span><span>Toggle this panel</span>
      </div>
      <button class="btn" onclick="this.closest('.modal-overlay').remove()">Close</button>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  }

  /* ---------- minimap ---------- */
  _initMinimap() {
    this._minimapCanvas = document.getElementById('minimap-canvas');
    if (!this._minimapCanvas) return;
    this._minimapCtx = this._minimapCanvas.getContext('2d');
    this._renderMinimap();
  }

  _renderMinimap() {
    if (!this._minimapCtx || !this.project) return;
    const ctx = this._minimapCtx;
    const w = this._minimapCanvas.width;
    const h = this._minimapCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // Compute bounds
    const objs = this.project.objects;
    if (objs.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objs.forEach(o => {
      minX = Math.min(minX, o.x); minY = Math.min(minY, o.y);
      maxX = Math.max(maxX, o.x + (o.w || 160)); maxY = Math.max(maxY, o.y + (o.h || 52));
    });
    const pad = 40;
    const rangeX = maxX - minX + pad * 2 || 1;
    const rangeY = maxY - minY + pad * 2 || 1;
    const scale = Math.min(w / rangeX, h / rangeY);

    ctx.fillStyle = 'rgba(200,200,200,0.15)';
    objs.forEach(o => {
      const sx = (o.x - minX + pad) * scale;
      const sy = (o.y - minY + pad) * scale;
      const sw = (o.w || 160) * scale;
      const sh = (o.h || 52) * scale;
      ctx.fillRect(sx, sy, sw, sh);
    });
  }

  _updateMinimap(transform) {
    this._renderMinimap();
    if (!this._minimapCtx) return;
    // Draw viewport rectangle
    const ctx = this._minimapCtx;
    const rect = document.getElementById('canvas-area').getBoundingClientRect();
    // Simplified viewport indicator
    ctx.strokeStyle = 'var(--interactive-accent)';
    ctx.lineWidth = 1.5;
  }
};

/* ========== HISTORY (undo/redo) ========== */
TFS.History = class {
  constructor(app) {
    this.app = app;
    this._stack = [];
    this._pos = -1;
    this._maxSize = 50;
  }

  push(label) {
    const snap = JSON.stringify(this.app.project);
    // Truncate forward history
    this._stack = this._stack.slice(0, this._pos + 1);
    this._stack.push({ label, data: snap });
    if (this._stack.length > this._maxSize) this._stack.shift();
    this._pos = this._stack.length - 1;
  }

  undo() {
    if (this._pos <= 0) return;
    this._pos--;
    this._restore();
  }

  redo() {
    if (this._pos >= this._stack.length - 1) return;
    this._pos++;
    this._restore();
  }

  _restore() {
    const snap = this._stack[this._pos];
    if (!snap) return;
    const restored = JSON.parse(snap.data);
    // Preserve identity
    Object.assign(this.app.project, restored);
    this.app.save();
    this.app.canvas.render(this.app.project);
    this.app.propsPanel.render();
    this.app.layersPanel.render();
  }
};

/* ========== EXPORTER ========== */
TFS.Exporter = {
  async _capture(app) {
    const el = document.getElementById('canvas-area');
    return html2canvas(el, { backgroundColor: null, scale: 2 });
  },

  async exportPNG(app) {
    const c = await this._capture(app);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = (app.project.name || 'chart') + '.png';
    a.click();
  },

  async exportJPG(app) {
    const c = await this._capture(app);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/jpeg', 0.92);
    a.download = (app.project.name || 'chart') + '.jpg';
    a.click();
  },

  async exportPDF(app) {
    const c = await this._capture(app);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: c.width > c.height ? 'landscape' : 'portrait', unit: 'px', format: [c.width, c.height] });
    pdf.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, c.width, c.height);
    pdf.save((app.project.name || 'chart') + '.pdf');
  }
};

/* ========== BOOT ========== */
document.addEventListener('DOMContentLoaded', () => {
  const app = new TFS.Studio();
  window._studio = app;
  app.init();
  // Push initial state for undo
  app.history.push('initial');
});
