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
      'display:flex;align-items:center;justify-content:center;cursor:default}' +
      '.imgz-img{max-width:96vw;max-height:96vh;width:auto;height:auto;' +
      'object-fit:contain;border-radius:8px;box-shadow:0 24px 80px rgba(0,0,0,.6);' +
      '-webkit-user-select:none;user-select:none;' +
      '-webkit-user-drag:none;-webkit-touch-callout:none;' +
      'pointer-events:auto}' +
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
        '<div class="imgz-bar">🔒 미리보기 전용 · 다운로드 제한 · ESC 또는 바깥 클릭으로 닫기</div>' +
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

    // ESC
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.classList.contains('is-open')) close();
    });

    return ov;
  }

  function open(src, alt, title) {
    ensureStyles();
    var ov = buildOverlay();
    var img = ov.querySelector('.imgz-img');
    img.src = src;
    img.alt = alt || '';
    if (title) ov.setAttribute('aria-label', title);
    ov.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    var ov = document.getElementById('imgz-root');
    if (!ov) return;
    ov.classList.remove('is-open');
    var img = ov.querySelector('.imgz-img');
    if (img) img.src = '';
    document.body.style.overflow = '';
  }

  // 클릭 위임: [data-img-zoom] 또는 그 자식이 클릭되면 라이트박스 열기
  document.addEventListener('click', function (e) {
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
  }, true);

  // 키보드 접근성: Enter/Space 로도 열기
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = document.activeElement;
    if (!t || !t.matches || !t.matches('[data-img-zoom]')) return;
    e.preventDefault();
    var src = t.getAttribute('data-img-zoom');
    if (src) open(src, t.getAttribute('data-img-alt') || '', t.getAttribute('data-img-title') || '');
  });

  ensureStyles();

  // 외부 노출
  window.imgZoom = { open: open, close: close };
})();
