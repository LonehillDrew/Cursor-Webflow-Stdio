/**
 * Tools — select, shape, edge, text, freehand drawing tools.
 * Each tool implements onMouse(type, x, y, event, canvas) and activate/deactivate.
 */
'use strict';
window.TFS = window.TFS || {};

/* ========== SELECT TOOL ========== */
TFS.SelectTool = class {
  constructor(app) { this.app = app; this.name = 'select'; this._drag = null; this._boxStart = null; this._resizing = null; }

  onMouse(type, x, y, event, canvas) {
    const proj = this.app.project;
    if (!proj) return;

    if (type === 'down') {
      // Check resize handle first
      if (this.app.editMode && canvas.selection.size === 1) {
        const selId = [...canvas.selection][0];
        const obj = proj.objects.find(o => o.id === selId);
        if (obj && x >= obj.x + (obj.w || 160) - 8 && y >= obj.y + (obj.h || 52) - 8
            && x <= obj.x + (obj.w || 160) + 8 && y <= obj.y + (obj.h || 52) + 8) {
          this._resizing = { id: selId, startX: x, startY: y, origW: obj.w || 160, origH: obj.h || 52 };
          event.stopPropagation();
          return;
        }
      }
      const hit = canvas.hitTest(x, y, proj);
      if (hit) {
        if (event.shiftKey) {
          if (canvas.selection.has(hit.id)) canvas.selection.delete(hit.id);
          else canvas.selection.add(hit.id);
        } else if (!canvas.selection.has(hit.id)) {
          canvas.selection.clear();
          canvas.selection.add(hit.id);
        }
        this._drag = { startX: x, startY: y, moved: false,
          offsets: [...canvas.selection].map(id => {
            const o = proj.objects.find(ob => ob.id === id);
            return o ? { id, dx: o.x - x, dy: o.y - y } : null;
          }).filter(Boolean)
        };
        this.app.onSelectionChange();
        canvas.render(proj);
        event.stopPropagation();
      } else {
        if (!event.shiftKey) { canvas.selection.clear(); this.app.onSelectionChange(); }
        this._boxStart = { x, y };
      }
    }

    if (type === 'move') {
      if (this._resizing && this.app.editMode) {
        const obj = proj.objects.find(o => o.id === this._resizing.id);
        if (obj && !this._isLocked(proj, obj)) {
          obj.w = Math.max(40, this._resizing.origW + (x - this._resizing.startX));
          obj.h = Math.max(24, this._resizing.origH + (y - this._resizing.startY));
          canvas.render(proj);
        }
        return;
      }
      if (this._drag && this.app.editMode) {
        this._drag.moved = true;
        this._drag.offsets.forEach(off => {
          const o = proj.objects.find(ob => ob.id === off.id);
          if (o && !o.readonly && !this._isLocked(proj, o)) {
            o.x = Math.round(x + off.dx);
            o.y = Math.round(y + off.dy);
          }
        });
        canvas.render(proj);
      }
      if (this._boxStart) {
        canvas.drawSelectionBox(this._boxStart.x, this._boxStart.y, x, y);
      }
      // Hover
      const hov = canvas.hitTest(x, y, proj);
      canvas.hoveredId = hov ? hov.id : null;
    }

    if (type === 'up') {
      if (this._resizing) {
        this.app.history.push('resize');
        this.app.save();
        this._resizing = null;
        canvas.render(proj);
        return;
      }
      if (this._drag && this._drag.moved) {
        this.app.history.push('move');
        this.app.save();
      }
      this._drag = null;
      if (this._boxStart) {
        const hits = canvas.boxSelectObjects(this._boxStart.x, this._boxStart.y, x, y, proj);
        hits.forEach(o => canvas.selection.add(o.id));
        canvas.clearSelectionBox();
        this._boxStart = null;
        this.app.onSelectionChange();
        canvas.render(proj);
      }
    }

    if (type === 'dblclick' && this.app.editMode) {
      const hit = canvas.hitTest(x, y, proj);
      if (hit && hit.label !== undefined) {
        event.stopPropagation();
        event.preventDefault();
        // Prefer inline edit; fall back to modal
        TFS.UI.prompt('Edit label', hit.label || hit.text || '').then(newLabel => {
          if (newLabel === null) return;
          if (hit.type === 'text') hit.text = newLabel;
          else hit.label = newLabel;
          this.app.history.push('edit-label');
          this.app.save();
          canvas.render(proj);
        });
      }
    }
  }

  _isLocked(proj, obj) {
    const layer = (proj.layers || []).find(l => l.id === obj.layerId);
    return layer ? layer.locked : false;
  }

  activate() {}
  deactivate() { this._drag = null; this._boxStart = null; this._resizing = null; }
};

/* ========== SHAPE TOOL ========== */
TFS.ShapeTool = class {
  constructor(app, shapeType) { this.app = app; this.name = 'shape-' + shapeType; this.shapeType = shapeType; }

  onMouse(type, x, y, event, canvas) {
    if (type !== 'down' || !this.app.editMode) return;
    event.stopPropagation();
    event.preventDefault();
    const proj = this.app.project;
    const layer = this.app.activeLayerId || (proj.layers[0] && proj.layers[0].id) || 'layer-1';
    const obj = {
      id: TFS.Storage.uid(), type: this.shapeType,
      x: Math.round(x - 80), y: Math.round(y - 26),
      w: 160, h: 52, label: 'New ' + this.shapeType,
      style: { fill: '#2b2b2b', stroke: '#888', strokeWidth: 1.5,
               fontSize: 12, fontColour: '#dcdcdc' },
      layerId: layer, note: ''
    };
    proj.objects.push(obj);
    canvas.selection.clear();
    canvas.selection.add(obj.id);
    this.app.history.push('add-shape');
    this.app.save();
    canvas.render(proj);
    this.app.onSelectionChange();
    // Switch back to select so tool does not lock
    this.app.setTool('select');
  }

  activate() {}
  deactivate() {}
};

/* ========== EDGE TOOL ========== */
TFS.EdgeTool = class {
  constructor(app) { this.app = app; this.name = 'edge'; this._sourceId = null; this._preview = null; }

  onMouse(type, x, y, event, canvas) {
    const proj = this.app.project;
    if (!proj || !this.app.editMode) return;

    if (type === 'down') {
      const hit = canvas.hitTest(x, y, proj);
      if (hit && hit.label !== undefined && hit.type !== 'freehand') {
        if (!this._sourceId) {
          this._sourceId = hit.id;
          canvas.selection.clear();
          canvas.selection.add(hit.id);
          canvas.render(proj);
          event.stopPropagation();
        } else if (hit.id !== this._sourceId) {
          // Create edge
          const layer = this.app.activeLayerId || (proj.layers[0] && proj.layers[0].id) || 'layer-1';
          proj.edges.push({
            id: TFS.Storage.uid(), source: this._sourceId, target: hit.id,
            label: '', style: { stroke: 'var(--text-muted)', strokeWidth: 1.5, dashed: false, arrowHead: 'triangle' },
            layerId: layer
          });
          this._sourceId = null;
          this.app.history.push('add-edge');
          this.app.save();
          canvas.selection.clear();
          canvas.render(proj);
          event.stopPropagation();
        }
      } else {
        this._sourceId = null;
      }
    }

    if (type === 'move' && this._sourceId) {
      // Draw preview line
      const src = proj.objects.find(o => o.id === this._sourceId);
      if (src) {
        canvas.annotationLayer.selectAll('.edge-preview').remove();
        canvas.annotationLayer.append('line').attr('class', 'edge-preview')
          .attr('x1', src.x + (src.w || 160) / 2).attr('y1', src.y + (src.h || 52) / 2)
          .attr('x2', x).attr('y2', y)
          .attr('stroke', 'var(--interactive-accent)').attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '6,3');
      }
    }

    if (type === 'up') {
      canvas.annotationLayer.selectAll('.edge-preview').remove();
    }
  }

  activate() { this._sourceId = null; }
  deactivate() { this._sourceId = null; if (this.app.canvas) this.app.canvas.annotationLayer.selectAll('.edge-preview').remove(); }
};

/* ========== TEXT TOOL ========== */
TFS.TextTool = class {
  constructor(app) { this.app = app; this.name = 'text'; }

  onMouse(type, x, y, event, canvas) {
    if (type !== 'down' || !this.app.editMode) return;
    event.stopPropagation();
    event.preventDefault();
    const proj = this.app.project;
    const layer = this.app.activeLayerId || (proj.layers[0] && proj.layers[0].id) || 'layer-1';
    const cx = Math.round(x);
    const cy = Math.round(y);
    TFS.UI.prompt('Enter text', 'Label').then(label => {
      if (!label) { this.app.setTool('select'); return; }
      const obj = {
        id: TFS.Storage.uid(), type: 'text',
        x: cx, y: cy, w: 200, h: 36,
        label, text: label,
        style: { fontSize: 14, fontColour: '#dcdcdc', fontWeight: 'normal' },
        layerId: layer, note: ''
      };
      proj.objects.push(obj);
      canvas.selection.clear();
      canvas.selection.add(obj.id);
      this.app.history.push('add-text');
      this.app.save();
      canvas.render(proj);
      this.app.setTool('select');
    });
  }

  activate() {}
  deactivate() {}
};

/* ========== FREEHAND TOOL ========== */
TFS.FreehandTool = class {
  constructor(app) { this.app = app; this.name = 'freehand'; this._drawing = false; this._points = []; this._previewEl = null; }

  onMouse(type, x, y, event, canvas) {
    if (!this.app.editMode) return;
    const proj = this.app.project;

    if (type === 'down') {
      this._drawing = true;
      this._points = [[x, y]];
      event.stopPropagation();
      event.preventDefault();
      // Disable zoom while drawing
      canvas.svg.on('.zoom', null);
    }

    if (type === 'move' && this._drawing) {
      this._points.push([x, y]);
      // Live preview
      canvas.annotationLayer.selectAll('.freehand-preview').remove();
      const pts = this._points.map(p => p.join(',')).join(' ');
      canvas.annotationLayer.append('polyline').attr('class', 'freehand-preview')
        .attr('points', pts)
        .attr('fill', 'none')
        .attr('stroke', 'var(--interactive-accent)')
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round');
    }

    if (type === 'up' && this._drawing) {
      this._drawing = false;
      canvas.annotationLayer.selectAll('.freehand-preview').remove();
      // Re-enable zoom
      canvas.svg.call(canvas.zoom);

      if (this._points.length > 3) {
        const layer = this.app.activeLayerId || (proj.layers[0] && proj.layers[0].id) || 'layer-1';
        // Calculate bounding box for position
        let minX = Infinity, minY = Infinity;
        this._points.forEach(p => { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); });
        proj.objects.push({
          id: TFS.Storage.uid(), type: 'freehand',
          x: minX, y: minY, w: 0, h: 0,
          points: this._points.map(p => [Math.round(p[0]), Math.round(p[1])]),
          style: { stroke: 'var(--interactive-accent)', strokeWidth: 2 },
          layerId: layer, note: ''
        });
        this.app.history.push('add-freehand');
        this.app.save();
        canvas.render(proj);
      }
      this._points = [];
    }
  }

  activate() {}
  deactivate() { this._drawing = false; this._points = []; }
};
