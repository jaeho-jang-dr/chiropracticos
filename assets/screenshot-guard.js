/* =========================================================
   Chiropractic | Screenshot Guard (best-effort)
   - body 또는 [data-no-screenshot] 영역에 한해 다음을 차단 시도:
     · PrintScreen 클립보드 비우기 (Win)
     · F12 / Ctrl+Shift+I/J/C / Ctrl+P / Ctrl+S / Ctrl+U / Ctrl+A 단축키
     · 텍스트 선택, 우클릭, 드래그, 길게 누르기
     · @media print 시 영역 숨김
     · 페이지 포커스 잃을 때(Win+Shift+S, Alt+Tab) 영역 블러 + 워터마크
   주의: OS 레벨 스크린샷(스니핑 도구·외부 카메라·모바일 단말 캡처)은
        브라우저에서 완전 차단 불가능. 캐주얼 보호 한정.
   ========================================================= */
(function () {
  'use strict';

  function ensureStyles() {
    if (document.getElementById('ssg-styles')) return;
    var s = document.createElement('style');
    s.id = 'ssg-styles';
    s.textContent =
      // 보호 영역: 텍스트 선택·드래그 차단
      '[data-no-screenshot]{' +
        '-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;' +
        '-webkit-touch-callout:none;-webkit-user-drag:none;' +
      '}' +
      '[data-no-screenshot] img{-webkit-user-drag:none;user-drag:none;pointer-events:auto}' +
      // 포커스 잃거나 페이지 hidden 시 블러 + 워터마크
      'body.ssg-cloaked [data-no-screenshot]{' +
        'filter:blur(18px) saturate(.5);' +
        'transition:filter .15s ease;' +
      '}' +
      'body.ssg-cloaked [data-no-screenshot]::after{' +
        'content:"🔒 보호 콘텐츠 — 화면을 떠난 동안 가려졌습니다";' +
        'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(255,255,255,.78);color:#1d1d1f;font-weight:600;' +
        'font-size:1rem;letter-spacing:.02em;pointer-events:none;' +
        'border-radius:inherit;z-index:5;' +
      '}' +
      '[data-no-screenshot]{position:relative}' +
      // 인쇄(Ctrl+P) 시 보호 영역 숨김 + 안내 메시지
      '@media print{' +
        '[data-no-screenshot]{display:none !important}' +
        'body::before{' +
          'content:"🔒 이 페이지의 자격증·약력 영역은 인쇄가 제한됩니다.";' +
          'display:block;padding:2rem;font-size:1.1rem;color:#a62528;' +
          'border:2px dashed #a62528;border-radius:8px;margin:2rem' +
        '}' +
      '}';
    document.head.appendChild(s);
  }

  function isAdmin() {
    return !!(document.body && document.body.classList.contains('is-admin')) || window.__isAdmin === true;
  }

  // ---- PrintScreen 키 → 클립보드 비우기 ----
  function clearClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText('').catch(function () {});
      }
    } catch (_) {}
  }

  document.addEventListener('keyup', function (e) {
    if (isAdmin()) return;
    if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
      clearClipboard();
      // visual feedback
      flashWarning('🔒 스크린샷이 차단되었습니다 (클립보드를 비웠습니다)');
    }
  });

  // ---- 단축키 차단: F12, Ctrl+Shift+I/J/C, Ctrl+P, Ctrl+S, Ctrl+U, Ctrl+A ----
  document.addEventListener('keydown', function (e) {
    if (isAdmin()) return;
    var k = (e.key || '').toLowerCase();
    var code = e.code || '';
    var blocked = false;

    if (k === 'f12' || code === 'F12') blocked = true;
    if (e.ctrlKey && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) blocked = true;
    if (e.ctrlKey && (k === 'p' || k === 's' || k === 'u')) blocked = true;
    // Ctrl+A (전체 선택) - 보호 영역 안에서만
    if (e.ctrlKey && k === 'a') {
      var t = e.target;
      if (t && t.closest && t.closest('[data-no-screenshot]')) blocked = true;
    }
    // PrintScreen (some browsers fire on keydown)
    if (k === 'printscreen' || code === 'PrintScreen' || e.keyCode === 44) {
      clearClipboard();
      blocked = true;
    }

    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
      flashWarning('🔒 이 페이지에서는 해당 단축키가 제한됩니다');
      return false;
    }
  }, true);

  // ---- 우클릭·드래그·복사 차단 (보호 영역 안만) ----
  document.addEventListener('contextmenu', function (e) {
    if (isAdmin()) return;
    var t = e.target;
    if (t && t.closest && t.closest('[data-no-screenshot]')) {
      e.preventDefault();
    }
  }, true);

  document.addEventListener('dragstart', function (e) {
    if (isAdmin()) return;
    var t = e.target;
    if (t && t.closest && t.closest('[data-no-screenshot]')) {
      e.preventDefault();
    }
  }, true);

  document.addEventListener('copy', function (e) {
    if (isAdmin()) return;
    var sel = window.getSelection && window.getSelection();
    if (!sel || !sel.anchorNode) return;
    var anchor = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentNode;
    if (anchor && anchor.closest && anchor.closest('[data-no-screenshot]')) {
      e.preventDefault();
      try { e.clipboardData.setData('text/plain', '🔒 보호 콘텐츠 — 복사 제한'); } catch (_) {}
    }
  }, true);

  // ---- 페이지 포커스 잃거나 hidden 시 블러 ----
  function cloak() {
    if (isAdmin()) return;
    if (!hasProtected()) return;
    document.body.classList.add('ssg-cloaked');
  }
  function uncloak() {
    document.body.classList.remove('ssg-cloaked');
  }
  function hasProtected() {
    return !!document.querySelector('[data-no-screenshot]');
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) cloak(); else uncloak();
  });
  window.addEventListener('blur', cloak);
  window.addEventListener('focus', uncloak);

  // ---- 토스트 ----
  var warnTimer = null;
  function flashWarning(msg) {
    var el = document.getElementById('ssg-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ssg-toast';
      el.style.cssText =
        'position:fixed;left:50%;top:24px;transform:translateX(-50%);' +
        'background:rgba(166,37,40,.95);color:#fff;padding:.7rem 1.2rem;' +
        'border-radius:10px;font:600 .9rem/1.3 -apple-system,Pretendard,sans-serif;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.3);z-index:99999;display:none;' +
        'letter-spacing:.01em';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    if (warnTimer) clearTimeout(warnTimer);
    warnTimer = setTimeout(function () { el.style.display = 'none'; }, 2200);
  }

  // ---- DOM ready 시 스타일 주입 ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureStyles);
  } else {
    ensureStyles();
  }
})();
