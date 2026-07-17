/**
 * Canvas — SVG rendering engine with zoom/pan, selection, drag, grid.
 * Renders project objects (shapes, text, freehand) and edges.
 */
'use strict';
window.TFS = window.TFS || {};

TFS.Canvas = class Canvas {
  constructor(containerEl, app) {
    this.app = app;
    this.container = containerEl;
    this.selection = new Set();
    this.hoveredId = null;
    this._dragState = null;
    this._boxSelect = null;

    // Create SVG
    this.svg = d3.select(containerEl).append('svg')
      .attr('class', 'studio-svg')
      .attr('width', '100%')
      .attr('height', '100%');

    // Defs for arrowheads
    const defs = this.svg.append('defs');
    ['triangle','diamond','circle','none'].forEach(t => {
      if (t === 'none') return;
      const m = defs.append('marker')
        .attr('id', 'arrow-' + t)
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 10).attr('refY', 5)
        .attr('markerWidth', 8).attr('markerHeight', 8)
        .attr('orient', 'auto-start-reverse')
        .attr('fill', 'var(--text-muted)');
      if (t === 'triangle') m.append('path').attr('d', 'M0,0 L10,5 L0,10 Z');
      if (t === 'diamond') m.append('path').attr('d', 'M0,5 L5,0 L10,5 L5,10 Z');
      if (t === 'circle') m.append('circle').attr('cx', 5).attr('cy', 5).attr('r', 4);
    });

    // Grid pattern
    const gp = defs.append('pattern')
      .attr('id', 'grid-pattern')
      .attr('width', 24).attr('height', 24)
      .attr('patternUnits', 'userSpaceOnUse');
    gp.append('rect').attr('width', 24).attr('height', 24).attr('fill', 'none');
    gp.append('circle').attr('cx', 12).attr('cy', 12).attr('r', 0.8).attr('fill', 'var(--text-faint, #333)');

    // Layers in order: grid, edges, objects, annotations, selection box
    this.gridLayer = this.svg.append('g').attr('class', 'layer-grid');
    this.gridRect = this.gridLayer.append('rect')
      .attr('width', 20000).attr('height', 20000)
      .attr('x', -10000).attr('y', -10000)
      .attr('fill', 'url(#grid-pattern)');

    this.mainGroup = this.svg.append('g').attr('class', 'main-group');
    this.edgeLayer = this.mainGroup.append('g').attr('class', 'layer-edges');
    this.objectLayer = this.mainGroup.append('g').attr('class', 'layer-objects');
    this.annotationLayer = this.mainGroup.append('g').attr('class', 'layer-annotations');
    this.selBoxLayer = this.svg.append('g').attr('class', 'layer-selbox');

    // Zoom / pan via D3-zoom — filter so drawing tools are not captured by pan
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .filter((event) => {
        if (event.type === 'wheel') return true;
        if (event.button === 1) return true;
        if (event.type === 'mousedown' || event.type === 'touchstart') {
          const tool = this.app && this.app.activeTool;
          const toolName = tool && tool.name;
          // Drawing tools own the pointer completely
          if (toolName && toolName !== 'select') return false;
          // Select tool: do not pan when clicking an object
          if (event.clientX != null && this.app && this.app.project) {
            const rect = this.container.getBoundingClientRect();
            const cp = this.screenToCanvas(event.clientX - rect.left, event.clientY - rect.top);
            if (this.hitTest(cp.x, cp.y, this.app.project)) return false;
          }
        }
        return !event.ctrlKey && (!event.button || event.button === 0);
      })
      .on('zoom', (e) => {
        this.mainGroup.attr('transform', e.transform);
        this.gridLayer.attr('transform', e.transform);
        this._currentTransform = e.transform;
        this.app.onViewportChange && this.app.onViewportChange(e.transform);
      });
    this.svg.call(this.zoom);
    // Disable double-click zoom (conflicts with label edit)
    this.svg.on('dblclick.zoom', null);
    this._currentTransform = d3.zoomIdentity;

    // Mouse events for tools
    this.svg.on('mousedown', e => this._onMouse('down', e));
    this.svg.on('mousemove', e => this._onMouse('move', e));
    this.svg.on('mouseup', e => this._onMouse('up', e));
    this.svg.on('dblclick.custom', e => this._onMouse('dblclick', e));

    // Touch events
    this.svg.on('touchstart', e => this._onTouch('down', e));
    this.svg.on('touchmove', e => this._onTouch('move', e));
    this.svg.on('touchend', e => this._onTouch('up', e));
  }

  /* ---------- coordinate transform ---------- */
  screenToCanvas(sx, sy) {
    const t = this._currentTransform;
    return { x: (sx - t.x) / t.k, y: (sy - t.y) / t.k };
  }

  canvasToScreen(cx, cy) {
    const t = this._currentTransform;
    return { x: cx * t.k + t.x, y: cy * t.k + t.y };
  }

  /* ---------- mouse dispatch ---------- */
  _onMouse(type, event) {
    const tool = this.app.activeTool;
    if (!tool) return;
    const rect = this.container.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const cp = this.screenToCanvas(sx, sy);
    tool.onMouse && tool.onMouse(type, cp.x, cp.y, event, this);
  }

  _onTouch(type, event) {
    if (event.touches && event.touches.length > 1) return; // Let zoom handle pinch
    const touch = event.changedTouches ? event.changedTouches[0] : event.touches[0];
    if (!touch) return;
    const rect = this.container.getBoundingClientRect();
    const sx = touch.clientX - rect.left;
    const sy = touch.clientY - rect.top;
    const cp = this.screenToCanvas(sx, sy);
    const tool = this.app.activeTool;
    if (tool && tool.onMouse) {
      if (type === 'down') event.preventDefault();
      tool.onMouse(type, cp.x, cp.y, event, this);
    }
  }

  /* ---------- rendering ---------- */
  render(proj) {
    if (!proj) return;
    this._renderEdges(proj);
    this._renderObjects(proj);
    this._renderAnnotations(proj);
  }

  _renderEdges(proj) {
    const edges = (proj.edges || []).filter(e => this._layerVisible(proj, e.layerId));
    const sel = this.edgeLayer.selectAll('.edge-group').data(edges, d => d.id);
    sel.exit().remove();

    const enter = sel.enter().append('g').attr('class', 'edge-group');
    enter.append('line').attr('class', 'edge-line');
    enter.append('text').attr('class', 'edge-label');

    const all = enter.merge(sel);
    all.each((d, i, nodes) => {
      const g = d3.select(nodes[i]);
      const srcObj = proj.objects.find(o => o.id === d.source);
      const tgtObj = proj.objects.find(o => o.id === d.target);
      if (!srcObj || !tgtObj) return;
      const sx = srcObj.x + (srcObj.w || 0) / 2;
      const sy = srcObj.y + (srcObj.h || 0) / 2;
      const tx = tgtObj.x + (tgtObj.w || 0) / 2;
      const ty = tgtObj.y + (tgtObj.h || 0) / 2;

      const line = g.select('.edge-line')
        .attr('x1', sx).attr('y1', sy)
        .attr('x2', tx).attr('y2', ty)
        .attr('stroke', d.style.stroke || 'var(--text-muted)')
        .attr('stroke-width', d.style.strokeWidth || 1.5)
        .attr('stroke-dasharray', d.style.dashed ? '6,4' : 'none');

      if (d.style.arrowHead && d.style.arrowHead !== 'none') {
        line.attr('marker-end', 'url(#arrow-' + d.style.arrowHead + ')');
      } else {
        line.attr('marker-end', null);
      }

      const selected = this.selection.has(d.id);
      g.classed('selected', selected);

      if (d.label) {
        g.select('.edge-label')
          .attr('x', (sx + tx) / 2).attr('y', (sy + ty) / 2 - 6)
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--text-muted)')
          .attr('font-size', 10)
          .text(d.label);
      }
    });
  }

  _renderObjects(proj) {
    const objs = (proj.objects || []).filter(o => this._layerVisible(proj, o.layerId));
    const sel = this.objectLayer.selectAll('.obj-group').data(objs, d => d.id);
    sel.exit().remove();

    const enter = sel.enter().append('g').attr('class', 'obj-group');
    const all = enter.merge(sel);

    all.each((d, i, nodes) => {
      const g = d3.select(nodes[i]);
      g.selectAll('*').remove();
      g.attr('transform', `translate(${d.x}, ${d.y})`);

      const selected = this.selection.has(d.id);
      const hovered = this.hoveredId === d.id;
      g.classed('selected', selected).classed('hovered', hovered);

      if (d.type === 'text') {
        this._renderTextObj(g, d);
      } else if (d.type === 'freehand') {
        this._renderFreehand(g, d);
      } else {
        this._renderShape(g, d);
      }

      // Selection handles
      if (selected && this.app.editMode) {
        const w = d.w || 100, h = d.h || 50;
        g.append('rect').attr('class', 'sel-handle')
          .attr('x', -3).attr('y', -3)
          .attr('width', w + 6).attr('height', h + 6)
          .attr('fill', 'none')
          .attr('stroke', 'var(--interactive-accent)')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4,2')
          .attr('rx', 3);
        // Resize handle
        g.append('rect').attr('class', 'resize-handle')
          .attr('x', w - 4).attr('y', h - 4)
          .attr('width', 8).attr('height', 8)
          .attr('fill', 'var(--interactive-accent)')
          .attr('rx', 2)
          .style('cursor', 'nwse-resize');
      }
    });
  }

  _renderShape(g, d) {
    const w = d.w || 160, h = d.h || 52;
    const fill = d.style.fill || 'var(--background-secondary)';
    const stroke = d.style.stroke || 'var(--text-muted)';
    const sw = d.style.strokeWidth || 1.5;

    switch (d.type) {
      case 'circle':
        g.append('ellipse')
          .attr('cx', w / 2).attr('cy', h / 2)
          .attr('rx', w / 2).attr('ry', h / 2)
          .attr('fill', fill).attr('stroke', stroke).attr('stroke-width', sw);
        break;
      case 'ellipse':
        g.append('ellipse')
          .attr('cx', w / 2).attr('cy', h / 2)
          .attr('rx', w / 2).attr('ry', h / 2)
          .attr('fill', fill).attr('stroke', stroke).attr('stroke-width', sw);
        break;
      case 'diamond':
        g.append('polygon')
          .attr('points', `${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}`)
          .attr('fill', fill).attr('stroke', stroke).attr('stroke-width', sw);
        break;
      case 'hex':
        const qw = w * 0.25;
        g.append('polygon')
          .attr('points', `${qw},0 ${w-qw},0 ${w},${h/2} ${w-qw},${h} ${qw},${h} 0,${h/2}`)
          .attr('fill', fill).attr('stroke', stroke).attr('stroke-width', sw);
        break;
      case 'parallelogram':
        const off = w * 0.15;
        g.append('polygon')
          .attr('points', `${off},0 ${w},0 ${w-off},${h} 0,${h}`)
          .attr('fill', fill).attr('stroke', stroke).attr('stroke-width', sw);
        break;
      default: // rect
        g.append('rect')
          .attr('width', w).attr('height', h)
          .attr('rx', 6).attr('ry', 6)
          .attr('fill', fill).attr('stroke', stroke).attr('stroke-width', sw);
    }
    // Label
    if (d.label) {
      const fo = g.append('foreignObject')
        .attr('x', 4).attr('y', 2)
        .attr('width', w - 8).attr('height', h - 4);
      fo.append('xhtml:div')
        .attr('class', 'node-label')
        .style('color', d.style.fontColour || 'var(--text-normal)')
        .style('font-size', (d.style.fontSize || 12) + 'px')
        .style('width', '100%').style('height', '100%')
        .style('display', 'flex').style('align-items', 'center').style('justify-content', 'center')
        .style('text-align', 'center').style('overflow', 'hidden')
        .style('word-break', 'break-word').style('line-height', '1.2')
        .text(d.label);
    }
  }

  _renderTextObj(g, d) {
    const fo = g.append('foreignObject')
      .attr('x', 0).attr('y', 0)
      .attr('width', d.w || 200).attr('height', d.h || 40);
    fo.append('xhtml:div')
      .attr('class', 'text-obj-label')
      .style('color', d.style.fontColour || 'var(--text-normal)')
      .style('font-size', (d.style.fontSize || 14) + 'px')
      .style('font-weight', d.style.fontWeight || 'normal')
      .text(d.text || d.label || 'Text');
  }

  _renderFreehand(g, d) {
    if (!d.points || d.points.length < 2) return;
    // Offset so group origin is at 0,0 (points are absolute, translate is d.x, d.y)
    const pts = d.points.map(p => `${p[0] - d.x},${p[1] - d.y}`).join(' ');
    g.append('polyline')
      .attr('points', pts)
      .attr('fill', 'none')
      .attr('stroke', d.style.stroke || 'var(--interactive-accent)')
      .attr('stroke-width', d.style.strokeWidth || 2)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round');
  }

  _renderAnnotations(proj) {
    // Freehand items already in objects array, rendered above
    // This layer is for temporary drawing preview
  }

  _layerVisible(proj, layerId) {
    if (!layerId) return true;
    const layer = (proj.layers || []).find(l => l.id === layerId);
    return layer ? layer.visible : true;
  }

  /* ---------- hit testing ---------- */
  hitTest(x, y, proj) {
    // Check objects in reverse order (top-most first)
    const objs = (proj.objects || []).slice().reverse();
    for (const obj of objs) {
      if (!this._layerVisible(proj, obj.layerId)) continue;
      if (obj.type === 'freehand') {
        if (this._hitFreehand(x, y, obj)) return obj;
      } else {
        const w = obj.w || 160, h = obj.h || 52;
        if (x >= obj.x && x <= obj.x + w && y >= obj.y && y <= obj.y + h) return obj;
      }
    }
    // Check edges
    for (const edge of (proj.edges || []).slice().reverse()) {
      if (this._hitEdge(x, y, edge, proj)) return edge;
    }
    return null;
  }

  _hitFreehand(x, y, obj) {
    if (!obj.points) return false;
    const threshold = 8;
    for (const p of obj.points) {
      if (Math.abs(x - p[0]) < threshold && Math.abs(y - p[1]) < threshold) return true;
    }
    return false;
  }

  _hitEdge(x, y, edge, proj) {
    const src = proj.objects.find(o => o.id === edge.source);
    const tgt = proj.objects.find(o => o.id === edge.target);
    if (!src || !tgt) return false;
    const sx = src.x + (src.w || 0) / 2, sy = src.y + (src.h || 0) / 2;
    const tx = tgt.x + (tgt.w || 0) / 2, ty = tgt.y + (tgt.h || 0) / 2;
    // Point-to-line distance
    const len = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);
    if (len === 0) return false;
    const t = Math.max(0, Math.min(1, ((x - sx) * (tx - sx) + (y - sy) * (ty - sy)) / (len * len)));
    const px = sx + t * (tx - sx), py = sy + t * (ty - sy);
    return Math.sqrt((x - px) ** 2 + (y - py) ** 2) < 8;
  }

  /* ---------- box select ---------- */
  boxSelectObjects(x1, y1, x2, y2, proj) {
    const left = Math.min(x1, x2), right = Math.max(x1, x2);
    const top = Math.min(y1, y2), bottom = Math.max(y1, y2);
    return (proj.objects || []).filter(o => {
      if (!this._layerVisible(proj, o.layerId)) return false;
      const w = o.w || 160, h = o.h || 52;
      return o.x + w > left && o.x < right && o.y + h > top && o.y < bottom;
    });
  }

  drawSelectionBox(x1, y1, x2, y2) {
    this.selBoxLayer.selectAll('*').remove();
    if (x1 == null) return;
    const t = this._currentTransform;
    this.selBoxLayer.append('rect')
      .attr('x', Math.min(x1, x2) * t.k + t.x)
      .attr('y', Math.min(y1, y2) * t.k + t.y)
      .attr('width', Math.abs(x2 - x1) * t.k)
      .attr('height', Math.abs(y2 - y1) * t.k)
      .attr('fill', 'rgba(var(--interactive-accent-rgb, 72,120,198), 0.12)')
      .attr('stroke', 'var(--interactive-accent)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,3');
  }

  clearSelectionBox() { this.selBoxLayer.selectAll('*').remove(); }

  /* ---------- zoom helpers ---------- */
  zoomTo(k) {
    this.svg.transition().duration(300).call(this.zoom.scaleTo, k);
  }
  zoomIn() { this.svg.transition().duration(200).call(this.zoom.scaleBy, 1.3); }
  zoomOut() { this.svg.transition().duration(200).call(this.zoom.scaleBy, 0.77); }
  fitAll(proj) {
    if (!proj || !proj.objects.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    proj.objects.forEach(o => {
      minX = Math.min(minX, o.x);
      minY = Math.min(minY, o.y);
      maxX = Math.max(maxX, o.x + (o.w || 160));
      maxY = Math.max(maxY, o.y + (o.h || 52));
    });
    const pad = 60;
    const rect = this.container.getBoundingClientRect();
    const kx = rect.width / (maxX - minX + pad * 2);
    const ky = rect.height / (maxY - minY + pad * 2);
    const k = Math.min(kx, ky, 2);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    this.svg.transition().duration(400).call(
      this.zoom.transform,
      d3.zoomIdentity.translate(rect.width / 2, rect.height / 2).scale(k).translate(-cx, -cy)
    );
  }

  showGrid(show) {
    this.gridLayer.style('display', show ? null : 'none');
  }

  getTransform() { return this._currentTransform; }

  /* ---------- auto-layout with D3-force ---------- */
  autoLayout(proj) {
    if (!proj || proj.readonly) return;
    const nodes = proj.objects.filter(o => o.type !== 'freehand').map(o => ({
      id: o.id, x: o.x + (o.w || 160) / 2, y: o.y + (o.h || 52) / 2,
      w: o.w || 160, h: o.h || 52
    }));
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = n; });
    const links = proj.edges.filter(e => nodeMap[e.source] && nodeMap[e.target])
      .map(e => ({ source: e.source, target: e.target }));

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(180))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(400, 300))
      .force('collision', d3.forceCollide().radius(d => Math.max(d.w, d.h) / 2 + 20))
      .stop();

    for (let i = 0; i < 200; i++) sim.tick();

    nodes.forEach(n => {
      const obj = proj.objects.find(o => o.id === n.id);
      if (obj) { obj.x = Math.round(n.x - (obj.w || 160) / 2); obj.y = Math.round(n.y - (obj.h || 52) / 2); }
    });
  }
};
