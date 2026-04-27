// Supabase JS SDK v2 (ESM via esm.sh CDN)
// 단순화: implicit flow (기본값), detectSessionInUrl로 OAuth 자동 처리.
// 모든 페이지가 이 모듈을 로드하면 supabase-js가 URL hash/code를 자동 처리.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEBUG = location.hash.includes("debug=1") || localStorage.getItem("auth_debug") === "1";
const log = (...a) => DEBUG && console.log("[auth]", ...a);
window.__authLog = [];
const trace = (msg, extra) => {
  const entry = { t: new Date().toISOString().slice(11, 23), msg, extra };
  window.__authLog.push(entry);
  log(msg, extra ?? "");
};

if (!window.SUPABASE_URL || window.SUPABASE_URL.startsWith("REPLACE_ME")) {
  alert("[config error] config.js의 SUPABASE_URL/ANON_KEY가 설정되지 않았습니다.");
}

trace("createClient", { url: window.SUPABASE_URL });

export const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // implicit flow가 기본 — hash로 토큰 옴, 별도 code exchange 불필요
  },
});

// 세션 복원/OAuth callback 처리 완료까지 기다림
export const sessionReady = new Promise((resolve) => {
  let settled = false;
  const finish = (session, why) => {
    if (settled) return;
    settled = true;
    trace("sessionReady resolved", { session: !!session, why });
    resolve(session);
  };

  // INITIAL_SESSION 또는 SIGNED_IN 둘 중 먼저 오는 것
  supabase.auth.onAuthStateChange((event, session) => {
    trace("authStateChange", { event, hasSession: !!session });
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN") finish(session, event);
  });

  // 안전망: 2초 내 이벤트 없으면 직접 조회
  setTimeout(async () => {
    const { data } = await supabase.auth.getSession();
    finish(data.session, "timeout");
  }, 2000);
});

export async function getCurrentUserWithRow(retries = 3) {
  await sessionReady;
  const { data: { user } } = await supabase.auth.getUser();
  trace("getCurrentUserWithRow", { user: user?.email });
  if (!user) return { user: null, row: null };

  for (let i = 0; i < retries; i++) {
    const { data, error } = await supabase
      .from("users")
      .select("role, access_level, blocked_at, full_name, email")
      .eq("id", user.id)
      .single();
    if (data) {
      trace("user row loaded", data);
      return { user, row: data };
    }
    if (error?.code === "PGRST116") {
      trace("trigger race, retry", { attempt: i + 1 });
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      continue;
    }
    trace("user row error", error);
    return { user, row: null };
  }
  trace("user row not found after retries");
  return { user, row: null };
}

export async function getCurrentUser() {
  await sessionReady;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signOut() {
  trace("signOut");
  await supabase.auth.signOut();
  location.href = "/";
}

// Google login — current page를 next로 사용
export async function signInWithGoogle(nextPath) {
  const next = nextPath || (location.pathname.startsWith("/login") ? "/" : location.pathname);
  // redirectTo는 cleanUrl 형식 (.html 없이) — Vercel 308 리다이렉트 회피
  // 그리고 next는 path로 인코딩 (Supabase가 이걸 그대로 따라감)
  const redirectTo = location.origin + next;
  trace("signInWithGoogle", { redirectTo });
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) {
    alert("Google 로그인 시작 실패: " + error.message);
    trace("signInWithGoogle error", error);
  }
}
