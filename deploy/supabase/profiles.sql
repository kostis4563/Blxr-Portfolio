create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  handle        text not null unique,
  display_name  text not null,
  headline      text not null default '',
  bio           text not null default '',
  pronouns      text not null default '',
  location      text not null default '',
  website       text not null default '',
  avatar_url    text,
  accent        text not null default 'ink',
  open_to_work  boolean not null default false,
  links         jsonb not null default '[]'::jsonb,
  skills        text[] not null default '{}',
  visibility    text not null default 'private',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_handle_format  check (handle ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_handle_reserved check (handle not in (
    'admin', 'administrator', 'api', 'blxr', 'dashboard', 'help', 'login', 'me', 'mod',
    'moderator', 'null', 'owner', 'profile', 'root', 'settings', 'staff', 'support', 'system',
    'undefined', 'www'
  )),
  constraint profiles_display_name_len check (char_length(display_name) between 1 and 40),
  constraint profiles_headline_len     check (char_length(headline) <= 80),
  constraint profiles_bio_len          check (char_length(bio) <= 500),
  constraint profiles_pronouns_len     check (char_length(pronouns) <= 24),
  constraint profiles_location_len     check (char_length(location) <= 64),
  constraint profiles_website_len      check (char_length(website) <= 200),
  constraint profiles_avatar_len       check (avatar_url is null or char_length(avatar_url) <= 400),
  constraint profiles_avatar_host      check (avatar_url is null or avatar_url ~ '^https://(lh3\.googleusercontent\.com/|avatars\.githubusercontent\.com/|cdn\.discordapp\.com/|[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/)'),
  constraint profiles_accent           check (accent in ('ink', 'violet', 'blue', 'teal', 'green', 'amber', 'rose')),
  constraint profiles_links_shape      check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 6),
  constraint profiles_skills_len       check (coalesce(array_length(skills, 1), 0) <= 12),
  constraint profiles_visibility       check (visibility in ('public', 'unlisted', 'private'))
);

alter table public.profiles
  add column if not exists status       text not null default '',
  add column if not exists now_text     text not null default '',
  add column if not exists showcase     jsonb not null default '[]'::jsonb,
  add column if not exists cover_url    text,
  add column if not exists layout       text not null default 'card',
  add column if not exists pattern      text not null default 'dots',
  add column if not exists avatar_shape text not null default 'circle',
  add column if not exists theme        text not null default 'system',
  add column if not exists sections     text[] not null default '{about,now,showcase,links,skills}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_status_len') then
    alter table public.profiles
      add constraint profiles_status_len    check (char_length(status) <= 60),
      add constraint profiles_now_len       check (char_length(now_text) <= 240),
      add constraint profiles_showcase_shape check (jsonb_typeof(showcase) = 'array' and jsonb_array_length(showcase) <= 4),
      add constraint profiles_cover_len     check (cover_url is null or char_length(cover_url) <= 400),
      add constraint profiles_cover_host    check (cover_url is null or cover_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/'),
      add constraint profiles_layout        check (layout in ('card', 'cover', 'minimal')),
      add constraint profiles_pattern       check (pattern in ('dots', 'grid', 'none')),
      add constraint profiles_avatar_shape  check (avatar_shape in ('circle', 'rounded')),
      add constraint profiles_theme         check (theme in ('system', 'light', 'dark')),
      add constraint profiles_sections_len  check (coalesce(array_length(sections, 1), 0) <= 5);
  end if;
end $$;

alter table public.profiles
  add column if not exists discord_id        text,
  add column if not exists decoration        text not null default 'none',
  add column if not exists decoration_url    text,
  add column if not exists nameplate         text not null default 'none',
  add column if not exists nameplate_asset   text,
  add column if not exists nameplate_palette text,
  add column if not exists tag_text          text not null default '',
  add column if not exists tag_badge_url     text,
  add column if not exists accent_hex        text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_decoration') then
    alter table public.profiles
      add constraint profiles_discord_id      check (discord_id is null or discord_id ~ '^[0-9]{17,20}$'),
      add constraint profiles_decoration      check (decoration in ('none', 'ring', 'glow', 'halo', 'image')),
      add constraint profiles_decoration_url  check (decoration_url is null or (char_length(decoration_url) <= 400 and decoration_url ~ '^https://cdn\.discordapp\.com/avatar-decoration-presets/[A-Za-z0-9_./-]+\.png(\?[A-Za-z0-9_=&]*)?$')),
      add constraint profiles_nameplate       check (nameplate in ('none', 'accent', 'image')),
      add constraint profiles_nameplate_asset check (nameplate_asset is null or nameplate_asset ~ '^nameplates/[A-Za-z0-9_./-]{1,120}$'),
      add constraint profiles_nameplate_palette check (nameplate_palette is null or nameplate_palette ~ '^[a-z_]{1,24}$'),
      add constraint profiles_tag_text        check (char_length(tag_text) <= 4),
      add constraint profiles_tag_badge_url   check (tag_badge_url is null or (char_length(tag_badge_url) <= 400 and tag_badge_url ~ '^https://cdn\.discordapp\.com/guild-tag-badges/[0-9]{17,20}/[a-f0-9]{32}\.png(\?[A-Za-z0-9_=&]*)?$')),
      add constraint profiles_accent_hex      check (accent_hex is null or accent_hex ~ '^#[0-9a-f]{6}$');
  end if;
end $$;

alter table public.profiles drop constraint if exists profiles_accent;
alter table public.profiles
  add constraint profiles_accent check (accent in ('ink', 'violet', 'blue', 'teal', 'green', 'amber', 'rose', 'custom'));
alter table public.profiles drop constraint if exists profiles_cover_host;
alter table public.profiles
  add constraint profiles_cover_host check (cover_url is null or cover_url ~ '^https://(cdn\.discordapp\.com/banners/|[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/)');

create or replace function public.http_url_ok(candidate text, max_len integer default 400)
returns boolean
language sql immutable as $$
  select candidate is not null
     and char_length(candidate) <= max_len
     and candidate ~ '^https?://[^[:space:]<>"''`]+$';
$$;

create or replace function public.text_items_ok(items text[], max_len integer)
returns boolean
language sql immutable as $$
  select not exists (
    select 1 from unnest(items) s where s is null or char_length(s) not between 1 and max_len
  );
$$;

create or replace function public.profile_links_ok(links jsonb)
returns boolean
language sql immutable as $$
  select case when jsonb_typeof(links) = 'array' then
     jsonb_array_length(links) <= 6
     and not exists (
       select 1 from jsonb_array_elements(links) l
       where jsonb_typeof(l) <> 'object'
          or not public.http_url_ok(l ->> 'url', 200)
          or (l ? 'label' and (jsonb_typeof(l -> 'label') <> 'string' or char_length(l ->> 'label') > 24))
          or (case when jsonb_typeof(l) = 'object' then exists (select 1 from jsonb_object_keys(l) k where k not in ('url', 'label')) else true end)
     )
  else false end;
$$;

create or replace function public.profile_showcase_ok(showcase jsonb)
returns boolean
language sql immutable as $$
  select case when jsonb_typeof(showcase) = 'array' then
     jsonb_array_length(showcase) <= 4
     and not exists (
       select 1 from jsonb_array_elements(showcase) s
       where jsonb_typeof(s) <> 'object'
          or jsonb_typeof(s -> 'title') <> 'string'
          or char_length(s ->> 'title') not between 1 and 40
          or (s ? 'description' and (jsonb_typeof(s -> 'description') <> 'string' or char_length(s ->> 'description') > 120))
          or (s ? 'url' and jsonb_typeof(s -> 'url') <> 'string')
          or (coalesce(s ->> 'url', '') <> '' and not public.http_url_ok(s ->> 'url', 200))
          or (case when jsonb_typeof(s) = 'object' then exists (select 1 from jsonb_object_keys(s) k where k not in ('title', 'description', 'url')) else true end)
     )
  else false end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_website_url') then
    alter table public.profiles
      add constraint profiles_website_url check (website = '' or public.http_url_ok(website, 200)) not valid,
      add constraint profiles_links_ok     check (public.profile_links_ok(links)) not valid,
      add constraint profiles_showcase_ok  check (public.profile_showcase_ok(showcase)) not valid,
      add constraint profiles_skills_shape check (public.text_items_ok(skills, 24)) not valid,
      add constraint profiles_sections_shape check (sections <@ '{about,now,showcase,links,skills}'::text[]) not valid;
  end if;
end $$;

create index if not exists profiles_visibility_idx on public.profiles (visibility) where visibility = 'public';

create or replace function public.profiles_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.profiles_touch();

create or replace function public.is_guest()
returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

revoke all on function public.is_guest() from public;
grant execute on function public.is_guest() to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "profiles: read published or own" on public.profiles;
create policy "profiles: read published or own" on public.profiles
  for select using (visibility <> 'private' or (select auth.uid()) = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check ((select auth.uid()) = id and not (select public.is_guest()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "profiles: delete own" on public.profiles;
create policy "profiles: delete own" on public.profiles
  for delete using ((select auth.uid()) = id);

create or replace function public.handle_available(candidate text)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.profiles
    where handle = lower(candidate) and id is distinct from auth.uid()
  );
$$;

revoke all on function public.handle_available(text) from public;
grant execute on function public.handle_available(text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars: insert own folder" on storage.objects;
create policy "avatars: insert own folder" on storage.objects
  for insert with check (bucket_id = 'avatars' and not (select public.is_guest()) and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: update own folder" on storage.objects;
create policy "avatars: update own folder" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: delete own folder" on storage.objects;
create policy "avatars: delete own folder" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
