/* ==========================================================================
   Minimal JS: mobile nav toggle, current year, repertoire search.
   No libraries.
   ========================================================================== */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  // Current year
  const y = $('[data-year]');
  if (y) y.textContent = String(new Date().getFullYear());

  // Mobile nav toggle
  const toggle = $('[data-nav-toggle]');
  const nav = $('[data-nav]');
  if (toggle && nav) {
    const close = () => {
      nav.dataset.open = 'false';
      toggle.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
      nav.dataset.open = 'true';
      toggle.setAttribute('aria-expanded', 'true');
    };

    toggle.addEventListener('click', () => {
      const isOpen = nav.dataset.open === 'true';
      isOpen ? close() : open();
    });

    // Close nav when clicking a link
    nav.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (a) close();
    });

    // Close on Escape / outside click
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
    document.addEventListener('click', (e) => {
      const within = e.target.closest('[data-nav]') || e.target.closest('[data-nav-toggle]');
      if (!within) close();
    });

    // Initialize
    close();
  }

  // Repertoire search
  const input = $('[data-rep-search]');
  const list = $('[data-rep-list]');
  if (input && list) {
    const items = Array.from(list.querySelectorAll('.rep-item'));
    const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е');

    input.addEventListener('input', () => {
      const q = norm(input.value).trim();
      if (!q) {
        items.forEach((el) => (el.hidden = false));
        return;
      }
      items.forEach((el) => {
        const text = norm(el.textContent);
        el.hidden = !text.includes(q);
      });
    });
  }
})();
