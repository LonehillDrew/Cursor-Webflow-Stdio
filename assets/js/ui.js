/**
 * UI — in-app modals (replaces browser prompt/confirm).
 * Dark Obsidian-style cards, centred, backdrop overlay.
 */
'use strict';
window.TFS = window.TFS || {};

TFS.UI = {
  /** Prompt for a string value. Returns Promise<string|null>. */
  prompt(title, defaultValue, placeholder) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.innerHTML =
        '<div class="modal-box modal-prompt">' +
          '<h2></h2>' +
          '<input type="text" class="modal-input" autocomplete="off">' +
          '<div class="modal-actions">' +
            '<button type="button" class="btn btn-secondary modal-cancel">Cancel</button>' +
            '<button type="button" class="btn btn-primary modal-confirm">Confirm</button>' +
          '</div>' +
        '</div>';
      overlay.querySelector('h2').textContent = title || 'Input';
      const input = overlay.querySelector('.modal-input');
      input.value = defaultValue != null ? defaultValue : '';
      if (placeholder) input.placeholder = placeholder;

      const close = val => { overlay.remove(); resolve(val); };
      overlay.querySelector('.modal-cancel').onclick = () => close(null);
      overlay.querySelector('.modal-confirm').onclick = () => close(input.value);
      overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); close(input.value); }
        if (e.key === 'Escape') { e.preventDefault(); close(null); }
      });
      document.body.appendChild(overlay);
      setTimeout(() => { input.focus(); input.select(); }, 30);
    });
  },

  /** Confirm action. Returns Promise<boolean>. */
  confirm(message, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.setAttribute('role', 'dialog');
      const danger = !!opts.danger;
      overlay.innerHTML =
        '<div class="modal-box modal-confirm-box">' +
          '<h2></h2>' +
          '<p class="modal-message"></p>' +
          '<div class="modal-actions">' +
            '<button type="button" class="btn btn-secondary modal-cancel">Cancel</button>' +
            '<button type="button" class="btn modal-confirm">' + (opts.confirmLabel || 'Confirm') + '</button>' +
          '</div>' +
        '</div>';
      overlay.querySelector('h2').textContent = opts.title || 'Confirm';
      overlay.querySelector('.modal-message').textContent = message;
      const confBtn = overlay.querySelector('.modal-confirm');
      confBtn.classList.add(danger ? 'btn-danger' : 'btn-primary');

      const close = val => { overlay.remove(); resolve(val); };
      overlay.querySelector('.modal-cancel').onclick = () => close(false);
      confBtn.onclick = () => close(true);
      overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
      overlay.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
      });
      document.body.appendChild(overlay);
      setTimeout(() => confBtn.focus(), 30);
    });
  },

  /** Double-confirm for destructive actions. */
  async confirmDelete(itemName) {
    const first = await this.confirm(
      'Delete "' + itemName + '"? This cannot be undone.',
      { title: 'Delete', danger: true, confirmLabel: 'Delete' }
    );
    if (!first) return false;
    return this.confirm(
      'Are you sure? Confirm again to permanently delete "' + itemName + '".',
      { title: 'Confirm delete', danger: true, confirmLabel: 'Delete permanently' }
    );
  },

  alert(message, title) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML =
        '<div class="modal-box">' +
          '<h2></h2><p class="modal-message"></p>' +
          '<div class="modal-actions"><button type="button" class="btn btn-primary modal-confirm">OK</button></div>' +
        '</div>';
      overlay.querySelector('h2').textContent = title || 'Notice';
      overlay.querySelector('.modal-message').textContent = message;
      const close = () => { overlay.remove(); resolve(); };
      overlay.querySelector('.modal-confirm').onclick = close;
      overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
      document.body.appendChild(overlay);
    });
  },

  /** Inline contenteditable label edit on an SVG/DOM element. Returns Promise<string|null>. */
  editInline(el, currentText) {
    return new Promise(resolve => {
      const rect = el.getBoundingClientRect
        ? el.getBoundingClientRect()
        : { left: 100, top: 100, width: 160, height: 40 };
      const input = document.createElement('textarea');
      input.className = 'inline-edit';
      input.value = currentText || '';
      Object.assign(input.style, {
        position: 'fixed',
        left: Math.max(8, rect.left) + 'px',
        top: Math.max(8, rect.top) + 'px',
        width: Math.max(140, rect.width) + 'px',
        minHeight: Math.max(36, rect.height) + 'px',
        zIndex: '2000'
      });
      const finish = (commit) => {
        const val = input.value;
        input.remove();
        resolve(commit ? val : null);
      };
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      });
      input.addEventListener('blur', () => finish(true));
      document.body.appendChild(input);
      input.focus();
      input.select();
    });
  }
};
