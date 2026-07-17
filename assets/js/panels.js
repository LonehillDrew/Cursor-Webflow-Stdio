/**
 * Panels — properties inspector and layers manager.
 * Both render into the right-side panel area.
 */
'use strict';
window.TFS = window.TFS || {};

/* ========== PROPERTIES PANEL ========== */
TFS.PropertiesPanel = class {
  constructor(containerEl, app) {
    this.el = containerEl;
    this.app = app;
  }

  render() {
    const proj = this.app.project;
    const sel = this.app.canvas ? [...this.app.canvas.selection] : [];
    this.el.innerHTML = '';

    if (!proj || sel.length === 0) {
      this.el.innerHTML = '<p class="panel-empty">Select an object to see its properties</p>';
      return;
    }

    if (sel.length > 1) {
      this.el.innerHTML = `<p class="panel-empty">${sel.length} objects selected</p>`;
      this._addMultiActions(sel);
      return;
    }

    const id = sel[0];
    // Check if it's an edge or object
    let item = proj.objects.find(o => o.id === id);
    let isEdge = false;
    if (!item) { item = proj.edges.find(e => e.id === id); isEdge = true; }
    if (!item) { this.el.innerHTML = '<p class="panel-empty">Item not found</p>'; return; }

    const editable = this.app.editMode && !proj.readonly;

    if (isEdge) {
      this._renderEdgeProps(item, editable);
    } else {
      this._renderObjectProps(item, editable);
    }
  }

  _renderObjectProps(obj, editable) {
    const h = document.createElement('h3');
    h.textContent = 'Properties';
    h.className = 'panel-heading';
    this.el.appendChild(h);

    // Label
    this._addField('Label', obj.label || obj.text || '', editable, val => {
      if (obj.type === 'text') obj.text = val; else obj.label = val;
      this.app.history.push('edit-label'); this.app.save(); this.app.canvas.render(this.app.project);
    });

    // Type
    if (obj.type !== 'freehand') {
      this._addSelect('Shape', obj.type, ['rect','circle','diamond','hex','ellipse','parallelogram','text'], editable, val => {
        obj.type = val; this.app.history.push('change-shape'); this.app.save(); this.app.canvas.render(this.app.project);
      });
    }

    // Position
    this._addNumberRow('X', obj.x, editable, v => { obj.x = v; this._commitPos(); });
    this._addNumberRow('Y', obj.y, editable, v => { obj.y = v; this._commitPos(); });
    if (obj.type !== 'freehand') {
      this._addNumberRow('Width', obj.w || 160, editable, v => { obj.w = Math.max(20, v); this._commitPos(); });
      this._addNumberRow('Height', obj.h || 52, editable, v => { obj.h = Math.max(16, v); this._commitPos(); });
    }

    // Style
    const sh = document.createElement('h3'); sh.textContent = 'Style'; sh.className = 'panel-heading'; this.el.appendChild(sh);
    if (obj.type !== 'freehand' && obj.type !== 'text') {
      this._addColour('Fill', obj.style.fill || '#2d4a3e', editable, v => { obj.style.fill = v; this._commitStyle(); });
      this._addColour('Stroke', obj.style.stroke || '#555', editable, v => { obj.style.stroke = v; this._commitStyle(); });
      this._addNumberRow('Stroke W', obj.style.strokeWidth || 1.5, editable, v => { obj.style.strokeWidth = v; this._commitStyle(); });
    }
    this._addNumberRow('Font Size', obj.style.fontSize || 12, editable, v => { obj.style.fontSize = v; this._commitStyle(); });
    this._addColour('Font Colour', obj.style.fontColour || '#e0e0e0', editable, v => { obj.style.fontColour = v; this._commitStyle(); });

    // Layer
    this._addSelect('Layer', obj.layerId,
      (this.app.project.layers || []).map(l => l.id),
      editable, val => { obj.layerId = val; this.app.history.push('change-layer'); this.app.save(); this.app.canvas.render(this.app.project); },
      (this.app.project.layers || []).map(l => l.name)
    );

    // Node note
    const nh = document.createElement('h3'); nh.textContent = 'Note'; nh.className = 'panel-heading'; this.el.appendChild(nh);
    const ta = document.createElement('textarea');
    ta.className = 'panel-note-editor';
    ta.value = obj.note || '';
    ta.disabled = !editable;
    ta.placeholder = 'Markdown note for this node…';
    ta.addEventListener('input', () => {
      obj.note = ta.value;
      this.app.save();
    });
    this.el.appendChild(ta);

    // Delete
    if (editable) {
      const btn = document.createElement('button');
      btn.textContent = 'Delete Object';
      btn.className = 'btn btn-danger';
      btn.onclick = () => {
        this.app.project.objects = this.app.project.objects.filter(o => o.id !== obj.id);
        this.app.project.edges = this.app.project.edges.filter(e => e.source !== obj.id && e.target !== obj.id);
        this.app.canvas.selection.clear();
        this.app.history.push('delete'); this.app.save();
        this.app.canvas.render(this.app.project);
        this.render();
      };
      this.el.appendChild(btn);
    }
  }

  _renderEdgeProps(edge, editable) {
    const h = document.createElement('h3'); h.textContent = 'Edge Properties'; h.className = 'panel-heading'; this.el.appendChild(h);
    this._addField('Label', edge.label || '', editable, val => {
      edge.label = val; this.app.history.push('edit-edge-label'); this.app.save(); this.app.canvas.render(this.app.project);
    });
    this._addColour('Stroke', edge.style.stroke || '#888', editable, v => { edge.style.stroke = v; this._commitStyle(); });
    this._addNumberRow('Width', edge.style.strokeWidth || 1.5, editable, v => { edge.style.strokeWidth = v; this._commitStyle(); });
    this._addSelect('Line Style', edge.style.dashed ? 'dashed' : 'solid', ['solid','dashed'], editable, v => {
      edge.style.dashed = v === 'dashed'; this.app.history.push('edit-edge-style'); this.app.save(); this.app.canvas.render(this.app.project);
    });
    this._addSelect('Arrow', edge.style.arrowHead || 'triangle', ['triangle','diamond','circle','none'], editable, v => {
      edge.style.arrowHead = v; this.app.history.push('edit-edge-arrow'); this.app.save(); this.app.canvas.render(this.app.project);
    });
    if (editable) {
      const btn = document.createElement('button'); btn.textContent = 'Delete Edge'; btn.className = 'btn btn-danger';
      btn.onclick = () => {
        this.app.project.edges = this.app.project.edges.filter(e => e.id !== edge.id);
        this.app.canvas.selection.clear();
        this.app.history.push('delete-edge'); this.app.save(); this.app.canvas.render(this.app.project); this.render();
      };
      this.el.appendChild(btn);
    }
  }

  _addMultiActions(ids) {
    if (!this.app.editMode) return;
    const btn = document.createElement('button'); btn.textContent = 'Delete Selected'; btn.className = 'btn btn-danger';
    btn.onclick = () => {
      const idSet = new Set(ids);
      this.app.project.objects = this.app.project.objects.filter(o => !idSet.has(o.id));
      this.app.project.edges = this.app.project.edges.filter(e => !idSet.has(e.id) && !idSet.has(e.source) && !idSet.has(e.target));
      this.app.canvas.selection.clear();
      this.app.history.push('delete-multi'); this.app.save(); this.app.canvas.render(this.app.project); this.render();
    };
    this.el.appendChild(btn);
  }

  _addField(label, val, editable, onChange) {
    const row = this._row(label);
    const inp = document.createElement('input'); inp.type = 'text'; inp.value = val; inp.disabled = !editable;
    inp.className = 'panel-input';
    inp.addEventListener('change', () => onChange(inp.value));
    row.appendChild(inp); this.el.appendChild(row);
  }

  _addNumberRow(label, val, editable, onChange) {
    const row = this._row(label);
    const inp = document.createElement('input'); inp.type = 'number'; inp.value = Math.round(val * 10) / 10;
    inp.disabled = !editable; inp.className = 'panel-input panel-input-num';
    inp.addEventListener('change', () => onChange(parseFloat(inp.value) || 0));
    row.appendChild(inp); this.el.appendChild(row);
  }

  _addColour(label, val, editable, onChange) {
    const row = this._row(label);
    // Resolve CSS var to a usable hex
    let resolved = val;
    if (typeof val === 'string' && val.startsWith('var(')) {
      resolved = '#555555';
    }
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = resolved;
    inp.disabled = !editable; inp.className = 'panel-input-colour';
    inp.addEventListener('input', () => onChange(inp.value));
    row.appendChild(inp); this.el.appendChild(row);
  }

  _addSelect(label, val, options, editable, onChange, labels) {
    const row = this._row(label);
    const sel = document.createElement('select'); sel.disabled = !editable; sel.className = 'panel-input';
    options.forEach((o, i) => {
      const opt = document.createElement('option'); opt.value = o;
      opt.textContent = labels ? labels[i] : o;
      if (o === val) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => onChange(sel.value));
    row.appendChild(sel); this.el.appendChild(row);
  }

  _row(label) {
    const r = document.createElement('div'); r.className = 'panel-row';
    const l = document.createElement('label'); l.textContent = label; l.className = 'panel-label';
    r.appendChild(l); return r;
  }

  _commitPos() { this.app.history.push('edit-position'); this.app.save(); this.app.canvas.render(this.app.project); }
  _commitStyle() { this.app.history.push('edit-style'); this.app.save(); this.app.canvas.render(this.app.project); }
};

/* ========== LAYERS PANEL ========== */
TFS.LayersPanel = class {
  constructor(containerEl, app) {
    this.el = containerEl;
    this.app = app;
  }

  render() {
    const proj = this.app.project;
    this.el.innerHTML = '';
    if (!proj) return;

    const h = document.createElement('h3'); h.textContent = 'Layers'; h.className = 'panel-heading'; this.el.appendChild(h);
    const editable = this.app.editMode && !proj.readonly;

    (proj.layers || []).forEach(layer => {
      const row = document.createElement('div');
      row.className = 'layer-row' + (layer.id === this.app.activeLayerId ? ' active' : '');

      // Visibility toggle
      const vis = document.createElement('button');
      vis.className = 'layer-vis-btn';
      vis.textContent = layer.visible ? '👁' : '🚫';
      vis.title = layer.visible ? 'Hide layer' : 'Show layer';
      vis.onclick = () => { layer.visible = !layer.visible; this.app.save(); this.app.canvas.render(proj); this.render(); };
      row.appendChild(vis);

      // Lock toggle
      const lock = document.createElement('button');
      lock.className = 'layer-lock-btn';
      lock.textContent = layer.locked ? '🔒' : '🔓';
      lock.title = layer.locked ? 'Unlock' : 'Lock';
      lock.onclick = () => { layer.locked = !layer.locked; this.app.save(); this.render(); };
      row.appendChild(lock);

      // Name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'layer-name';
      nameSpan.textContent = layer.name;
      nameSpan.onclick = () => { this.app.activeLayerId = layer.id; this.render(); };
      if (editable) {
        nameSpan.ondblclick = async () => {
          const n = await TFS.UI.prompt('Rename layer', layer.name);
          if (n && n.trim()) { layer.name = n.trim(); this.app.save(); this.render(); }
        };
      }
      row.appendChild(nameSpan);

      // Delete (if more than one layer)
      if (editable && proj.layers.length > 1) {
        const del = document.createElement('button');
        del.className = 'layer-del-btn';
        del.textContent = '✕';
        del.title = 'Delete layer';
        del.onclick = async () => {
          const ok = await TFS.UI.confirm(
            'Delete layer "' + layer.name + '"? Objects on it will move to the first layer.',
            { title: 'Delete layer', danger: true, confirmLabel: 'Delete' }
          );
          if (!ok) return;
          const fallback = proj.layers.find(l => l.id !== layer.id).id;
          proj.objects.forEach(o => { if (o.layerId === layer.id) o.layerId = fallback; });
          proj.edges.forEach(e => { if (e.layerId === layer.id) e.layerId = fallback; });
          proj.layers = proj.layers.filter(l => l.id !== layer.id);
          if (this.app.activeLayerId === layer.id) this.app.activeLayerId = fallback;
          this.app.history.push('delete-layer'); this.app.save(); this.app.canvas.render(proj); this.render();
        };
        row.appendChild(del);
      }

      this.el.appendChild(row);
    });

    // Add layer button
    if (editable) {
      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-sm';
      addBtn.textContent = '+ Add Layer';
      addBtn.onclick = async () => {
        const name = await TFS.UI.prompt('New layer name', 'Layer ' + (proj.layers.length + 1));
        if (!name || !name.trim()) return;
        proj.layers.push({
          id: TFS.Storage.uid(), name: name.trim(), visible: true, locked: false, colour: null,
          order: proj.layers.length
        });
        this.app.history.push('add-layer'); this.app.save(); this.render();
      };
      this.el.appendChild(addBtn);
    }
  }
};
