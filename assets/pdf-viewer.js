/* =========================================================
   Chiropractic | Inline PDF Viewer (no-download)
   - PDF 링크 클릭 가로채기 → 모달 iframe + #toolbar=0 으로 표시
   - 다운로드 버튼·툴바·도구막대 숨김 (Chromium PDF viewer)
   - 우클릭 차단, ESC 닫기
   주의: URL을 알면 직접 다운로드 가능 — 캐주얼 차단 한정
   ========================================================= */
(function () {
  'use strict';

  function ensureStyles() {
    if (document.getElementById('pdf-viewer-styles')) return;
    const s = document.createElement('style');
    s.id = 'pdf-viewer-styles';
    s.textContent =
      '.pdfv-overlay{position:fixed;inset:0;z-index:9999;background:rgba(20,20,25,.85);' +
      'display:none;align-items:center;justify-content:center;padding:2vh 2vw;' +
      '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}' +
      '.pdfv-overlay.is-open{display:flex}' +
      '.pdfv-frame{position:relative;width:min(1200px,96vw);height:96vh;background:#fff;' +
      'border-radius:14px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.45);' +
      'display:flex;flex-direction:column}' +
      '.pdfv-bar{display:flex;align-items:center;gap:.75rem;padding:.7rem 1rem;' +
      'border-bottom:1px solid #eaeaec;background:#fafafc;font:500 .9rem/1.2 -apple-system,Pretendard,sans-serif;color:#1d1d1f}' +
      '.pdfv-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.pdfv-note{font-size:.78rem;color:#86868b;font-weight:400}' +
      '.pdfv-close{appearance:none;border:0;background:transparent;font-size:1.4rem;line-height:1;' +
      'cursor:pointer;padding:.2rem .55rem;border-radius:8px;color:#1d1d1f}' +
      '.pdfv-close:hover{background:rgba(0,0,0,.06)}' +
      '.pdfv-body{flex:1;background:#525659}' +
      '.pdfv-iframe{display:block;width:100%;height:100%;border:0}' +
      '@media (max-width:640px){.pdfv-frame{height:98vh;width:98vw;border-radius:10px}.pdfv-note{display:none}}';
    document.head.appendChild(s);
  }

  function buildOverlay() {
    let ov = document.getElementById('pdfv-root');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'pdfv-root';
    ov.className = 'pdfv-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML =
      '<div class="pdfv-frame" role="document">' +
        '<div class="pdfv-bar">' +
          '<span class="pdfv-title" id="pdfv-title">PDF</span>' +
          '<span class="pdfv-note">🔒 미리보기 전용 · 다운로드 제한</span>' +
          '<button type="button" class="pdfv-close" aria-label="닫기">✕</button>' +
        '</div>' +
        '<div class="pdfv-body">' +
          '<iframe class="pdfv-iframe" id="pdfv-frame" title="PDF 미리보기" allow="" referrerpolicy="no-referrer"></iframe>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    // close handlers
    ov.addEventListener('click', function (e) {
      if (e.target === ov) close();
    });
    ov.querySelector('.pdfv-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.classList.contains('is-open')) close();
    });
    // 모달 내부 우클릭 차단
    ov.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    return ov;
  }

  function open(url, title) {
    const ov = buildOverlay();
    const frame = ov.querySelector('#pdfv-frame');
    const titleEl = ov.querySelector('#pdfv-title');
    titleEl.textContent = title || 'PDF 미리보기';
    // Chromium PDF 뷰어 fragment — 툴바/다운로드 버튼 숨김
    const params = 'toolbar=0&navpanes=0&statusbar=0&messages=0&scrollbar=1&view=FitH';
    // 기존 fragment가 있어도 우리 보안 파라미터를 항상 부착 (merge — `&`로 이어붙임)
    const hashIdx = url.indexOf('#');
    let merged;
    if (hashIdx === -1) {
      merged = url + '#' + params;
    } else {
      const base = url.slice(0, hashIdx);
      const existing = url.slice(hashIdx + 1);
      merged = base + '#' + (existing ? existing + '&' + params : params);
    }
    frame.src = merged;
    ov.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    const ov = document.getElementById('pdfv-root');
    if (!ov) return;
    ov.classList.remove('is-open');
    const frame = ov.querySelector('#pdfv-frame');
    if (frame) frame.src = 'about:blank';
    document.body.style.overflow = '';
  }

  function isAdmin() {
    return !!(document.body && document.body.classList.contains('is-admin')) || window.__isAdmin === true;
  }

  // PDF 링크 클릭 가로채기 (전역 위임)
  document.addEventListener('click', function (e) {
    if (isAdmin()) return;  // 관리자는 그대로 새 탭/다운로드
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    // .pdf 확장자(쿼리/프래그먼트 허용)만
    if (!/\.pdf(?:[?#]|$)/i.test(href)) return;
    if (a.classList.contains('allow-download')) return;
    e.preventDefault();
    e.stopPropagation();
    const title =
      (a.querySelector('.title') && a.querySelector('.title').textContent) ||
      a.getAttribute('aria-label') ||
      a.textContent.trim() ||
      'PDF 미리보기';
    ensureStyles();
    open(href, title);
  }, true);

  // DOCX 링크는 미리보기 미지원 안내 (관리자는 그대로 다운로드)
  document.addEventListener('click', function (e) {
    if (isAdmin()) return;
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!/\.docx?(?:[?#]|$)/i.test(href)) return;
    if (a.classList.contains('allow-download')) return;
    e.preventDefault();
    e.stopPropagation();
    alert('이 자료는 미리보기·다운로드가 제한됩니다.\n\n학습 자료는 NotebookLM 동영상·팟캐스트를 이용해 주세요.');
  }, true);

  ensureStyles();
})();
