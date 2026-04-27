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

// OAuth callback 진행 중인지 감지 (URL hash나 search에 토큰/code 있음)
const hasOAuthInUrl =
  /[#&](access_token|refresh_token|provider_token|id_token)=/.test(location.hash) ||
  /[?&](code|error)=/.test(location.search);

// 세션 복원/OAuth callback 처리 완료까지 기다림
// - 일반 페이지: 빠른 timeout (3s)
// - OAuth callback 진행 중: 긴 timeout (15s) — INITIAL_SESSION 후에도 SIGNED_IN 기다림
export const sessionReady = new Promise((resolve) => {
  let settled = false;
  let initialFired = false;
  const finish = (session, why) => {
    if (settled) return;
    settled = true;
    trace("sessionReady resolved", { session: !!session, why });
    resolve(session);
  };

  trace("init", { hasOAuthInUrl, hash: location.hash.slice(0, 60), search: location.search.slice(0, 60) });

  supabase.auth.onAuthStateChange((event, session) => {
    trace("authStateChange", { event, hasSession: !!session });
    // OAuth callback 진행 중에는 INITIAL_SESSION(null)을 무시하고 SIGNED_IN 기다림
    if (event === "SIGNED_IN") {
      finish(session, event);
    } else if (event === "INITIAL_SESSION") {
      initialFired = true;
      // 세션이 있으면 즉시 resolve. 없는데 OAuth 진행 중이면 SIGNED_IN 기다림.
      if (session) finish(session, event);
      else if (!hasOAuthInUrl) finish(null, "initial-no-session");
    } else if (event === "TOKEN_REFRESHED" && session) {
      finish(session, event);
    }
  });

  // 안전망 timeout — OAuth 진행 시 길게
  const timeoutMs = hasOAuthInUrl ? 15000 : 3000;
  setTimeout(async () => {
    if (settled) return;
    const { data } = await supabase.auth.getSession();
    finish(data.session, `timeout-${timeoutMs}ms`);
  }, timeoutMs);
});

export async function getCurrentUserWithRow(retries = 6) {
  await sessionReady;
  const { data: { user } } = await supabase.auth.getUser();
  trace("getCurrentUserWithRow", { user: user?.email });
  if (!user) return { user: null, row: null };

  // 백오프: 300, 600, 1200, 2000, 3000, 4000 ms = 최대 ~11초 대기
  const delays = [300, 600, 1200, 2000, 3000, 4000];
  for (let i = 0; i < retries; i++) {
    const { data, error } = await supabase
      .from("users")
      .select("role, access_level, blocked_at, full_name, email")
      .eq("id", user.id)
      .single();
    if (data) {
      trace("user row loaded", { attempt: i + 1, role: data.role });
      return { user, row: data };
    }
    if (error?.code === "PGRST116") {
      trace("trigger race, retry", { attempt: i + 1, nextDelay: delays[i] });
      await new Promise((r) => setTimeout(r, delays[i] || 4000));
      continue;
    }
    trace("user row error", error);
    return { user, row: null };
  }
  trace("user row not found after all retries");
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
  let next = nextPath || (location.pathname.startsWith("/login") ? "/" : location.pathname);
  // .html 제거 (cleanUrl 형식) — Vercel 308 회피 + Supabase whitelist 매치 정확
  next = next.replace(/\.html(\?|$)/, "$1");
  // 빈 path는 /로
  if (!next || next === "") next = "/";
  const redirectTo = location.origin + next;
  trace("signInWithGoogle", { redirectTo });
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: "openid email profile",  // openid 추가 — id_token 받음
    },
  });
  if (error) {
    alert("Google 로그인 시작 실패: " + error.message);
    trace("signInWithGoogle error", error);
  }
}
