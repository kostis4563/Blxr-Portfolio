create or replace function public.mfa_satisfied()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors
        where user_id = auth.uid() and status = 'verified'
      );
$$;

revoke all on function public.mfa_satisfied() from public;
grant execute on function public.mfa_satisfied() to authenticated;

create or replace function public.is_site_owner()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from auth.users
           where id = auth.uid()
             and lower(email) = 'kostisnomikos@gmail.com'
             and email_confirmed_at is not null
         )
     and public.mfa_satisfied();
$$;

revoke all on function public.is_site_owner() from public;
grant execute on function public.is_site_owner() to authenticated;


create table if not exists public.day_blocks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  note        text not null default '',
  starts      time,
  ends        time,
  day         date not null default current_date,
  repeat      smallint not null default 0,
  done        date[] not null default '{}',
  skipped     date[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint day_blocks_title_len check (char_length(title) between 1 and 120),
  constraint day_blocks_note_len  check (char_length(note) <= 2000),
  constraint day_blocks_repeat    check (repeat between 0 and 127),
  constraint day_blocks_marks     check (cardinality(done) <= 400 and cardinality(skipped) <= 400)
);

alter table public.day_blocks alter column starts drop not null;
alter table public.day_blocks alter column ends drop not null;
alter table public.day_blocks drop column if exists colour;
alter table public.day_blocks drop constraint if exists day_blocks_order;
alter table public.day_blocks add constraint day_blocks_order
  check (ends is null or (starts is not null and ends > starts));

create index if not exists day_blocks_day on public.day_blocks (day);
create index if not exists day_blocks_routines on public.day_blocks (day) where repeat > 0;

create or replace function public.day_blocks_touch()
returns trigger language plpgsql as $$
begin
  new.id = old.id;
  new.created_at = old.created_at;
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists day_blocks_touch on public.day_blocks;
create trigger day_blocks_touch before update on public.day_blocks
  for each row execute function public.day_blocks_touch();

alter table public.day_blocks enable row level security;

revoke all on public.day_blocks from anon;
grant select, insert, update, delete on public.day_blocks to authenticated;

drop policy if exists "day: owner reads" on public.day_blocks;
create policy "day: owner reads" on public.day_blocks
  for select to authenticated using ((select public.is_site_owner()));

drop policy if exists "day: owner inserts" on public.day_blocks;
create policy "day: owner inserts" on public.day_blocks
  for insert to authenticated with check ((select public.is_site_owner()));

drop policy if exists "day: owner updates" on public.day_blocks;
create policy "day: owner updates" on public.day_blocks
  for update to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));

drop policy if exists "day: owner deletes" on public.day_blocks;
create policy "day: owner deletes" on public.day_blocks
  for delete to authenticated using ((select public.is_site_owner()));


create table if not exists public.day_homework (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null default '',
  title       text not null,
  due         date,
  done_on     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint day_homework_title_len   check (char_length(title) between 1 and 160),
  constraint day_homework_subject_len check (char_length(subject) <= 40)
);

create index if not exists day_homework_open on public.day_homework (due) where done_on is null;

drop trigger if exists day_homework_touch on public.day_homework;
create trigger day_homework_touch before update on public.day_homework
  for each row execute function public.day_blocks_touch();

alter table public.day_homework enable row level security;

revoke all on public.day_homework from anon;
grant select, insert, update, delete on public.day_homework to authenticated;

drop policy if exists "homework: owner reads" on public.day_homework;
create policy "homework: owner reads" on public.day_homework
  for select to authenticated using ((select public.is_site_owner()));

drop policy if exists "homework: owner inserts" on public.day_homework;
create policy "homework: owner inserts" on public.day_homework
  for insert to authenticated with check ((select public.is_site_owner()));

drop policy if exists "homework: owner updates" on public.day_homework;
create policy "homework: owner updates" on public.day_homework
  for update to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));

drop policy if exists "homework: owner deletes" on public.day_homework;
create policy "homework: owner deletes" on public.day_homework
  for delete to authenticated using ((select public.is_site_owner()));
