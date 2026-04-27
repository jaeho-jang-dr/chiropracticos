// 페이지 접근 권한 체크.
// sessionReady를 await — Supabase가 URL hash/code 처리할 시간 확보.

import { supabase, sessionReady, getCurrentUserWithRow, signOut } from "./supabase-client.js";

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
    // 공개 페이지: 로그인 상태면 nav 위젯만 갱신
    if (session) updateNavWidget((await getCurrentUserWithRow()).row);
    return;
  }

  if (!session) {
    // redirect loop 방지: 이미 /login에 있으면 다시 redirect 안 함
    if (location.pathname.startsWith("/login")) return;
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/login?next=${next}`);
    return;
  }

  const { row } = await getCurrentUserWithRow();

  if (row?.blocked_at) {
    showFullPage(`<h1>🚫 접근이 차단되었습니다</h1>
      <p>관리자 차단 사유: ${escapeHtml(row.blocked_reason || "")}</p>
      <p>문의: <a href="mailto:drjang00@gmail.com">drjang00@gmail.com</a></p>
      <button onclick="window.__signOut()">로그아웃</button>`);
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
    showFullPage(`<h1>⏳ 관리자 승인 대기 중</h1>
      <p style="color:#555;line-height:1.7">가입은 완료되었습니다. 본 강의 자료는 의료인(MD/PT) 전용으로, 자격 확인 후 관리자가 승인합니다.</p>
      <p style="color:#888;font-size:.9em;margin-top:1.5rem">문의: <a href="mailto:drjang00@gmail.com">drjang00@gmail.com</a></p>
      <div style="margin-top:2rem;display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">
        <a href="/" class="btn btn-ghost">← 메인</a>
        <a href="/chapter01_introduction" class="btn btn-primary">Ch 1 (공개)</a>
        <button class="btn btn-ghost" onclick="window.__signOut()">로그아웃</button>
      </div>`);
    window.__signOut = signOut;
    return;
  }

  updateNavWidget(row);
})();

function updateNavWidget(row) {
  const unicorn = document.getElementById("hero-unicorn");
  if (row?.role === "admin" && unicorn) unicorn.style.display = "block";

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
  document.body.innerHTML = `
    <div style="max-width:640px;margin:6rem auto;padding:2.5rem;text-align:center;font-family:system-ui;
                border:1px solid #e0e0e3;border-radius:16px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.04)">
      ${inner}
    </div>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
