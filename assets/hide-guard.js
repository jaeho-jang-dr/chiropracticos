/* =========================================================
   Chiropractic | Hide Guard
   - public.hidden_assets 테이블에서 URL 목록 조회 → 일치 자산 즉시 hide
   - 매칭: 정확 일치(URL) + prefix 일치(URL이 /로 끝나면 prefix 모드)
   - 적용 대상: <a href>, <img src>, <video src>, <audio src>, <iframe src>, <source src>
   - 동적으로 추가되는 노드도 MutationObserver로 처리
   ========================================================= */
(function () {
  'use strict';

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.warn('[hide-guard] Supabase config missing — skipping');
    return;
  }

  const ENDPOINT = window.SUPABASE_URL.replace(/\/$/, '') +
    '/rest/v1/hidden_assets?select=url,page_path';
  const HEADERS = {
    'apikey': window.SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY,
  };

  let exactSet = new Set();   // 정확 일치 URL
  let prefixes = [];           // /로 끝나는 prefix
  let loaded = false;
  let wasSeeded = false;       // localStorage 캐시로 hide 목록을 시드했는지
  let failClosed = false;      // 캐시 없는데 fetch 실패 → 보호적으로 모든 후보 숨김

  // FOUC 방어 — 직전 세션에서 캐시한 hide 목록을 동기로 시드.
  // 첫 페인트 이전에 알려진 hidden URL을 숨김. fetch 결과 도착 후 갱신.
  const CACHE_KEY = '__hide_guard_cache_v1';
  try {
    const raw = window.localStorage && window.localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && Array.isArray(cached.exact) && Array.isArray(cached.prefixes)) {
        // 캐시는 24h 유효
        if (cached.ts && Date.now() - cached.ts < 24 * 3600 * 1000) {
          cached.exact.forEach(function (u) { exactSet.add(u); });
          prefixes = cached.prefixes.slice();
          loaded = true;
          wasSeeded = true;
        }
      }
    }
  } catch (_) { /* localStorage 차단·파싱 실패는 무시 */ }

  function pagePathMatches(pp) {
    if (!pp) return true;  // null이면 전 페이지에서 hide
    const cur = location.pathname.replace(/\/+$/, '') || '/';
    return cur === pp || cur === pp.replace(/\.html$/, '') || (cur + '.html') === pp;
  }

  function isHidden(url) {
    if (failClosed) return !!url;  // fail-closed: 회수 목록 불명 → 모든 후보 숨김
    if (!url || !loaded) return false;
    if (exactSet.has(url)) return true;
    for (let i = 0; i < prefixes.length; i++) {
      if (url.indexOf(prefixes[i]) === 0) return true;
    }
    return false;
  }

  // 매체 요소를 hide할 때 — 가능한 한 가장 자연스러운 컨테이너 단위로 숨김
  function hideElement(el) {
    if (!el || el.dataset.hidden === '1') return;
    // <a> 인 경우 부모 카드 컨테이너가 있으면 그걸 숨김 (asset-card, resource-pill 등)
    if (el.tagName === 'A') {
      const card = el.closest('.asset-card, .resource-pill, .video-card, .download-card, li');
      if (card && card !== document.body) {
        card.dataset.hidden = '1';
        card.style.display = 'none';
        return;
      }
    }
    // <source> 는 부모 video/audio를 숨김
    if (el.tagName === 'SOURCE') {
      const media = el.closest('video, audio');
      if (media) {
        media.dataset.hidden = '1';
        media.style.display = 'none';
        return;
      }
    }
    el.dataset.hidden = '1';
    el.style.display = 'none';
  }

  var MEDIA_SEL = 'img[src], video[src], audio[src], iframe[src], source[src]';

  function applyHide(root) {
    if (!loaded) return;
    const r = root || document;
    // MutationObserver가 넘기는 최상위 노드는 그 자신이 <a>/미디어일 수 있음 —
    // querySelectorAll은 root 자신을 빼므로 root.matches도 함께 검사.
    if (r.nodeType === 1 && r.matches) {
      if (r.matches('a[href]') && isHidden(r.getAttribute('href'))) hideElement(r);
      if (r.matches(MEDIA_SEL) && isHidden(r.getAttribute('src'))) hideElement(r);
    }
    if (!r.querySelectorAll) return;
    // <a href>
    r.querySelectorAll('a[href]').forEach(function (a) {
      if (isHidden(a.getAttribute('href'))) hideElement(a);
    });
    // media src
    r.querySelectorAll(MEDIA_SEL).forEach(function (el) {
      if (isHidden(el.getAttribute('src'))) hideElement(el);
    });
  }

  function reload() {
    return fetch(ENDPOINT, { headers: HEADERS, credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        exactSet = new Set();
        prefixes = [];
        (rows || []).forEach(function (row) {
          if (!row || !row.url) return;
          if (!pagePathMatches(row.page_path)) return;
          if (row.url.endsWith('/')) prefixes.push(row.url);
          else exactSet.add(row.url);
        });
        loaded = true;
        failClosed = false;  // 성공 로드 → fail-closed 해제
        applyHide();
        // 다음 페이지 로드의 FOUC 방어용으로 캐시
        try {
          if (window.localStorage) {
            window.localStorage.setItem(CACHE_KEY, JSON.stringify({
              ts: Date.now(),
              exact: Array.from(exactSet),
              prefixes: prefixes,
            }));
          }
        } catch (_) { /* quota·차단은 무시 */ }
      })
      .catch(function (e) {
        console.warn('[hide-guard] load failed', e);
        if (wasSeeded) {
          // 캐시가 이미 있으면 마지막 hide 목록을 유지(공개 자산은 그대로).
          loaded = true;
        } else {
          // 캐시도 없고 fetch도 실패 → 어떤 자산이 회수됐는지 알 수 없음.
          // fail-OPEN(전부 노출)은 회수 콘텐츠 유출이므로, 성공 로드 전까지
          // 모든 후보 미디어를 보호적으로 숨김(fail-closed).
          failClosed = true;
          loaded = true;
          try { applyHide(); } catch (_) {}
        }
      });
  }

  // 동적 노드 처리
  const mo = new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      m.addedNodes && m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        applyHide(n);
      });
    });
  });
  // 같은 페이지에서 중복 로드 시(주로 테스트 환경) 이전 인스턴스의 observer를 정리 —
  // 누적된 stale observer가 옛 hide 목록으로 DOM을 건드리지 않도록.
  try {
    if (window.__hideGuardMO) window.__hideGuardMO.disconnect();
    window.__hideGuardMO = mo;
  } catch (_) {}

  // 캐시 시드된 상태라면 즉시 동기 hide — FOUC 방어
  if (loaded) {
    try { applyHide(); } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (loaded) try { applyHide(); } catch (_) {}  // DOM ready 시 캐시 hide 재적용
      reload();
      mo.observe(document.documentElement, { childList: true, subtree: true });
    });
  } else {
    reload();
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  // admin 페이지에서 hide-guard를 무력화하고 싶으면 호출 가능
  window.__hideGuardReload = reload;
  window.__hideGuardDisable = function () {
    loaded = false;
    document.querySelectorAll('[data-hidden="1"]').forEach(function (el) {
      el.style.display = '';
      delete el.dataset.hidden;
    });
  };
})();
