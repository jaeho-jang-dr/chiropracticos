-- =========================================================================
-- Migration · hidden_assets — admin이 즉시 감출 자산 목록
-- =========================================================================
-- public read (모든 사용자 페이지가 자산 hide를 위해 읽음)
-- admin write only (감추기/복원/사유 수정)
-- =========================================================================

create table if not exists public.hidden_assets (
  id          bigserial primary key,
  url         text unique not null,                                 -- 절대 URL (R2 full) 또는 상대 경로 모두 가능
  page_path   varchar(80),                                          -- 옵션: 특정 페이지에서만 hide
  reason      varchar(200),
  hidden_by   uuid references public.users(id) on delete set null,
  hidden_at   timestamptz not null default now()
);

create index if not exists hidden_assets_url_idx on public.hidden_assets(url);
create index if not exists hidden_assets_recent_idx on public.hidden_assets(hidden_at desc);

alter table public.hidden_assets enable row level security;

drop policy if exists "hidden_assets public read"   on public.hidden_assets;
drop policy if exists "hidden_assets admin write"   on public.hidden_assets;

-- 모든 사용자(익명 포함)가 hide 목록 읽기 가능 — 클라이언트 hide-guard.js가 사용
create policy "hidden_assets public read" on public.hidden_assets
  for select using (true);

-- INSERT/UPDATE/DELETE는 admin만
create policy "hidden_assets admin write" on public.hidden_assets
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.hidden_assets to anon, authenticated;
grant insert, update, delete on public.hidden_assets to authenticated;
grant usage, select on sequence public.hidden_assets_id_seq to authenticated;
