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
  },
});

// 현재 사용자의 access_level 가져오기
// returns: 'free' | 'pending_approval' | 'approved' | null (게스트)
export async function getAccessLevel() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("access_level, role, blocked_at")
    .eq("id", user.id)
    .single();

  if (error) {
    console.warn("[getAccessLevel] users row missing — calling ensure_user_row()", error);
    // RPC로 자동 생성 (DB trigger도 있지만 안전망)
    return "pending_approval";
  }
  if (data.blocked_at) return "blocked";
  return data.access_level;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signOut() {
  await supabase.auth.signOut();
  location.href = "/index.html";
}
