-- =========================================================================
-- Chiropracticos · Supabase 스키마 v2 (500MB Free 한도 안전 설계)
-- =========================================================================
-- 실행 방법:
--   Supabase 콘솔 → SQL Editor → 새 쿼리 → 이 파일 전체 붙여넣기 → Run
--   v1을 이미 실행했다면: 데이터가 비어있는 경우 안전하게 DROP CASCADE → 재생성.
-- =========================================================================
-- 핵심 설계
--   ① 타입 슬림화: chapter_num=smallint · ip=inet · page_path=varchar(80) ·
--      user_agent 컬럼 자체 제거 (절약 ~150B/row)
--   ② access_logs 30일 TTL  · downloads 90일 TTL · admin_logs 영구
--   ③ daily_chapter_views 집계 테이블에 일자별 카운트만 영구 보존
--   ④ pg_cron 매일 03:00 UTC(12:00 KST) 자동 정리 + 집계
--   ⑤ db_stats() RPC: 관리자가 현재 사용량 한눈에 확인
-- 예상 규모(1000 user, 30 views/day, 30일 유지 기준):
--   access_logs ≈ 72MB · daily_chapter_views ≈ 1MB · users ≈ 1MB
--   admin_logs ≈ 1MB · downloads ≈ 5MB · 인덱스 + Postgres overhead 100MB
--   = 합계 약 180MB / 500MB (36%) ✅
-- =========================================================================

-- 0. 안전한 v1 → v2 정리 (no-data 가정 — 운영 데이터 있다면 백업 후 실행)
drop table if exists public.access_logs       cascade;
drop table if exists public.downloads         cascade;
drop table if exists public.admin_logs        cascade;
drop table if exists public.daily_chapter_views cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin()        cascade;
drop function if exists public.cleanup_old_logs() cascade;
drop function if exists public.db_stats()         cascade;
-- users 테이블은 보존 (auth.users FK 깨면 가입자 손실) — ALTER만 적용:
alter table if exists public.users drop column if exists last_login_at;
alter table if exists public.users alter column profession   type varchar(20);
alter table if exists public.users alter column affiliation  type varchar(120);
alter table if exists public.users alter column license_number type varchar(40);

-- =========================================================================
-- 1. extensions
-- =========================================================================
create extension if not exists pg_cron       with schema extensions;
create extension if not exists pg_stat_statements;

-- =========================================================================
-- 2. users (auth.users 와 1:1) — 슬림 타입
-- =========================================================================
create table if not exists public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           varchar(120) unique not null,
  provider        varchar(20)  not null default 'email',     -- email | google
  full_name       varchar(60),
  profession      varchar(20),                               -- MD | PT | DC | student | other
  affiliation     varchar(120),
  license_number  varchar(40),
  role            varchar(10)  not null default 'user',      -- user | admin
  access_level    varchar(20)  not null default 'pending_approval',
  blocked_at      timestamptz,
  blocked_reason  varchar(200),
  created_at      timestamptz  not null default now(),
  approved_at     timestamptz
);
create index if not exists users_access_level_idx on public.users(access_level)
  where blocked_at is null;
create index if not exists users_role_idx          on public.users(role)
  where role = 'admin';

-- =========================================================================
-- 3. access_logs — 챕터 페이지 조회 (30일 TTL · user_agent 없음)
-- =========================================================================
create table if not exists public.access_logs (
  id           bigserial primary key,
  user_id      uuid references public.users(id) on delete set null,
  chapter_num  smallint,
  page_path    varchar(80),
  ip_address   inet,
  accessed_at  timestamptz not null default now()
);
-- BRIN 인덱스: 시간순 추가 only 데이터에 매우 작음 (KB 단위)
create index if not exists access_logs_time_brin
  on public.access_logs using brin (accessed_at);
create index if not exists access_logs_user_recent_idx
  on public.access_logs (user_id, accessed_at desc);

-- =========================================================================
-- 4. downloads — PDF/MP4/PPTX 다운로드 (90일 TTL)
-- =========================================================================
create table if not exists public.downloads (
  id            bigserial primary key,
  user_id       uuid references public.users(id) on delete set null,
  file_path     varchar(120) not null,
  file_type     varchar(10),
  bytes         integer,                  -- bigint 불필요 (단일 파일 < 2GB)
  downloaded_at timestamptz not null default now()
);
create index if not exists downloads_time_brin
  on public.downloads using brin (downloaded_at);
create index if not exists downloads_user_recent_idx
  on public.downloads (user_id, downloaded_at desc);

-- =========================================================================
-- 5. admin_logs — 영구 보존 (양 적음)
-- =========================================================================
create table if not exists public.admin_logs (
  id              bigserial primary key,
  admin_id        uuid references public.users(id) on delete set null,
  target_user_id  uuid references public.users(id) on delete set null,
  action          varchar(20) not null,
  before_value    jsonb,
  after_value     jsonb,
  reason          varchar(200),
  at              timestamptz not null default now()
);
create index if not exists admin_logs_target_idx on public.admin_logs(target_user_id, at desc);

-- =========================================================================
-- 6. daily_chapter_views — 일자별 집계 (영구) · access_logs 삭제 전 roll-up
-- =========================================================================
create table if not exists public.daily_chapter_views (
  view_date    date     not null,
  chapter_num  smallint not null,
  view_count   integer  not null default 0,
  unique_users integer  not null default 0,
  primary key (view_date, chapter_num)
);

-- =========================================================================
-- 6b. hidden_assets — admin이 즉시 감출 자산 (URL 기반, public read)
-- =========================================================================
create table if not exists public.hidden_assets (
  id          bigserial primary key,
  url         text unique not null,
  page_path   varchar(80),
  reason      varchar(200),
  hidden_by   uuid references public.users(id) on delete set null,
  hidden_at   timestamptz not null default now()
);
create index if not exists hidden_assets_url_idx    on public.hidden_assets(url);
create index if not exists hidden_assets_recent_idx on public.hidden_assets(hidden_at desc);

-- =========================================================================
-- 7. Trigger: auth 가입 시 public.users 자동 생성 (admin 두 이메일 자동 승격)
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (
    id, email, provider, full_name, profession, affiliation, license_number, role, access_level, approved_at
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'profession',
    new.raw_user_meta_data->>'affiliation',
    new.raw_user_meta_data->>'license_number',
    case when new.email in ('drjang00@gmail.com','drjang000@gmail.com') then 'admin' else 'user' end,
    case when new.email in ('drjang00@gmail.com','drjang000@gmail.com') then 'approved' else 'pending_approval' end,
    case when new.email in ('drjang00@gmail.com','drjang000@gmail.com') then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- 8. is_admin() helper (RLS에서 사용)
-- =========================================================================
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;

-- =========================================================================
-- 9. cleanup_old_logs() — 일일 정리 + 집계 (pg_cron이 호출)
--    ① 어제 access_logs를 daily_chapter_views로 roll-up
--    ② 30일 초과 access_logs 삭제
--    ③ 90일 초과 downloads 삭제
-- =========================================================================
create or replace function public.cleanup_old_logs()
returns table(rolled_up integer, access_deleted integer, downloads_deleted integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_rolled    int;
  v_acc_del   int;
  v_dl_del    int;
begin
  -- (1) yesterday roll-up: insert/update aggregates
  with yesterday_agg as (
    select
      (accessed_at at time zone 'Asia/Seoul')::date as view_date,
      chapter_num,
      count(*)::int as view_count,
      count(distinct user_id)::int as unique_users
    from public.access_logs
    where chapter_num is not null
      and accessed_at >= ((now() at time zone 'Asia/Seoul')::date - interval '1 day')
      and accessed_at <  ((now() at time zone 'Asia/Seoul')::date)
    group by 1, 2
  ),
  upsert as (
    insert into public.daily_chapter_views (view_date, chapter_num, view_count, unique_users)
    select view_date, chapter_num, view_count, unique_users from yesterday_agg
    on conflict (view_date, chapter_num) do update set
      view_count   = excluded.view_count,
      unique_users = excluded.unique_users
    returning 1
  )
  select count(*) into v_rolled from upsert;

  -- (2) access_logs 30일 초과 삭제
  delete from public.access_logs where accessed_at < now() - interval '30 days';
  get diagnostics v_acc_del = row_count;

  -- (3) downloads 90일 초과 삭제
  delete from public.downloads where downloaded_at < now() - interval '90 days';
  get diagnostics v_dl_del = row_count;

  return query select v_rolled, v_acc_del, v_dl_del;
end;
$$;

-- =========================================================================
-- 10. pg_cron 스케줄 — 매일 03:00 UTC (= 12:00 KST)
-- =========================================================================
do $$
begin
  -- 기존 동일 job 있으면 제거
  perform cron.unschedule(jobid)
    from cron.job where jobname = 'chiropracticos_cleanup_logs';
exception when others then null;
end $$;

select cron.schedule(
  'chiropracticos_cleanup_logs',
  '0 3 * * *',
  $$ select public.cleanup_old_logs(); $$
);

-- =========================================================================
-- 11. db_stats() — 관리자 대시보드용
-- =========================================================================
create or replace function public.db_stats()
returns table(
  table_name      text,
  row_count       bigint,
  size_pretty     text,
  size_bytes      bigint
)
language sql security definer set search_path = public
as $$
  select
    c.relname::text as table_name,
    c.reltuples::bigint as row_count,
    pg_size_pretty(pg_total_relation_size(c.oid)) as size_pretty,
    pg_total_relation_size(c.oid)::bigint as size_bytes
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc;
$$;

create or replace function public.db_total_size()
returns table(total_bytes bigint, total_pretty text, percent_of_500mb numeric)
language sql security definer set search_path = public
as $$
  select
    sum(pg_total_relation_size(c.oid))::bigint as total_bytes,
    pg_size_pretty(sum(pg_total_relation_size(c.oid))) as total_pretty,
    round((sum(pg_total_relation_size(c.oid))::numeric / (500 * 1024 * 1024)) * 100, 2) as percent_of_500mb
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';
$$;

-- =========================================================================
-- 12. Row Level Security
-- =========================================================================
alter table public.users               enable row level security;
alter table public.access_logs         enable row level security;
alter table public.downloads           enable row level security;
alter table public.admin_logs          enable row level security;
alter table public.daily_chapter_views enable row level security;

-- ---- users ----
drop policy if exists "users self read"   on public.users;
drop policy if exists "users self update" on public.users;
drop policy if exists "users admin all"   on public.users;

create policy "users self read"   on public.users for select using ( auth.uid() = id );
create policy "users self update" on public.users for update using ( auth.uid() = id )
  with check (
    role = (select role from public.users where id = auth.uid())
    and access_level = (select access_level from public.users where id = auth.uid())
    and blocked_at is not distinct from (select blocked_at from public.users where id = auth.uid())
  );
create policy "users admin all"   on public.users for all
  using ( public.is_admin() ) with check ( public.is_admin() );

-- ---- access_logs ----
drop policy if exists "logs self insert" on public.access_logs;
drop policy if exists "logs self read"   on public.access_logs;
drop policy if exists "logs admin read"  on public.access_logs;

create policy "logs self insert" on public.access_logs for insert
  with check ( auth.uid() = user_id );
create policy "logs self read"   on public.access_logs for select
  using ( auth.uid() = user_id );
create policy "logs admin read"  on public.access_logs for select
  using ( public.is_admin() );

-- ---- downloads ----
drop policy if exists "dl self insert" on public.downloads;
drop policy if exists "dl self read"   on public.downloads;
drop policy if exists "dl admin read"  on public.downloads;

create policy "dl self insert" on public.downloads for insert with check ( auth.uid() = user_id );
create policy "dl self read"   on public.downloads for select using ( auth.uid() = user_id );
create policy "dl admin read"  on public.downloads for select using ( public.is_admin() );

-- ---- admin_logs ----
drop policy if exists "admin logs admin only" on public.admin_logs;
create policy "admin logs admin only" on public.admin_logs for all
  using ( public.is_admin() ) with check ( public.is_admin() );

-- ---- daily_chapter_views (admin 읽기 + cleanup_old_logs() insert) ----
drop policy if exists "dcv admin read"   on public.daily_chapter_views;
create policy "dcv admin read" on public.daily_chapter_views for select
  using ( public.is_admin() );
-- cleanup_old_logs()는 security definer라 RLS 우회 — insert 정책 불필요

-- ---- hidden_assets (public read · admin write) ----
alter table public.hidden_assets enable row level security;
drop policy if exists "hidden_assets public read" on public.hidden_assets;
drop policy if exists "hidden_assets admin write" on public.hidden_assets;
create policy "hidden_assets public read" on public.hidden_assets for select using (true);
create policy "hidden_assets admin write" on public.hidden_assets for all
  using (public.is_admin()) with check (public.is_admin());
grant select on public.hidden_assets to anon, authenticated;
grant insert, update, delete on public.hidden_assets to authenticated;
grant usage, select on sequence public.hidden_assets_id_seq to authenticated;

-- =========================================================================
-- 13. Seed admin 승격 (이미 가입한 경우 안전망)
-- =========================================================================
update public.users
   set role = 'admin',
       access_level = 'approved',
       approved_at = coalesce(approved_at, now())
 where email in ('drjang00@gmail.com', 'drjang000@gmail.com');

-- =========================================================================
-- 14. 권한: anon/authenticated 가 RPC 호출 가능하도록
-- =========================================================================
grant execute on function public.is_admin()         to anon, authenticated;
grant execute on function public.db_stats()         to authenticated;
grant execute on function public.db_total_size()    to authenticated;
-- cleanup_old_logs는 cron만 호출 (수동 호출은 admin만)
grant execute on function public.cleanup_old_logs() to authenticated;

-- =========================================================================
-- DONE — 확인 쿼리
-- =========================================================================
-- select * from public.db_stats();
-- select * from public.db_total_size();
-- select * from cron.job where jobname = 'chiropracticos_cleanup_logs';
-- select email, role, access_level from public.users order by created_at desc;
