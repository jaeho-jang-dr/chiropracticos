-- =========================================================================
-- Chiropracticos · Supabase 스키마 + RLS + Trigger + Seed admin
-- =========================================================================
-- 실행 방법:
--   1. Supabase 콘솔 → SQL Editor → 새 쿼리 → 이 파일 전체 붙여넣기 → Run
--   2. drjang00@gmail.com 으로 가입 (Email 또는 Google) 후
--      마지막 SECTION 7의 seed 쿼리를 다시 실행 (UUID 채워서 admin 승격)
-- =========================================================================

-- =========================================================================
-- 1. users 테이블 — auth.users 와 1:1 (id == auth.users.id)
-- =========================================================================
create table if not exists public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique not null,
  provider        text not null default 'email',     -- email | google
  full_name       text,
  profession      text,                              -- MD | PT | DC | student | other
  affiliation     text,
  license_number  text,
  role            text not null default 'user',      -- user | admin
  access_level    text not null default 'pending_approval',  -- pending_approval | approved | free
  blocked_at      timestamptz,
  blocked_reason  text,
  created_at      timestamptz not null default now(),
  approved_at     timestamptz,
  last_login_at   timestamptz
);

create index if not exists users_access_level_idx on public.users(access_level);
create index if not exists users_role_idx          on public.users(role);

-- =========================================================================
-- 2. access_logs — 챕터 페이지 조회 로그
-- =========================================================================
create table if not exists public.access_logs (
  id           bigserial primary key,
  user_id      uuid references public.users(id) on delete set null,
  chapter_num  int,
  page_path    text,
  ip_address   text,
  user_agent   text,
  accessed_at  timestamptz not null default now()
);
create index if not exists access_logs_user_idx     on public.access_logs(user_id, accessed_at desc);
create index if not exists access_logs_chapter_idx  on public.access_logs(chapter_num, accessed_at desc);

-- =========================================================================
-- 3. downloads — PDF/MP4/PPTX 다운로드 로그
-- =========================================================================
create table if not exists public.downloads (
  id            bigserial primary key,
  user_id       uuid references public.users(id) on delete set null,
  file_path     text not null,
  file_type     text,
  bytes         bigint,
  downloaded_at timestamptz not null default now()
);
create index if not exists downloads_user_idx on public.downloads(user_id, downloaded_at desc);

-- =========================================================================
-- 4. admin_logs — 관리자가 user 권한 변경한 감사 기록
-- =========================================================================
create table if not exists public.admin_logs (
  id              bigserial primary key,
  admin_id        uuid references public.users(id) on delete set null,
  target_user_id  uuid references public.users(id) on delete set null,
  action          text not null,     -- approve | block | unblock | promote_admin | demote_admin
  before_value    jsonb,
  after_value     jsonb,
  reason          text,
  at              timestamptz not null default now()
);
create index if not exists admin_logs_target_idx on public.admin_logs(target_user_id, at desc);

-- =========================================================================
-- 5. Trigger — auth.users 가입 시 public.users 자동 생성
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (
    id, email, provider, full_name, profession, affiliation, license_number, role, access_level
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'profession',
    new.raw_user_meta_data->>'affiliation',
    new.raw_user_meta_data->>'license_number',
    case when new.email in ('drjang00@gmail.com', 'drjang000@gmail.com') then 'admin' else 'user' end,
    case when new.email in ('drjang00@gmail.com', 'drjang000@gmail.com') then 'approved' else 'pending_approval' end
  )
  on conflict (id) do update set
    email = excluded.email,
    last_login_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- 6. Row Level Security
-- =========================================================================
alter table public.users         enable row level security;
alter table public.access_logs   enable row level security;
alter table public.downloads     enable row level security;
alter table public.admin_logs    enable row level security;

-- helper: 현재 호출자가 admin?
create or replace function public.is_admin()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- ----- users 정책 -----
drop policy if exists "users self read"      on public.users;
drop policy if exists "users self update"    on public.users;
drop policy if exists "users admin all"      on public.users;

create policy "users self read"
  on public.users for select
  using ( auth.uid() = id );

create policy "users self update"
  on public.users for update
  using ( auth.uid() = id )
  with check (
    -- 본인은 role/access_level 못 바꿈 (admin만 변경 가능)
    role = (select role from public.users where id = auth.uid())
    and access_level = (select access_level from public.users where id = auth.uid())
    and blocked_at is not distinct from (select blocked_at from public.users where id = auth.uid())
  );

create policy "users admin all"
  on public.users for all
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- ----- access_logs 정책 -----
drop policy if exists "logs self insert"  on public.access_logs;
drop policy if exists "logs self read"    on public.access_logs;
drop policy if exists "logs admin read"   on public.access_logs;

create policy "logs self insert"
  on public.access_logs for insert
  with check ( auth.uid() = user_id );

create policy "logs self read"
  on public.access_logs for select
  using ( auth.uid() = user_id );

create policy "logs admin read"
  on public.access_logs for select
  using ( public.is_admin() );

-- ----- downloads 정책 (access_logs와 동일 패턴) -----
drop policy if exists "dl self insert"  on public.downloads;
drop policy if exists "dl self read"    on public.downloads;
drop policy if exists "dl admin read"   on public.downloads;

create policy "dl self insert" on public.downloads for insert with check ( auth.uid() = user_id );
create policy "dl self read"   on public.downloads for select using ( auth.uid() = user_id );
create policy "dl admin read"  on public.downloads for select using ( public.is_admin() );

-- ----- admin_logs: admin만 read/insert -----
drop policy if exists "admin logs admin only" on public.admin_logs;
create policy "admin logs admin only"
  on public.admin_logs for all
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- =========================================================================
-- 7. Seed admin 승격 (drjang00@gmail.com, drjang000@gmail.com)
-- =========================================================================
-- 위 trigger가 자동 처리하지만 안전망으로 한 번 더 강제:
update public.users
   set role = 'admin', access_level = 'approved', approved_at = coalesce(approved_at, now())
 where email in ('drjang00@gmail.com', 'drjang000@gmail.com');

-- 확인:
-- select email, role, access_level, created_at from public.users order by created_at desc;
