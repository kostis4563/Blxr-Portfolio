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

create or replace function public.volunteer_tags_ok(tags text[])
returns boolean
language sql immutable as $$
  select coalesce(array_length(tags, 1), 0) <= 6
     and not exists (select 1 from unnest(tags) t where t is null or char_length(t) not between 1 and 24);
$$;

create or replace function public.volunteer_photos_ok(photos text[])
returns boolean
language sql immutable as $$
  select coalesce(array_length(photos, 1), 0) <= 8
     and not exists (select 1 from unnest(photos) p where p is null or p !~ '^[0-9a-f-]{36}/[a-z0-9-]{1,60}\.webp$');
$$;


create table if not exists public.volunteer_events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  organization  text not null default '',
  role          text not null default '',
  location      text not null default '',
  started_on    date not null,
  ended_on      date,
  hours         numeric(6, 1),
  summary       text not null default '',
  url           text,
  tags          text[] not null default '{}',
  photos        text[] not null default '{}',
  published     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint volunteer_title_len        check (char_length(title) between 1 and 80),
  constraint volunteer_organization_len check (char_length(organization) <= 80),
  constraint volunteer_role_len         check (char_length(role) <= 60),
  constraint volunteer_location_len     check (char_length(location) <= 80),
  constraint volunteer_summary_len      check (char_length(summary) <= 1200),
  constraint volunteer_dates            check (ended_on is null or ended_on >= started_on),
  constraint volunteer_hours            check (hours is null or (hours > 0 and hours <= 5000)),
  constraint volunteer_url              check (url is null or (char_length(url) <= 300 and url ~ '^https?://[^[:space:]<>"''`]+$')),
  constraint volunteer_tags             check (public.volunteer_tags_ok(tags)),
  constraint volunteer_photos           check (public.volunteer_photos_ok(photos))
);

create index if not exists volunteer_events_started on public.volunteer_events (started_on desc);

create or replace function public.volunteer_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists volunteer_touch on public.volunteer_events;
create trigger volunteer_touch before update on public.volunteer_events
  for each row execute function public.volunteer_touch();

alter table public.volunteer_events enable row level security;

grant select on public.volunteer_events to anon, authenticated;
grant insert, update, delete on public.volunteer_events to authenticated;

drop policy if exists "volunteer: read published" on public.volunteer_events;
create policy "volunteer: read published" on public.volunteer_events
  for select to anon, authenticated using (published);

drop policy if exists "volunteer: owner reads all" on public.volunteer_events;
create policy "volunteer: owner reads all" on public.volunteer_events
  for select to authenticated using ((select public.is_site_owner()));

drop policy if exists "volunteer: owner inserts" on public.volunteer_events;
create policy "volunteer: owner inserts" on public.volunteer_events
  for insert to authenticated with check ((select public.is_site_owner()));

drop policy if exists "volunteer: owner updates" on public.volunteer_events;
create policy "volunteer: owner updates" on public.volunteer_events
  for update to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));

drop policy if exists "volunteer: owner deletes" on public.volunteer_events;
create policy "volunteer: owner deletes" on public.volunteer_events
  for delete to authenticated using ((select public.is_site_owner()));


insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('volunteer', 'volunteer', true, 2097152, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "volunteer: public photos" on storage.objects;
create policy "volunteer: public photos" on storage.objects
  for select using (bucket_id = 'volunteer');

drop policy if exists "volunteer: owner uploads" on storage.objects;
create policy "volunteer: owner uploads" on storage.objects
  for insert to authenticated with check (bucket_id = 'volunteer' and (select public.is_site_owner()));

drop policy if exists "volunteer: owner replaces" on storage.objects;
create policy "volunteer: owner replaces" on storage.objects
  for update to authenticated using (bucket_id = 'volunteer' and (select public.is_site_owner()));

drop policy if exists "volunteer: owner removes" on storage.objects;
create policy "volunteer: owner removes" on storage.objects
  for delete to authenticated using (bucket_id = 'volunteer' and (select public.is_site_owner()));
