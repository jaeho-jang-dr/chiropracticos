// 페이지 접근 권한을 체크합니다.
// 비공개 페이지인데 로그인 안 했거나 access_level이 'approved' 미만이면
// /login.html?next=현재경로 로 리다이렉트.
//
// 핵심: sessionReady 를 await — Supabase가 OAuth callback URL 또는
// localStorage 세션을 복원할 때까지 기다림 (첫 로그인 race 방지).

import { supabase, sessionReady, getCurrentUserWithRow, signOut } from "./supabase-client.js";

(async () => {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  // cleanUrl 환경에서 /login → /login.html 둘 다 매치하도록
  const variants = new Set([path, path + ".html", path.replace(/\.html$/, "")]);
  const isPublic = [...variants].some((p) => window.PUBLIC_PAGES?.has(p));
  const isAdmin  = [...variants].some((p) => window.ADMIN_PAGES?.has(p));

  // 모든 분기 전에 세션 복원 대기 (가장 중요)
  const session = await sessionReady;

  if (isPublic && !isAdmin) {
    updateNavWidget();
    return;
  }

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/login.html?next=${next}`);
    return;
  }

  const { user, row } = await getCurrentUserWithRow();

  if (row?.blocked_at) {
    document.body.innerHTML = `
      <div style="max-width:560px;margin:8rem auto;padding:2rem;text-align:center;font-family:system-ui">
        <h1>🚫 접근이 차단되었습니다</h1>
        <p>이 계정은 관리자에 의해 차단되었습니다. 문의: <a href="mailto:drjang00@gmail.com">drjang00@gmail.com</a></p>
        <button onclick="window.__signOut()">로그아웃</button>
      </div>`;
    window.__signOut = signOut;
    return;
  }

  if (isAdmin) {
    if (row?.role !== "admin") {
      document.body.innerHTML = `<div style="max-width:560px;margin:8rem auto;padding:2rem;text-align:center;font-family:system-ui">
        <h1>403</h1><p>관리자 전용 페이지입니다.</p><a href="/index.html">← 메인으로</a></div>`;
      return;
    }
    updateNavWidget(row);
    return;
  }

  // 일반 보호 페이지 — pending_approval 또는 free면 안내
  if (!row || row.access_level === "pending_approval" || row.access_level === "free") {
    document.body.innerHTML = `
      <div style="max-width:640px;margin:6rem auto;padding:2.5rem;text-align:center;font-family:system-ui;border:1px solid #e0e0e3;border-radius:16px;background:#fff">
        <h1 style="margin:0 0 1rem">⏳ 관리자 승인 대기 중</h1>
        <p style="color:#555;line-height:1.7">가입은 완료되었습니다. 본 강의 자료는 의료인(MD/PT) 전용으로, 자격 확인 후 관리자가 승인합니다. 보통 1-2일 이내 처리됩니다.</p>
        <p style="color:#888;font-size:.9em;margin-top:1.5rem">문의 / 자격 증빙: <a href="mailto:drjang00@gmail.com">drjang00@gmail.com</a></p>
        <div style="margin-top:2rem;display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">
          <a href="/index.html" style="padding:.6rem 1.2rem;border-radius:999px;background:#f0f0f3;color:#333;text-decoration:none">← 메인</a>
          <a href="/chapter01_introduction.html" style="padding:.6rem 1.2rem;border-radius:999px;background:#0a84ff;color:#fff;text-decoration:none">Ch 1 서설 (공개)</a>
          <button onclick="window.__signOut()" style="padding:.6rem 1.2rem;border-radius:999px;background:transparent;border:1px solid #ddd;cursor:pointer">로그아웃</button>
        </div>
      </div>`;
    window.__signOut = signOut;
    return;
  }

  updateNavWidget(row);
})();

async function updateNavWidget(row) {
  // 유니콘 + 관리자 메뉴 — admin만 표시
  const unicorn = document.getElementById("hero-unicorn");
  if (row?.role === "admin" && unicorn) unicorn.style.display = "block";

  const navAction = document.querySelector(".nav-actions");
  if (!navAction) return;

  if (!row) {
    // 비로그인 — 기존 로그인 버튼 그대로
    return;
  }

  const isAdmin = row.role === "admin";
  navAction.innerHTML = `
    ${isAdmin ? '<a class="btn btn-ghost btn-sm" href="/admin.html" style="font-weight:600">⚙ 관리자</a>' : ''}
    <span style="font-size:.85em;color:#666;margin:0 .6rem">${escapeHtml(row.email)}</span>
    <button class="btn btn-ghost btn-sm" id="__logout-btn">로그아웃</button>
  `;
  document.getElementById("__logout-btn").onclick = signOut;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
