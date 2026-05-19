/* TaxMitra — shared interactive checklist (tabs + progress) */
(function () {
  function initChecklist(root) {
    root = root || document;
    const progressEl = root.querySelector('.checklist-progress');
    const tabs = root.querySelectorAll('.checklist-tab');
    const panels = root.querySelectorAll('.checklist-panel');

    function updateProgress() {
      const active = root.querySelector('.checklist-panel.active');
      if (!active || !progressEl) return;
      const group = active.dataset.items;
      const boxes = root.querySelectorAll('input[data-group="' + group + '"]');
      const done = [...boxes].filter((b) => b.checked).length;
      const pct = boxes.length ? Math.round((done / boxes.length) * 100) : 0;
      const label = progressEl.dataset.label || 'items';
      progressEl.textContent = done + ' of ' + boxes.length + ' ' + label + ' ready — ' + pct + '%';
    }

    if (tabs.length) {
      tabs.forEach((t) =>
        t.addEventListener('click', () => {
          tabs.forEach((x) => x.classList.remove('active'));
          panels.forEach((p) => p.classList.remove('active'));
          t.classList.add('active');
          const panel = root.getElementById('tab-' + t.dataset.tab);
          if (panel) panel.classList.add('active');
          updateProgress();
        })
      );
    }

    root.querySelectorAll('.checklist-panel input[type=checkbox]').forEach((cb) => {
      cb.addEventListener('change', updateProgress);
    });
    updateProgress();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initChecklist(document));
  } else {
    initChecklist(document);
  }
})();
