// Supabase JS SDK v2 (ESM via esm.sh CDN)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

if (!window.SUPABASE_URL || window.SUPABASE_URL.startsWith("REPLACE_ME")) {
  console.error("[supabase-client] config.js의 SUPABASE_URL/ANON_KEY가 아직 설정되지 않았습니다.");
}

export const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

// Promise that resolves once Supabase has finished restoring/processing the
// initial session (from localStorage or OAuth callback URL hash).
// This is the key fix for the "first login not recognized" race condition.
export const sessionReady = new Promise((resolve) => {
  let settled = false;
  const finish = (session) => {
    if (settled) return;
    settled = true;
    resolve(session);
  };

  // Subscribe to auth state — INITIAL_SESSION fires once on init,
  // SIGNED_IN fires after OAuth/email callback URL is processed.
  const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
      finish(session);
    }
  });

  // Safety timeout: don't hang forever if SDK is silent (rare)
  setTimeout(async () => {
    const { data } = await supabase.auth.getSession();
    finish(data.session);
  }, 1500);
});

// 현재 사용자의 access_level + role 가져오기 (trigger race retry 포함)
// returns: { user, row } or { user: null }
export async function getCurrentUserWithRow(retries = 3) {
  await sessionReady;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, row: null };

  for (let i = 0; i < retries; i++) {
    const { data, error } = await supabase
      .from("users")
      .select("role, access_level, blocked_at, full_name, email")
      .eq("id", user.id)
      .single();
    if (data) return { user, row: data };
    if (error?.code === "PGRST116") {
      // row not yet created by trigger — wait and retry
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      continue;
    }
    console.warn("[getCurrentUserWithRow] error", error);
    return { user, row: null };
  }
  return { user, row: null };
}

export async function getAccessLevel() {
  const { row } = await getCurrentUserWithRow();
  if (!row) return null;
  if (row.blocked_at) return "blocked";
  return row.access_level;
}

export async function getCurrentUser() {
  await sessionReady;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signOut() {
  await supabase.auth.signOut();
  location.href = "/index.html";
}
