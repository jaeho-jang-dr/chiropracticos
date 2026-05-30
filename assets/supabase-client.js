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

// 일시적(네트워크/타임아웃/5xx) 오류인지 — 확정 거부와 구분해 재시도/상태 분기.
function isTransientError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  if (/fetch|network|timeout|econn|socket|temporar/.test(msg)) return true;
  const status = Number(error.status || code);
  if (status >= 500 && status < 600) return true;
  return false;
}

// 반환: { user, row, error }
//  - row 있음        → 정상 (error: null)
//  - row null·error null → 행이 진짜 없음(신규 가입/미승인) = "확정 거부"
//  - row null·error 有   → 조회 실패(네트워크/5xx) = "판단 불가" → 호출자가 대기벽 대신 재시도 안내
export async function getCurrentUserWithRow(retries = 6) {
  await sessionReady;
  const { data: { user } } = await supabase.auth.getUser();
  trace("getCurrentUserWithRow", { user: user?.email });
  if (!user) return { user: null, row: null, error: null };

  // 백오프: 300, 600, 1200, 2000, 3000, 4000 ms = 최대 ~11초 대기
  const delays = [300, 600, 1200, 2000, 3000, 4000];
  let lastError = null;
  for (let i = 0; i < retries; i++) {
    const { data, error } = await supabase
      .from("users")
      .select("role, access_level, blocked_at, full_name, email")
      .eq("id", user.id)
      .single();
    if (data) {
      trace("user row loaded", { attempt: i + 1, role: data.role });
      return { user, row: data, error: null };
    }
    lastError = error;
    // PGRST116(트리거 레이스 — 행 미생성) + 일시적 오류는 재시도 대상.
    const retryable = error && (error.code === "PGRST116" || isTransientError(error));
    if (retryable && i < retries - 1) {
      trace("row fetch retry", { attempt: i + 1, code: error.code, nextDelay: delays[i] });
      await new Promise((r) => setTimeout(r, delays[i] || 4000));
      continue;
    }
    // PGRST116로 종료 → 행이 진짜 없음(확정). 그 외 오류는 "판단 불가"로 surface.
    if (error?.code === "PGRST116") return { user, row: null, error: null };
    trace("user row error", error);
    return { user, row: null, error: error || null };
  }
  trace("user row not found after all retries");
  return { user, row: null, error: lastError?.code === "PGRST116" ? null : lastError };
}

export async function getCurrentUser() {
  await sessionReady;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signOut() {
  trace("signOut");
  await supabase.auth.signOut();
  clearStaleAuth();
  location.href = "/";
}

// Stale 세션 강제 청소 — 로그인 시도 직전 호출
// supabase signOut만으로 못 잡는 경우(SDK 깨짐, 다른 탭에서 로그아웃 등)도 cover
export function clearStaleAuth() {
  trace("clearStaleAuth");
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith("sb-") || k.includes("supabase"))) {
      keys.push(k);
    }
  }
  keys.forEach((k) => localStorage.removeItem(k));
  // sessionStorage 도 청소 (혹시 SDK가 남긴 게 있으면)
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const k = sessionStorage.key(i);
    if (k && (k.startsWith("sb-") || k.includes("supabase"))) sessionStorage.removeItem(k);
  }
  trace("clearStaleAuth done", { removed: keys.length });
  return keys.length;
}

// Google login — current page를 next로 사용
// stale 세션 자동 청소 → 매번 깨끗한 신규 OAuth flow
export async function signInWithGoogle(nextPath) {
  let next = nextPath || (location.pathname.startsWith("/login") ? "/" : location.pathname);
  next = next.replace(/\.html(\?|$)/, "$1");
  if (!next || next === "") next = "/";
  // open redirect 방어 — protocol-relative('//evil.com')·외부 URL 차단
  if (!next.startsWith("/") || next.startsWith("//")) next = "/";
  // 청소: 옛 세션 토큰 + 메모리 + 서버 sign-out
  clearStaleAuth();
  try { await supabase.auth.signOut(); } catch {}
  const redirectTo = location.origin + next;
  trace("signInWithGoogle", { redirectTo });
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: "openid email profile",
      queryParams: { prompt: "select_account" },  // Google 계정 선택 화면 강제 — 다른 계정 로그인 가능
    },
  });
  if (error) {
    alert("Google 로그인 시작 실패: " + error.message);
    trace("signInWithGoogle error", error);
  }
}

// Email login — stale 세션 청소 후 재로그인
export async function signInWithEmail(email, password) {
  clearStaleAuth();
  try { await supabase.auth.signOut(); } catch {}
  trace("signInWithEmail", { email });
  return supabase.auth.signInWithPassword({ email, password });
}
