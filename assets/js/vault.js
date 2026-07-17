/**
 * Vault — notes with folders, tags, search, Obsidian-style markdown.
 * Tabs: All | Folders | Tags. Empty states + vault export.
 */
'use strict';
window.TFS = window.TFS || {};

TFS.Vault = class {
  constructor() {
    this.notes = [];
    this.folders = [];
    this.activeNote = null;
    this.activeFolder = null;
    this.activeTag = null;
    this.viewMode = 'all'; // all | folders | tags
    this.searchTerm = '';
    this._saveTimer = null;
  }

  init() {
    this.notes = TFS.Storage.getVaultNotes();
    this.folders = TFS.Storage.getVaultFolders();
    if (this.folders.length === 0) { this.folders = ['General']; TFS.Storage.saveVaultFolders(this.folders); }

    this.folderList = document.getElementById('folder-list');
    this.noteList = document.getElementById('note-list');
    this.editorArea = document.getElementById('editor-area');
    this.previewArea = document.getElementById('preview-area');
    this.searchInput = document.getElementById('vault-search');
    this.emptyState = document.getElementById('vault-empty');

    this.searchInput.addEventListener('input', () => { this.searchTerm = this.searchInput.value; this.renderNoteList(); });
    document.getElementById('new-note-btn').addEventListener('click', () => this._newNote());
    document.getElementById('new-folder-btn').addEventListener('click', () => this._newFolder());
    document.getElementById('editor-toggle').addEventListener('click', () => this._togglePreview());
    const exportBtn = document.getElementById('export-vault-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => this._exportVault());

    document.querySelectorAll('[data-vault-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        this.viewMode = tab.dataset.vaultTab;
        this.activeTag = null;
        if (this.viewMode === 'all') this.activeFolder = null;
        document.querySelectorAll('[data-vault-tab]').forEach(t => t.classList.toggle('active', t === tab));
        this.renderFolders();
        this.renderNoteList();
      });
    });

    this.editorArea.addEventListener('input', () => this._onEdit());
    this._showEmpty(!this.activeNote);
    this.renderFolders();
    this.renderNoteList();
  }

  _showEmpty(show) {
    if (this.emptyState) this.emptyState.style.display = show ? 'flex' : 'none';
    if (this.editorArea) this.editorArea.style.display = show ? 'none' : '';
    if (this.previewArea) this.previewArea.style.display = show ? 'none' : '';
  }

  renderFolders() {
    this.folderList.innerHTML = '';
    if (this.viewMode === 'tags') {
      const tags = this._allTags();
      if (tags.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'folder-item muted';
        empty.textContent = 'No tags yet';
        this.folderList.appendChild(empty);
        return;
      }
      tags.forEach(tag => {
        const item = document.createElement('div');
        item.className = 'folder-item' + (this.activeTag === tag ? ' active' : '');
        item.textContent = '#' + tag;
        item.onclick = () => { this.activeTag = tag; this.renderFolders(); this.renderNoteList(); };
        this.folderList.appendChild(item);
      });
      return;
    }

    if (this.viewMode === 'all') {
      const allBtn = document.createElement('div');
      allBtn.className = 'folder-item' + (this.activeFolder === null ? ' active' : '');
      allBtn.textContent = 'All Notes';
      allBtn.onclick = () => { this.activeFolder = null; this.activeTag = null; this.renderFolders(); this.renderNoteList(); };
      this.folderList.appendChild(allBtn);
      return;
    }

    // Folders tab
    this.folders.forEach(f => {
      const item = document.createElement('div');
      item.className = 'folder-item' + (this.activeFolder === f ? ' active' : '');
      item.textContent = f;
      item.onclick = () => { this.activeFolder = f; this.renderFolders(); this.renderNoteList(); };
      item.addEventListener('contextmenu', async e => {
        e.preventDefault();
        const action = await TFS.UI.prompt('Folder action for "' + f + '"', '', 'Type rename or delete');
        if (!action) return;
        if (action.toLowerCase() === 'delete') await this._deleteFolder(f);
        if (action.toLowerCase() === 'rename') {
          const nn = await TFS.UI.prompt('New folder name', f);
          if (nn) this._renameFolder(f, nn.trim());
        }
      });
      this.folderList.appendChild(item);
    });
  }

  _allTags() {
    const set = new Set();
    this.notes.forEach(n => (n.tags || []).forEach(t => set.add(t)));
    return [...set].sort();
  }

  renderNoteList() {
    this.noteList.innerHTML = '';
    let filtered = this.notes;
    if (this.viewMode === 'folders' && this.activeFolder) {
      filtered = filtered.filter(n => n.folder === this.activeFolder);
    }
    if (this.viewMode === 'tags' && this.activeTag) {
      filtered = filtered.filter(n => (n.tags || []).includes(this.activeTag));
    }
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      filtered = filtered.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.body || '').toLowerCase().includes(q) ||
        (n.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    filtered.sort((a, b) => (b.modified || 0) - (a.modified || 0));

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'list-empty-sm';
      empty.textContent = this.notes.length === 0 ? 'No notes yet — create one above.' : 'No matching notes.';
      this.noteList.appendChild(empty);
      return;
    }

    filtered.forEach(note => {
      const item = document.createElement('div');
      item.className = 'note-item' + (this.activeNote && this.activeNote.id === note.id ? ' active' : '');
      const title = document.createElement('span');
      title.className = 'note-title';
      title.textContent = note.title || 'Untitled';
      item.appendChild(title);

      if (note.tags && note.tags.length) {
        const tags = document.createElement('span');
        tags.className = 'note-tags';
        tags.textContent = note.tags.map(t => '#' + t).join(' ');
        item.appendChild(tags);
      }

      item.onclick = () => this._openNote(note);
      item.addEventListener('contextmenu', async e => {
        e.preventDefault();
        const action = await TFS.UI.prompt('Note action for "' + note.title + '"', '', 'rename / delete / move / export');
        if (!action) return;
        const a = action.toLowerCase().trim();
        if (a === 'delete') await this._deleteNote(note);
        if (a === 'rename') {
          const nn = await TFS.UI.prompt('New title', note.title);
          if (nn) { note.title = nn.trim(); this._saveAll(); this.renderNoteList(); }
        }
        if (a === 'move') {
          const folder = await TFS.UI.prompt('Move to folder', note.folder || 'General');
          if (folder) {
            note.folder = folder.trim();
            if (!this.folders.includes(note.folder)) {
              this.folders.push(note.folder);
              TFS.Storage.saveVaultFolders(this.folders);
              this.renderFolders();
            }
            this._saveAll();
            this.renderNoteList();
          }
        }
        if (a === 'export') this._exportNote(note);
      });

      this.noteList.appendChild(item);
    });
  }

  _openNote(note) {
    this.activeNote = note;
    this.editorArea.value = note.body || '';
    this._showEmpty(false);
    this._renderPreview();
    this.renderNoteList();
    document.querySelector('.vault-editor').classList.add('active');
  }

  _onEdit() {
    if (!this.activeNote) return;
    this.activeNote.body = this.editorArea.value;
    this.activeNote.modified = Date.now();
    this.activeNote.tags = [...new Set((this.activeNote.body.match(/#([a-zA-Z0-9_-]+)/g) || []).map(t => t.slice(1)))];
    this._renderPreview();
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveAll(), 800);
  }

  _renderPreview() {
    if (!this.activeNote || !this.previewArea) return;
    let md = this.activeNote.body || '';
    md = this._processObsidianMD(md);
    this.previewArea.innerHTML = marked.parse(md, { breaks: true, gfm: true });
  }

  _processObsidianMD(md) {
    md = md.replace(/\[\[([^\]]+)\]\]/g, '<strong class="wikilink">$1</strong>');
    md = md.replace(/^>\s*\[!(note|tip|warning|danger|info|example|quote)\]\s*(.*)$/gm,
      (_, type, text) => `<div class="callout callout-${type}"><span class="callout-type">${type}</span> ${text}</div>`);
    md = md.replace(/==([^=]+)==/g, '<mark>$1</mark>');
    return md;
  }

  _togglePreview() {
    const editor = document.querySelector('.vault-editor');
    if (editor) editor.classList.toggle('preview-only');
    const btn = document.getElementById('editor-toggle');
    const isPrev = document.querySelector('.vault-editor.preview-only');
    btn.textContent = isPrev ? 'Edit' : 'Preview';
  }

  async _newNote() {
    const title = await TFS.UI.prompt('Note title', 'Untitled');
    if (!title || !title.trim()) return;
    const note = {
      id: TFS.Storage.uid(),
      title: title.trim(),
      body: '# ' + title.trim() + '\n\n',
      folder: this.activeFolder || 'General',
      tags: [], created: Date.now(), modified: Date.now()
    };
    this.notes.push(note);
    this._saveAll();
    this._openNote(note);
    this.renderNoteList();
  }

  async _deleteNote(note) {
    const ok = await TFS.UI.confirmDelete(note.title);
    if (!ok) return;
    this.notes = this.notes.filter(n => n.id !== note.id);
    if (this.activeNote && this.activeNote.id === note.id) {
      this.activeNote = null;
      this.editorArea.value = '';
      this.previewArea.innerHTML = '';
      this._showEmpty(true);
    }
    this._saveAll();
    this.renderNoteList();
  }

  _exportNote(note) {
    const blob = new Blob([note.body || ''], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (note.title || 'note').replace(/[^a-z0-9_-]/gi, '_') + '.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  _exportVault() {
    const parts = this.notes.map(n => {
      const header = '---\ntitle: ' + (n.title || 'Untitled') + '\nfolder: ' + (n.folder || 'General') + '\n---\n\n';
      return header + (n.body || '');
    });
    const blob = new Blob([parts.join('\n\n---\n\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tandem-vault-export.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async _newFolder() {
    const name = await TFS.UI.prompt('Folder name', '');
    if (!name || !name.trim() || this.folders.includes(name.trim())) return;
    this.folders.push(name.trim());
    TFS.Storage.saveVaultFolders(this.folders);
    this.viewMode = 'folders';
    document.querySelectorAll('[data-vault-tab]').forEach(t => t.classList.toggle('active', t.dataset.vaultTab === 'folders'));
    this.renderFolders();
  }

  async _deleteFolder(name) {
    const ok = await TFS.UI.confirm(
      'Delete folder "' + name + '"? Notes will move to General.',
      { title: 'Delete folder', danger: true, confirmLabel: 'Delete' }
    );
    if (!ok) return;
    this.notes.forEach(n => { if (n.folder === name) n.folder = 'General'; });
    this.folders = this.folders.filter(f => f !== name);
    if (this.activeFolder === name) this.activeFolder = null;
    TFS.Storage.saveVaultFolders(this.folders);
    this._saveAll();
    this.renderFolders();
    this.renderNoteList();
  }

  _renameFolder(oldName, newName) {
    this.notes.forEach(n => { if (n.folder === oldName) n.folder = newName; });
    this.folders = this.folders.map(f => f === oldName ? newName : f);
    if (this.activeFolder === oldName) this.activeFolder = newName;
    TFS.Storage.saveVaultFolders(this.folders);
    this._saveAll();
    this.renderFolders();
    this.renderNoteList();
  }

  _saveAll() {
    TFS.Storage.saveVaultNotes(this.notes);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const vault = new TFS.Vault();
  vault.init();
});
