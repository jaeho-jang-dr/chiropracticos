// 챕터 HTML 상단에서 로드되어 접근 권한을 체크합니다.
// 비공개 페이지인데 로그인 안 했거나 access_level이 'approved' 미만이면
// /login.html?next=현재경로 로 리다이렉트.

import { supabase, getAccessLevel } from "./supabase-client.js";

(async () => {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const isPublic = window.PUBLIC_PAGES?.has(path) || window.PUBLIC_PAGES?.has(path + ".html");
  const isAdmin  = window.ADMIN_PAGES?.has(path);

  if (isPublic && !isAdmin) {
    // 공개 페이지 — 로그인 상태만 표시 위젯에 알려주면 됨
    updateNavWidget();
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/login.html?next=${next}`);
    return;
  }

  const level = await getAccessLevel();

  if (level === "blocked") {
    document.body.innerHTML = `
      <div style="max-width:560px;margin:8rem auto;padding:2rem;text-align:center;font-family:system-ui">
        <h1>🚫 접근이 차단되었습니다</h1>
        <p>이 계정은 관리자에 의해 차단되었습니다. 문의: <a href="mailto:drjang00@gmail.com">drjang00@gmail.com</a></p>
        <button onclick="(async()=>{const{supabase}=await import('/assets/supabase-client.js');await supabase.auth.signOut();location.href='/index.html'})()">로그아웃</button>
      </div>`;
    return;
  }

  if (isAdmin) {
    // admin.html은 role==='admin' 만 허용 (DB 측에서 RLS로 강제하지만 UX용 즉시 차단)
    const { data: { user } } = await supabase.auth.getUser();
    const { data: row } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (row?.role !== "admin") {
      document.body.innerHTML = `<div style="max-width:560px;margin:8rem auto;padding:2rem;text-align:center;font-family:system-ui">
        <h1>403</h1><p>관리자 전용 페이지입니다.</p><a href="/index.html">← 메인으로</a></div>`;
      return;
    }
    updateNavWidget();
    return;
  }

  // 일반 보호 페이지 — pending_approval 이면 안내 페이지
  if (level === "pending_approval" || level === "free") {
    document.body.innerHTML = `
      <div style="max-width:640px;margin:6rem auto;padding:2.5rem;text-align:center;font-family:system-ui;border:1px solid #e0e0e3;border-radius:16px;background:#fff">
        <h1 style="margin:0 0 1rem">⏳ 관리자 승인 대기 중</h1>
        <p style="color:#555;line-height:1.7">가입은 완료되었습니다. 본 강의 자료는 의료인(MD/PT) 전용으로, 자격 확인 후 관리자가 승인합니다. 보통 1-2일 이내 처리됩니다.</p>
        <p style="color:#888;font-size:.9em;margin-top:1.5rem">문의 / 자격 증빙: <a href="mailto:drjang00@gmail.com">drjang00@gmail.com</a></p>
        <div style="margin-top:2rem;display:flex;gap:.75rem;justify-content:center">
          <a href="/index.html" style="padding:.6rem 1.2rem;border-radius:999px;background:#f0f0f3;color:#333;text-decoration:none">← 메인</a>
          <a href="/chapter01_introduction.html" style="padding:.6rem 1.2rem;border-radius:999px;background:#0a84ff;color:#fff;text-decoration:none">Ch 1 서설 (공개)</a>
          <button onclick="(async()=>{const{supabase}=await import('/assets/supabase-client.js');await supabase.auth.signOut();location.href='/index.html'})()" style="padding:.6rem 1.2rem;border-radius:999px;background:transparent;border:1px solid #ddd;cursor:pointer">로그아웃</button>
        </div>
      </div>`;
    return;
  }

  // approved — pass through
  updateNavWidget();
})();

async function updateNavWidget() {
  const navAction = document.querySelector(".nav-actions");
  if (!navAction) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // 비로그인 — 기존 로그인 버튼 그대로
  const { data: row } = await supabase.from("users").select("role,access_level").eq("id", user.id).single();
  const isAdmin = row?.role === "admin";
  navAction.innerHTML = `
    ${isAdmin ? '<a class="btn btn-ghost btn-sm" href="/admin.html">⚙ 관리자</a>' : ''}
    <span style="font-size:.85em;color:#666;margin:0 .6rem">${user.email}</span>
    <button class="btn btn-ghost btn-sm" onclick="(async()=>{const{supabase}=await import('/assets/supabase-client.js');await supabase.auth.signOut();location.href='/index.html'})()">로그아웃</button>
  `;
}
