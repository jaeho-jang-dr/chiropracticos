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

  // NotebookLM 산출물 패턴:
  //   ① 1세대: 01_podcast*, 02_video_part1*, 03_video_part2*
  //   ② v3 4부작: podcasts_v3/01_episode1_*.m4a ~ 04_episode4_*.m4a
  const NLM_RE = /\/(0[123]_(podcast|video_part[12])[^\/]*|podcasts_v3\/0[1-4]_episode[1-4]_[^\/]+)\.(mp4|m4a)(?:[?#]|$)/i;
  const MEDIA_RE = /\.(mp4|m4a|pdf|docx?)(?:[?#]|$)/i;

  // 비로그인 공개 챕터(추가 시 여기 갱신) — 이 페이지에서는 익명자도 NLM 산출물 재생/다운로드 허용
  const PUBLIC_CHAPTER_RE = /\/chapter(01_introduction|02_functional_neurology|13_soft_tissue)(?:\.html)?(?:[?#]|$)/i;

  function isAnonymous() {
    return !!(document.body && document.body.classList.contains('is-anonymous'));
  }

  function isPublicChapter() {
    return PUBLIC_CHAPTER_RE.test(location.pathname || '');
  }

  function isAllowedAsset(url) {
    if (!url) return false;
    // 익명(비로그인) 사용자는 기본적으로 NLM 화이트리스트도 다운로드 차단.
    // 예외: 비로그인 공개 챕터(Ch 1·2·13)는 NLM 산출물(m4a·mp4)을 익명자에게도 허용.
    if (isAnonymous() && !isPublicChapter()) return false;
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

  // root 자신이 매치되면 포함, 그 안의 descendants도 포함 (MutationObserver의
  // 새 노드 처리용 — querySelectorAll은 root 자신을 포함하지 않음)
  function collect(root, selector) {
    const r = root || document;
    const out = [];
    if (r.nodeType === 1 && r.matches && r.matches(selector)) out.push(r);
    if (r.querySelectorAll) {
      r.querySelectorAll(selector).forEach(function (el) { out.push(el); });
    }
    return out;
  }

  function lockVideoEl(v) {
    const src = v.currentSrc || v.src ||
      (v.querySelector && v.querySelector('source') && v.querySelector('source').src) || '';
    if (isAllowedAsset(src)) return;
    v.setAttribute('controlsList', 'nodownload noremoteplayback');
    v.setAttribute('disablePictureInPicture', '');
    // CSP enforced 호환 — 인라인 attribute 대신 실제 리스너 부착
    v.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  // ---- 2) <video> controlsList=nodownload (개인 mp4 한정) ----
  function lockVideos(root) {
    if (isAdmin()) return;
    collect(root, 'video').forEach(lockVideoEl);
  }

  function lockImgEl(img) {
    img.setAttribute('draggable', 'false');
    img.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  // ---- 3) <img> drag/contextmenu 차단 ----
  function lockImages(root) {
    if (isAdmin()) return;
    collect(root, 'img').forEach(lockImgEl);
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
    // <video> 잠금 해제 (legacy: 과거에 inline oncontextmenu를 썼을 수 있어 함께 제거)
    document.querySelectorAll('video[controlsList], video[disablepictureinpicture], video[oncontextmenu]').forEach(function (v) {
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
  // 단, 비로그인 공개 챕터(Ch 1·2·13)는 익명자도 NLM 산출물 허용이라 되돌리지 않음.
  function lockNlmForAnonymous() {
    if (isPublicChapter()) return;
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
