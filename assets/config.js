// Supabase 설정 — anon key는 정의상 public (Row Level Security로 보호)
// service_role key는 여기 절대 넣지 말 것 (백엔드 전용)
//
// 이 값은 사용자가 Supabase 콘솔에서 받아온 후 교체합니다.
// Project Settings → API → URL · anon public key

window.SUPABASE_URL      = "REPLACE_ME_PROJECT_URL";
window.SUPABASE_ANON_KEY = "REPLACE_ME_ANON_KEY";

// 공개(로그인 불필요) 페이지 — 정확한 파일명 매칭
window.PUBLIC_PAGES = new Set([
  "/",
  "/index.html",
  "/login.html",
  "/signup.html",
  "/auth-callback.html",
  "/archive.html",
  "/chapter01_introduction.html",
]);

// admin 전용 페이지
window.ADMIN_PAGES = new Set([
  "/admin.html",
]);
