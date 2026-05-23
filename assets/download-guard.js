/* =========================================================
   Chiropractic | Download Guard
   - 전역 다운로드 차단 + NotebookLM 화이트리스트
   - PDF/DOCX/개인 mp4·이미지 우클릭·드래그·다운로드 속성 차단
   - NotebookLM mp4(02_video_partN, 03_video_partN) + m4a(01_podcast*) 만 허용
   - 관리자(body.is-admin)에게는 모든 차단 비활성화 + 모든 미디어 다운로드 허용
   주의: public R2 URL이라 devtools/네트워크 탭으론 우회 가능 — 캐주얼 보호 한정
   ========================================================= */
(function () {
  'use strict';

  // NotebookLM 산출물 패턴: 파일명이 01_podcast*, 02_video_part*, 03_video_part* 로 시작
  const NLM_RE = /\/(0[123]_(podcast|video_part[12]))[^\/]*\.(mp4|m4a)(?:[?#]|$)/i;
  const MEDIA_RE = /\.(mp4|m4a|pdf|docx?)(?:[?#]|$)/i;

  function isAnonymous() {
    return !!(document.body && document.body.classList.contains('is-anonymous'));
  }

  function isAllowedAsset(url) {
    if (!url) return false;
    // 익명(비로그인) 사용자는 NLM 화이트리스트도 다운로드 차단.
    if (isAnonymous()) return false;
    return NLM_RE.test(url);
  }

  function isAdmin() {
    return !!(document.body && document.body.classList.contains('is-admin')) || window.__isAdmin === true;
  }

  // ---- 1) 모든 <a> 의 download 속성 정리 + 화이트리스트 부여 ----
  function normalizeAnchors(root) {
    if (isAdmin()) return;  // admin은 그대로 유지 — 모든 미디어 다운로드 가능
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
    if (isAdmin()) return;
    (root || document).querySelectorAll('video').forEach(function (v) {
      const src = v.currentSrc || v.src ||
        (v.querySelector('source') && v.querySelector('source').src) || '';
      if (isAllowedAsset(src)) return;
      v.setAttribute('controlsList', 'nodownload noremoteplayback');
      v.setAttribute('disablePictureInPicture', '');
      v.setAttribute('oncontextmenu', 'return false');
    });
  }

  // ---- 3) <img> drag/contextmenu 차단 ----
  function lockImages(root) {
    if (isAdmin()) return;
    (root || document).querySelectorAll('img').forEach(function (img) {
      img.setAttribute('draggable', 'false');
      img.addEventListener('dragstart', function (e) { e.preventDefault(); });
    });
  }

  // ---- 4) 전역 우클릭 차단 (화이트리스트·관리자 예외) ----
  document.addEventListener('contextmenu', function (e) {
    if (isAdmin()) return;
    const t = e.target;
    if (!t) return;
    if (t.closest('.allow-download')) return;
    if (t.closest('input, textarea, [contenteditable="true"]')) return;
    if (t.matches('img, video, audio') || t.closest('a[href$=".pdf"], a[href*=".docx"], a[href$=".mp4"], a[href$=".m4a"]')) {
      e.preventDefault();
    }
  }, true);

  // ---- 5) Admin 모드 전환 시 차단 되돌리기 ----
  function unlockAllForAdmin() {
    // <video> 잠금 해제
    document.querySelectorAll('video[controlsList], video[disablepictureinpicture]').forEach(function (v) {
      v.removeAttribute('controlsList');
      v.removeAttribute('disablePictureInPicture');
      v.removeAttribute('oncontextmenu');
    });
    // 모든 미디어 링크에 download 속성 부여 + allow-download
    document.querySelectorAll('a[href]').forEach(function (a) {
      const href = a.getAttribute('href') || '';
      if (MEDIA_RE.test(href)) {
        a.setAttribute('download', '');
        a.classList.add('allow-download');
      }
    });
    // 이미지 draggable 해제
    document.querySelectorAll('img[draggable="false"]').forEach(function (img) {
      img.removeAttribute('draggable');
    });
  }

  // ---- 6) DOM 준비되면 1회 + MutationObserver로 동적 추가 대응 ----
  function applyAll() {
    if (isAdmin()) {
      unlockAllForAdmin();
      return;
    }
    normalizeAnchors();
    lockVideos();
    lockImages();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAll);
  } else {
    applyAll();
  }

  // 익명자 전환 시: 초기 normalizeAnchors가 부여한 NLM 화이트리스트 효과 제거.
  function lockNlmForAnonymous() {
    document.querySelectorAll('a.allow-download, a[download]').forEach(function (a) {
      a.removeAttribute('download');
      a.classList.remove('allow-download');
    });
  }

  // 동적 노드 처리 + body class 변화 감지 (admin / anonymous)
  let adminFlipped = false;
  let anonymousFlipped = false;
  const mo = new MutationObserver(function (mutations) {
    if (!adminFlipped && isAdmin()) {
      adminFlipped = true;
      unlockAllForAdmin();
      return;
    }
    if (!anonymousFlipped && isAnonymous()) {
      anonymousFlipped = true;
      lockNlmForAnonymous();
    }
    if (isAdmin()) return;  // admin이면 새 노드도 그대로
    mutations.forEach(function (m) {
      m.addedNodes && m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        normalizeAnchors(n);
        lockVideos(n);
        lockImages(n);
      });
    });
  });
  // body class 변화도 감지하기 위해 documentElement attribute 관찰 + body 별도
  mo.observe(document.documentElement, { childList: true, subtree: true });
  function watchBody() {
    if (!document.body) { setTimeout(watchBody, 50); return; }
    new MutationObserver(function () {
      if (!adminFlipped && isAdmin()) {
        adminFlipped = true;
        unlockAllForAdmin();
      }
      if (!anonymousFlipped && isAnonymous()) {
        anonymousFlipped = true;
        lockNlmForAnonymous();
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  watchBody();
})();
