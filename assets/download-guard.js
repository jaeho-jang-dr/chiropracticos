/* =========================================================
   Chiropractic | Download Guard
   - 전역 다운로드 차단 + NotebookLM 화이트리스트
   - PDF/DOCX/개인 mp4·이미지 우클릭·드래그·다운로드 속성 차단
   - NotebookLM mp4(02_video_partN, 03_video_partN) + m4a(01_podcast*) 만 허용
   주의: public R2 URL이라 devtools/네트워크 탭으론 우회 가능 — 캐주얼 보호 한정
   ========================================================= */
(function () {
  'use strict';

  // NotebookLM 산출물 패턴: 파일명이 01_podcast*, 02_video_part*, 03_video_part* 로 시작
  const NLM_RE = /\/(0[123]_(podcast|video_part[12]))[^\/]*\.(mp4|m4a)(?:[?#]|$)/i;

  function isAllowedAsset(url) {
    if (!url) return false;
    return NLM_RE.test(url);
  }

  // ---- 1) 모든 <a> 의 download 속성 정리 + 화이트리스트 부여 ----
  function normalizeAnchors(root) {
    (root || document).querySelectorAll('a[href]').forEach(function (a) {
      const href = a.getAttribute('href') || '';
      if (isAllowedAsset(href)) {
        // NotebookLM 산출물 → download 속성 보장
        if (!a.hasAttribute('download')) a.setAttribute('download', '');
        a.classList.add('allow-download');
      } else {
        // 그 외 → download 속성 강제 제거
        if (a.hasAttribute('download')) a.removeAttribute('download');
      }
    });
  }

  // ---- 2) <video> controlsList=nodownload (개인 mp4 한정) ----
  function lockVideos(root) {
    (root || document).querySelectorAll('video').forEach(function (v) {
      const src = v.currentSrc || v.src ||
        (v.querySelector('source') && v.querySelector('source').src) || '';
      if (isAllowedAsset(src)) return;  // NotebookLM 영상은 그대로 (원래 chapter HTML에는 video 태그로 NLM mp4를 쓰진 않지만 방어적)
      v.setAttribute('controlsList', 'nodownload noremoteplayback');
      v.setAttribute('disablePictureInPicture', '');
      v.setAttribute('oncontextmenu', 'return false');
    });
  }

  // ---- 3) <img> drag/contextmenu 차단 ----
  function lockImages(root) {
    (root || document).querySelectorAll('img').forEach(function (img) {
      img.setAttribute('draggable', 'false');
      img.addEventListener('dragstart', function (e) { e.preventDefault(); });
    });
  }

  // ---- 4) 전역 우클릭 차단 (화이트리스트 예외) ----
  document.addEventListener('contextmenu', function (e) {
    const t = e.target;
    if (!t) return;
    // 모달 내부, 텍스트 입력, .allow-download 자식은 허용
    if (t.closest('.allow-download')) return;
    if (t.closest('input, textarea, [contenteditable="true"]')) return;
    // 미디어/이미지 우클릭 차단
    if (t.matches('img, video, audio') || t.closest('a[href$=".pdf"], a[href*=".docx"], a[href$=".mp4"], a[href$=".m4a"]')) {
      e.preventDefault();
    }
  }, true);

  // ---- 5) DOM 준비되면 1회 + MutationObserver로 동적 추가 대응 ----
  function applyAll() {
    normalizeAnchors();
    lockVideos();
    lockImages();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAll);
  } else {
    applyAll();
  }

  // 동적으로 추가되는 노드도 처리
  const mo = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes && m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        normalizeAnchors(n);
        lockVideos(n);
        lockImages(n);
      });
    });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
