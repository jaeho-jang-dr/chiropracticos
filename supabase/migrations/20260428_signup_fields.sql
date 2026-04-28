-- =========================================================================
-- Migration · 가입 신청서 추가 필드 (age / phone / address)
-- =========================================================================
-- profession 옵션을 의사·물리치료사 중심으로 단순화하되 기존 값(DC/student/other)은
-- 그대로 유지 (varchar(20)이므로 ALTER 불필요).
-- =========================================================================

alter table public.users add column if not exists age          smallint;
alter table public.users add column if not exists phone        varchar(20);
alter table public.users add column if not exists address      varchar(200);

-- 신규 트리거: raw_user_meta_data에서 age/phone/address도 함께 채워넣기
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (
    id, email, provider, full_name, profession, affiliation, license_number,
    age, phone, address,
    role, access_level, approved_at
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'profession',
    new.raw_user_meta_data->>'affiliation',
    new.raw_user_meta_data->>'license_number',
    nullif(new.raw_user_meta_data->>'age', '')::smallint,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'address',
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
