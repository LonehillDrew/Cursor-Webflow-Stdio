/**
 * Dashboard — hero cards for Old/New Flow, list of user charts, CRUD via modals.
 */
'use strict';
window.TFS = window.TFS || {};

TFS.Dashboard = class {
  constructor() {
    this._dragItem = null;
  }

  init() {
    TFS.Storage.ensureBuiltIns();
    this.heroEl = document.getElementById('hero-cards');
    this.listEl = document.getElementById('project-list');
    this.render();

    document.getElementById('new-project-btn').addEventListener('click', () => this._createNew());
    document.getElementById('import-btn').addEventListener('click', () => {
      document.getElementById('import-input').click();
    });
    document.getElementById('import-input').addEventListener('change', e => this._importFile(e));
    const backupBtn = document.getElementById('backup-btn');
    if (backupBtn) backupBtn.addEventListener('click', () => {
      TFS.Storage.exportBackup();
    });
    const dupOld = document.getElementById('dup-old-btn');
    const dupNew = document.getElementById('dup-new-btn');
    if (dupOld) dupOld.addEventListener('click', () => this._duplicate('old'));
    if (dupNew) dupNew.addEventListener('click', () => this._duplicate('new'));

    // Drop zone
    const dropZone = document.getElementById('dashboard-drop');
    if (dropZone) {
      dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.json')) {
          this._doImport(files[0]);
        }
      });
    }
  }

  render() {
    this._renderHero();
    this._renderList();
  }

  _renderHero() {
    if (!this.heroEl) return;
    this.heroEl.innerHTML = '';
    [
      { id: 'old', name: 'Old Flow', desc: 'Original Tandem site map (current tandem.co.za structure). Fully editable.' },
      { id: 'new', name: 'New Flow', desc: 'Proposed mega-menu flow. Fully editable.' }
    ].forEach(b => {
      const proj = TFS.Storage.loadProject(b.id);
      const stats = TFS.Storage.projectStats(proj);
      const card = document.createElement('article');
      card.className = 'hero-card';
      card.innerHTML =
        '<div class="hero-card-body">' +
          '<h2 class="hero-title"></h2>' +
          '<p class="hero-desc"></p>' +
          '<div class="hero-stats">' +
            '<span><strong>' + stats.nodes + '</strong> nodes</span>' +
            '<span><strong>' + stats.sections + '</strong> sections</span>' +
            '<span><strong>' + stats.edges + '</strong> edges</span>' +
          '</div>' +
        '</div>' +
        '<div class="hero-actions">' +
          '<a class="btn btn-primary" href="studio.html?chart=' + b.id + '">Open →</a>' +
          '<button type="button" class="btn btn-secondary hero-dup">Duplicate</button>' +
        '</div>';
      card.querySelector('.hero-title').textContent = b.name;
      card.querySelector('.hero-desc').textContent = b.desc;
      card.querySelector('.hero-dup').addEventListener('click', () => this._duplicate(b.id));
      this.heroEl.appendChild(card);
    });
  }

  _renderList() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';
    const projects = TFS.Storage.listProjects()
      .filter(p => p.id !== 'old' && p.id !== 'new')
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (projects.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'list-empty';
      empty.innerHTML = '<p>No custom charts yet. Duplicate Old/New Flow or create a new project.</p>';
      this.listEl.appendChild(empty);
      return;
    }

    projects.forEach(p => {
      const full = TFS.Storage.loadProject(p.id);
      const stats = TFS.Storage.projectStats(full);
      const row = document.createElement('div');
      row.className = 'project-row';
      row.draggable = true;
      row.dataset.id = p.id;

      row.addEventListener('dragstart', e => {
        this._dragItem = p.id;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        this._dragItem = null;
        this._saveOrder();
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        if (this._dragItem && this._dragItem !== p.id) row.classList.add('drag-target');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-target'));
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('drag-target');
        if (this._dragItem && this._dragItem !== p.id) this._reorder(this._dragItem, p.id);
      });

      const info = document.createElement('div');
      info.className = 'row-info';
      const title = document.createElement('h3');
      title.textContent = p.name;
      info.appendChild(title);
      const meta = document.createElement('div');
      meta.className = 'row-meta';
      meta.textContent = stats.nodes + ' nodes · ' + stats.edges + ' edges · Edited ' +
        (p.modified ? new Date(p.modified).toLocaleDateString('en-GB') : '—');
      info.appendChild(meta);
      row.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'row-actions';

      const open = document.createElement('a');
      open.href = 'studio.html?chart=' + p.id;
      open.className = 'btn btn-sm btn-primary';
      open.textContent = 'Open';
      actions.appendChild(open);

      const ren = document.createElement('button');
      ren.className = 'btn btn-sm btn-secondary';
      ren.textContent = 'Rename';
      ren.onclick = async e => {
        e.stopPropagation();
        const n = await TFS.UI.prompt('Rename chart', p.name);
        if (n && n.trim()) { TFS.Storage.renameProject(p.id, n.trim()); this.render(); }
      };
      actions.appendChild(ren);

      const dup = document.createElement('button');
      dup.className = 'btn btn-sm btn-secondary';
      dup.textContent = 'Duplicate';
      dup.onclick = e => { e.stopPropagation(); this._duplicate(p.id); };
      actions.appendChild(dup);

      const exp = document.createElement('button');
      exp.className = 'btn btn-sm btn-secondary';
      exp.textContent = 'Export';
      exp.onclick = e => {
        e.stopPropagation();
        const fullP = TFS.Storage.loadProject(p.id);
        if (fullP) TFS.Storage.exportJSON(fullP);
      };
      actions.appendChild(exp);

      const del = document.createElement('button');
      del.className = 'btn btn-sm btn-danger';
      del.textContent = 'Delete';
      del.onclick = async e => {
        e.stopPropagation();
        const ok = await TFS.UI.confirmDelete(p.name);
        if (ok) { TFS.Storage.deleteProject(p.id); this.render(); }
      };
      actions.appendChild(del);

      row.appendChild(actions);
      row.addEventListener('click', e => {
        if (e.target.closest('a, button')) return;
        location.href = 'studio.html?chart=' + p.id;
      });
      this.listEl.appendChild(row);
    });
  }

  async _createNew() {
    const name = await TFS.UI.prompt('Project name', 'Untitled');
    if (!name || !name.trim()) return;
    const proj = TFS.Storage.createProject(name.trim());
    location.href = 'studio.html?chart=' + proj.id;
  }

  async _duplicate(id) {
    const src = TFS.Storage.loadProject(id);
    if (!src) return;
    const name = await TFS.UI.prompt('Name for duplicate', src.name + ' (copy)');
    if (!name || !name.trim()) return;
    const dup = TFS.Storage.duplicateProject(id, name.trim());
    if (dup) this.render();
  }

  async _doImport(file) {
    try {
      const result = await TFS.Storage.importJSON(file);
      if (result.type === 'backup') {
        await TFS.UI.alert('Restored ' + result.count + ' project(s) and ' + result.notes + ' note(s).', 'Backup restored');
      } else {
        await TFS.UI.alert('Imported "' + (result.project && result.project.name) + '".', 'Import complete');
      }
      this.render();
    } catch (err) {
      await TFS.UI.alert('Import failed: ' + err, 'Error');
    }
  }

  _importFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    this._doImport(file);
    e.target.value = '';
  }

  _reorder(dragId, targetId) {
    const projects = TFS.Storage.listProjects().filter(p => p.id !== 'old' && p.id !== 'new');
    const ids = projects.sort((a, b) => (a.order || 0) - (b.order || 0)).map(p => p.id);
    const dragIdx = ids.indexOf(dragId);
    const targetIdx = ids.indexOf(targetId);
    if (dragIdx < 0 || targetIdx < 0) return;
    ids.splice(dragIdx, 1);
    ids.splice(targetIdx, 0, dragId);
    TFS.Storage.reorderProjects(['old', 'new'].concat(ids));
    this.render();
  }

  _saveOrder() {
    const rows = this.listEl.querySelectorAll('.project-row[data-id]');
    const ids = [...rows].map(r => r.dataset.id);
    TFS.Storage.reorderProjects(['old', 'new'].concat(ids));
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const dash = new TFS.Dashboard();
  dash.init();
});
