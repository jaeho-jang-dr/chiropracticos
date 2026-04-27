/* =========================================================
   Chiropractic | UI behaviors
   - Mobile hamburger toggle (auto-injected)
   - Card / List view toggle (auto-injected for grids)
   - localStorage persistence for view mode
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Hamburger menu ---------- */
  function setupHamburger() {
    document.querySelectorAll('.site-nav .nav-inner').forEach(function (nav) {
      const links = nav.querySelector('.nav-links');
      if (!links) return;
      // skip secondary chapter-level inner navs that have no brand (still ok to add)
      if (nav.querySelector('.nav-toggle')) return;

      // Build hamburger button
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-toggle';
      btn.setAttribute('aria-label', '메뉴 열기');
      btn.setAttribute('aria-expanded', 'false');
      // ☰ unicode is the visible fallback if CSS for .bars fails to load.
      // CSS hides .hb-fallback when .bars renders correctly.
      btn.innerHTML = '<span class="bars" aria-hidden="true"><span></span></span><span class="hb-fallback" aria-hidden="true">☰</span>';

      // Mirror nav-actions into the dropdown so login/start buttons stay reachable on mobile
      const actions = nav.querySelector('.nav-actions');
      if (actions && !links.querySelector('.mobile-actions')) {
        const li = document.createElement('li');
        li.className = 'mobile-actions-wrap';
        const wrap = document.createElement('div');
        wrap.className = 'mobile-actions';
        Array.from(actions.children).forEach(function (a) {
          wrap.appendChild(a.cloneNode(true));
        });
        li.appendChild(wrap);
        links.appendChild(li);
      }

      // Append button at the end of nav-inner
      nav.appendChild(btn);

      btn.addEventListener('click', function () {
        const open = links.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
      });

      // Close on link click (mobile)
      links.addEventListener('click', function (e) {
        const a = e.target.closest('a');
        if (!a) return;
        if (window.matchMedia('(max-width: 900px)').matches) {
          links.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
          btn.setAttribute('aria-label', '메뉴 열기');
        }
      });

      // Close on outside click
      document.addEventListener('click', function (e) {
        if (!links.classList.contains('is-open')) return;
        if (nav.contains(e.target)) return;
        links.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', '메뉴 열기');
      });

      // Close on ESC
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && links.classList.contains('is-open')) {
          links.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
          btn.setAttribute('aria-label', '메뉴 열기');
          btn.focus();
        }
      });
    });
  }

  /* ---------- View toggle (card / list) ---------- */
  function buildToggle(targetId, storageKey) {
    const grid = document.getElementById(targetId)
      ? document.getElementById(targetId).querySelector('.curriculum-grid, .dashboard-grid')
      : null;
    if (!grid) return;
    if (grid.parentElement.querySelector('[data-view-toggle="' + targetId + '"]')) return;

    const wrap = document.createElement('div');
    wrap.className = 'view-toggle';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', '보기 방식');
    wrap.dataset.viewToggle = targetId;
    wrap.innerHTML =
      '<span class="vt-label">보기</span>' +
      '<button type="button" data-view="card" aria-pressed="true">▦ 카드</button>' +
      '<button type="button" data-view="list" aria-pressed="false">≡ 리스트</button>';

    grid.parentElement.insertBefore(wrap, grid);

    function apply(mode) {
      grid.classList.toggle('is-list', mode === 'list');
      wrap.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.view === mode ? 'true' : 'false');
      });
      try { localStorage.setItem(storageKey, mode); } catch (e) {}
    }

    wrap.addEventListener('click', function (e) {
      const b = e.target.closest('button[data-view]');
      if (!b) return;
      apply(b.dataset.view);
    });

    let saved = 'card';
    try { saved = localStorage.getItem(storageKey) || 'card'; } catch (e) {}
    apply(saved);
  }

  function setupViewToggles() {
    buildToggle('curriculum', 'chiro:view:curriculum');
    buildToggle('dashboard',  'chiro:view:dashboard');
  }

  /* ---------- Active link highlighting (top nav) ---------- */
  function setupActiveLink() {
    const path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.site-nav .nav-links a').forEach(function (a) {
      const href = a.getAttribute('href') || '';
      if (!href) return;
      const file = href.split('#')[0].split('/').pop();
      if (file && file === path && !href.startsWith('#')) {
        a.classList.add('active');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setupHamburger();
      setupViewToggles();
      setupActiveLink();
    });
  } else {
    setupHamburger();
    setupViewToggles();
    setupActiveLink();
  }
})();
