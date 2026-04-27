// Supabase 설정 — anon key는 정의상 public (Row Level Security로 보호)
// service_role key는 여기 절대 넣지 말 것 (백엔드 전용)
//
// 이 값은 사용자가 Supabase 콘솔에서 받아온 후 교체합니다.
// Project Settings → API → URL · anon public key

window.SUPABASE_URL      = "https://nfnjjroaohalrtduzvfm.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mbmpqcm9hb2hhbHJ0ZHV6dmZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjE1ODMsImV4cCI6MjA5Mjc5NzU4M30.OMUCUv48zJWhvDXDRSTmMdUZFxSWOzHBlX9n3jGEtIE";

// 공개(로그인 불필요) 페이지 — cleanUrl 변형도 함께
window.PUBLIC_PAGES = new Set([
  "/",
  "/index", "/index.html",
  "/login", "/login.html",
  "/signup", "/signup.html",
  "/auth-callback", "/auth-callback.html",
  "/archive", "/archive.html",
  "/chapter01_introduction", "/chapter01_introduction.html",
  "/debug", "/debug.html",
]);

// admin 전용 페이지
window.ADMIN_PAGES = new Set([
  "/admin", "/admin.html",
]);
