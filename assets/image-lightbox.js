/* =========================================================
   Chiropractic | Image Lightbox (no-download)
   - [data-img-zoom="<url>"] 클릭 → fullscreen overlay 에 이미지 표시
   - 우클릭/드래그/길게 누르기 차단 (캐주얼 다운로드 방지)
   - ESC, 외부 클릭, ✕ 버튼으로 닫기
   주의: DevTools 네트워크 탭으로는 우회 가능 — 캐주얼 보호 한정
   ========================================================= */
(function () {
  'use strict';

  function ensureStyles() {
    if (document.getElementById('imgz-styles')) return;
    var s = document.createElement('style');
    s.id = 'imgz-styles';
    s.textContent =
      '.imgz-overlay{position:fixed;inset:0;z-index:9999;' +
      'background:rgba(15,15,20,.92);display:none;' +
      'align-items:center;justify-content:center;padding:3vh 3vw;' +
      '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);' +
      'cursor:zoom-out;animation:imgz-fade .18s ease-out}' +
      '.imgz-overlay.is-open{display:flex}' +
      '@keyframes imgz-fade{from{opacity:0}to{opacity:1}}' +
      '.imgz-frame{position:relative;max-width:96vw;max-height:96vh;' +
      'display:flex;align-items:center;justify-content:center;cursor:default;' +
      'overflow:auto}' +
      '.imgz-img{max-width:96vw;max-height:96vh;width:auto;height:auto;' +
      'object-fit:contain;border-radius:8px;box-shadow:0 24px 80px rgba(0,0,0,.6);' +
      '-webkit-user-select:none;user-select:none;' +
      '-webkit-user-drag:none;-webkit-touch-callout:none;' +
      'pointer-events:auto;cursor:zoom-in;transition:max-width .2s ease,max-height .2s ease}' +
      '.imgz-img.is-1to1{max-width:none;max-height:none;width:auto;height:auto;' +
      'cursor:zoom-out;border-radius:0}' +
      '.imgz-frame.is-1to1{max-width:100vw;max-height:100vh;width:100vw;height:100vh;' +
      'overflow:auto;align-items:flex-start;justify-content:flex-start;padding:0}' +
      '.imgz-close{position:absolute;top:-44px;right:-4px;' +
      'appearance:none;border:0;background:rgba(0,0,0,.55);color:#fff;' +
      'width:36px;height:36px;border-radius:50%;font-size:1.1rem;' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;' +
      'transition:background .15s ease}' +
      '.imgz-close:hover{background:rgba(0,0,0,.85)}' +
      '.imgz-bar{position:absolute;left:0;right:0;bottom:-44px;' +
      'text-align:center;color:#fff;font:500 .82rem/1.2 -apple-system,Pretendard,sans-serif;' +
      'opacity:.75;letter-spacing:.02em;pointer-events:none}' +
      '@media (max-width:640px){' +
        '.imgz-close{top:auto;bottom:-44px;right:50%;transform:translateX(50%)}' +
        '.imgz-bar{display:none}' +
      '}' +
      '[data-img-zoom]{cursor:zoom-in}';
    document.head.appendChild(s);
  }

  function buildOverlay() {
    var ov = document.getElementById('imgz-root');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'imgz-root';
    ov.className = 'imgz-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', '이미지 확대');
    ov.innerHTML =
      '<div class="imgz-frame">' +
        '<button type="button" class="imgz-close" aria-label="닫기">✕</button>' +
        '<img class="imgz-img" alt="" draggable="false" />' +
        '<div class="imgz-bar">🔒 미리보기 전용 · 다운로드 제한 · 클릭하면 원본 크기 · ESC 닫기</div>' +
      '</div>';
    document.body.appendChild(ov);

    // close handlers
    ov.addEventListener('click', function (e) {
      // 이미지·프레임 내부 클릭은 닫지 않음 (단, ✕ 버튼은 닫음)
      if (e.target === ov) close();
    });
    ov.querySelector('.imgz-close').addEventListener('click', close);

    // 우클릭/드래그/길게누르기 차단
    var img = ov.querySelector('.imgz-img');
    img.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    img.addEventListener('dragstart', function (e) { e.preventDefault(); });
    img.addEventListener('mousedown', function (e) {
      // 길게 누르기로 「이미지 저장」 다이얼로그 회피용
      if (e.button === 2) e.preventDefault();
    });

    // 이미지 클릭 → 1:1 원본 픽셀 크기 토글
    img.addEventListener('click', function (e) {
      e.stopPropagation();
      var frame = ov.querySelector('.imgz-frame');
      var on = img.classList.toggle('is-1to1');
      frame.classList.toggle('is-1to1', on);
      var bar = ov.querySelector('.imgz-bar');
      if (bar) bar.textContent = on
        ? '🔍 원본 크기 (1:1) · 다시 클릭하면 축소 · ESC 닫기'
        : '🔒 미리보기 전용 · 다운로드 제한 · 클릭하면 원본 크기 · ESC 닫기';
    });

    return ov;
  }

  // src 화이트리스트: https://, http://, blob:, data:image/, 그리고 path-relative
  // (/path, ./path, ../path, foo/bar). javascript:, file:, vbscript: 등은 거절.
  function isSafeSrc(src) {
    if (typeof src !== 'string' || !src) return false;
    var s = src.trim();
    if (!s) return false;
    if (/^https?:\/\//i.test(s)) return true;
    if (/^blob:/i.test(s)) return true;
    if (/^data:image\//i.test(s)) return true;
    // scheme-less / path-relative — `:` 가 첫 `/` 보다 앞에 있으면 scheme로 간주하고 거절
    var colon = s.indexOf(':');
    var slash = s.indexOf('/');
    if (colon === -1) return true;        // 콜론 없음 → relative path
    if (slash !== -1 && slash < colon) return true; // /a:b → path
    return false;
  }

  // aria-modal 다이얼로그의 포커스 복원용 — 라이트박스를 연 요소를 기억.
  var lastOpener = null;

  function open(src, alt, title) {
    if (!isSafeSrc(src)) {
      // 안전하지 않은 URL은 무시 (overlay 열지 않음)
      console.warn('[imgZoom] blocked unsafe src', src);
      return;
    }
    ensureStyles();
    var ov = buildOverlay();
    var img = ov.querySelector('.imgz-img');
    img.src = src;
    img.alt = alt || '';
    // 항상 설정 — title 없을 때 이전 이미지의 제목이 남아 새 나는 것을 방지.
    ov.setAttribute('aria-label', title || '이미지 확대');
    ov.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    // 포커스를 다이얼로그 안으로 이동(스크린리더/키보드 사용자가 모달 뒤에 남지 않도록).
    // opener는 오버레이 바깥의 요소만 기억 — 이미 다이얼로그 내부에 포커스가 있던
    // 경우(재진입 등) closeBtn을 opener로 덮어쓰지 않도록.
    var active = document.activeElement;
    if (active && active !== document.body && !ov.contains(active)) lastOpener = active;
    var closeBtn = ov.querySelector('.imgz-close');
    if (closeBtn && closeBtn.focus) closeBtn.focus();
  }

  function close() {
    var ov = document.getElementById('imgz-root');
    if (!ov) return;
    ov.classList.remove('is-open');
    var img = ov.querySelector('.imgz-img');
    var frame = ov.querySelector('.imgz-frame');
    if (img) {
      img.src = '';
      img.classList.remove('is-1to1');
    }
    if (frame) frame.classList.remove('is-1to1');
    var bar = ov.querySelector('.imgz-bar');
    if (bar) bar.textContent = '🔒 미리보기 전용 · 다운로드 제한 · 클릭하면 원본 크기 · ESC 닫기';
    ov.setAttribute('aria-label', '이미지 확대');  // 기본 라벨로 리셋
    document.body.style.overflow = '';
    // 모달을 연 요소로 포커스 복원(아무데도 안 남기고 <body>로 떨어지지 않도록).
    if (lastOpener && lastOpener.focus) { try { lastOpener.focus(); } catch (_) {} }
    lastOpener = null;
  }

  // 클릭 위임: [data-img-zoom] 또는 그 자식이 클릭되면 라이트박스 열기
  function onDocClick(e) {
    var t = e.target;
    if (!t) return;
    var trig = t.closest && t.closest('[data-img-zoom]');
    if (!trig) return;
    e.preventDefault();
    e.stopPropagation();
    var src = trig.getAttribute('data-img-zoom');
    var alt = trig.getAttribute('data-img-alt') || '';
    var title = trig.getAttribute('data-img-title') || '';
    if (src) open(src, alt, title);
  }

  // 키보드: Enter/Space로 열기, ESC로 닫기
  function onDocKeydown(e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('imgz-root');
      if (ov && ov.classList.contains('is-open')) close();
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = document.activeElement;
    if (!t || !t.matches || !t.matches('[data-img-zoom]')) return;
    e.preventDefault();
    var src = t.getAttribute('data-img-zoom');
    if (src) open(src, t.getAttribute('data-img-alt') || '', t.getAttribute('data-img-title') || '');
  }

  // 같은 페이지에서 중복 로드 시(주로 테스트 환경) 이전 인스턴스의 document 리스너를
  // 제거 — 누적된 stale 리스너가 한 번의 클릭에 open()을 여러 번 호출(opener 오염)하지
  // 않도록.
  try { if (window.__imgZoomCleanup) window.__imgZoomCleanup(); } catch (_) {}
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('keydown', onDocKeydown);
  window.__imgZoomCleanup = function () {
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onDocKeydown);
  };

  ensureStyles();

  // 외부 노출
  window.imgZoom = { open: open, close: close };
})();
