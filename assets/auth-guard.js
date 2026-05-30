// 페이지 접근 권한 체크.
// sessionReady를 await — Supabase가 URL hash/code 처리할 시간 확보.

import { supabase, sessionReady, getCurrentUserWithRow, signOut } from "./supabase-client.js";

// FOUC 방어 — 보호 챕터 HTML은 <head>에 인라인 cloak(<style id="auth-cloak">
// html{visibility:hidden}</style>)을 실어 가드 완료 전 콘텐츠 페인트를 막는다.
// 가드는 콘텐츠를 보여줄 분기에서만 cloak을 제거하고, 리다이렉트 경로에서는 유지.
function uncloak() {
  try {
    const c = document.getElementById("auth-cloak");
    if (c) c.remove();
    document.documentElement.style.visibility = "";
  } catch (_) {}
}

(async () => {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  // cleanUrl 환경에서 /login 과 /login.html 둘 다 매치
  const variants = new Set([
    path,
    path + ".html",
    path.replace(/\.html$/, ""),
  ]);
  const isPublic = [...variants].some((p) => window.PUBLIC_PAGES?.has(p));
  const isAdmin  = [...variants].some((p) => window.ADMIN_PAGES?.has(p));

  // 모든 분기 전에 세션 복원 대기
  const session = await sessionReady;

  if (isPublic && !isAdmin) {
    // 공개 페이지: 로그인 상태면 nav 위젯 갱신. 단, 차단 사용자는 공개 페이지에서도
    // 차단 안내를 보여주고 admin 다운로드-언락 신호(is-admin)를 부여하지 않는다.
    if (session) {
      const { row } = await getCurrentUserWithRow();
      if (row?.blocked_at) { showBlocked(row); return; }
      updateNavWidget(row);
    } else {
      document.body.classList.add("is-anonymous");
      uncloak();
    }
    return;
  }

  if (!session) {
    // redirect loop 방지: 이미 /login에 있으면 다시 redirect 안 함
    if (location.pathname.startsWith("/login")) { uncloak(); return; }
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/login?next=${next}`);
    return;  // 리다이렉트 — cloak 유지(보호 콘텐츠 플래시 방지)
  }

  const { row, error } = await getCurrentUserWithRow();

  if (row?.blocked_at) { showBlocked(row); return; }

  // 행 조회가 일시적으로 실패(네트워크/5xx) → 승인 대기·403으로 오인하지 말 것.
  // 확정 거부(행 없음, error null)와 "판단 불가"(error 有)를 구분.
  if (!row && error) {
    showFullPage(`<h1 style="margin:0 0 .8rem">⏳ 일시적인 오류</h1>
      <p style="color:#444;line-height:1.7;font-size:.95em">계정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      <div style="margin-top:1.5rem;display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="location.reload()">새로고침</button>
        <button class="btn btn-ghost btn-sm" onclick="window.__signOut()">로그아웃</button>
      </div>`);
    window.__signOut = signOut;
    return;
  }

  if (isAdmin) {
    if (row?.role !== "admin") {
      showFullPage(`<h1>403</h1><p>관리자 전용 페이지입니다.</p>
        <a href="/">← 메인으로</a>`);
      return;
    }
    updateNavWidget(row);
    return;
  }

  if (!row || row.access_level === "pending_approval" || row.access_level === "free") {
    const greeting = row?.full_name ? `${escapeHtml(row.full_name)}님, ` : "";
    showFullPage(`<h1 style="margin:0 0 .8rem">⏳ 관리자 승인 대기 중</h1>
      <p style="color:#444;line-height:1.7;font-size:.95em">${greeting}가입은 완료되었습니다.</p>
      <p style="color:#666;line-height:1.7;font-size:.9em;background:#f7f7f9;padding:1rem 1.25rem;border-radius:10px;text-align:left">
        본 강의 자료는 <strong>의료인(MD/PT) 전용</strong>으로 운영됩니다.<br>
        제공해주신 자격 정보(직군·소속·면허번호)를 관리자가 검토 후 승인합니다.<br>
        보통 <strong>1-2 영업일</strong> 이내 처리되며, 승인되면 별도 안내 없이 모든 챕터에 접근 가능합니다.
      </p>
      <p style="color:#888;font-size:.85em;margin:1rem 0">자격 증빙 자료 추가 제출이 필요하면 이메일로 보내주세요.</p>
      <p style="color:#0a84ff;font-size:.92em;margin:1rem 0">📧 <a href="mailto:drjang00@gmail.com">drjang00@gmail.com</a></p>
      <div style="margin-top:1.75rem;display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap">
        <a href="/" class="btn btn-ghost btn-sm">← 메인</a>
        <a href="/chapter01_introduction" class="btn btn-primary btn-sm">Ch 1 (공개)</a>
        <a href="/guide" class="btn btn-ghost btn-sm">📖 사용 가이드</a>
        <button class="btn btn-ghost btn-sm" onclick="window.__signOut()">로그아웃</button>
      </div>`);
    window.__signOut = signOut;
    return;
  }

  updateNavWidget(row);
})();

function showBlocked(row) {
  showFullPage(`<h1>🚫 접근이 차단되었습니다</h1>
    <p>관리자 차단 사유: ${escapeHtml(row.blocked_reason || "")}</p>
    <p>문의: <a href="mailto:drjang00@gmail.com">drjang00@gmail.com</a></p>
    <button onclick="window.__signOut()">로그아웃</button>`);
  window.__signOut = signOut;
}

function updateNavWidget(row) {
  uncloak();
  const unicorn = document.getElementById("hero-unicorn");
  if (row?.role === "admin" && unicorn) unicorn.style.display = "block";

  // download-guard.js / pdf-viewer.js 가 차단 우회를 결정하는 신호
  if (row?.role === "admin") {
    document.body.classList.add("is-admin");
    window.__isAdmin = true;
  }

  const navAction = document.querySelector(".nav-actions");
  if (!navAction || !row) return;

  const isAdmin = row.role === "admin";
  navAction.innerHTML = `
    ${isAdmin ? '<a class="btn btn-ghost btn-sm" href="/admin" style="font-weight:600">⚙ 관리자</a>' : ''}
    <span style="font-size:.85em;color:#666;margin:0 .6rem">${escapeHtml(row.email)}</span>
    <button class="btn btn-ghost btn-sm" id="__logout-btn">로그아웃</button>
  `;
  document.getElementById("__logout-btn").onclick = signOut;
}

function showFullPage(inner) {
  uncloak();
  document.body.innerHTML = `
    <div style="max-width:640px;margin:6rem auto;padding:2.5rem;text-align:center;font-family:system-ui;
                border:1px solid #e0e0e3;border-radius:16px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.04)">
      ${inner}
    </div>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
