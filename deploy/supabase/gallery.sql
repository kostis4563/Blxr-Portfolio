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
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'kostisnomikos@gmail.com'
     and public.mfa_satisfied();
$$;

revoke all on function public.is_site_owner() from public;
grant execute on function public.is_site_owner() to authenticated;

create or replace function public.gallery_tags_ok(tags text[])
returns boolean
language sql immutable as $$
  select coalesce(array_length(tags, 1), 0) <= 6
     and not exists (select 1 from unnest(tags) t where t is null or char_length(t) not between 1 and 24);
$$;R


create table if not exists public.gallery_items (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'photo',
  title       text not null,
  caption     text not null default '',
  image       text,
  width       integer,
  height      integer,
  live        jsonb,
  poster      text,
  taken_on    date not null default current_date,
  url         text,
  tags        text[] not null default '{}',
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint gallery_kind        check (kind in ('photo', 'ui')),
  constraint gallery_title_len   check (char_length(title) between 1 and 80),
  constraint gallery_caption_len check (char_length(caption) <= 600),
  constraint gallery_size        check (width between 1 and 10000 and height between 1 and 10000),
  constraint gallery_url         check (url is null or (char_length(url) <= 300 and url ~ '^https?://[^[:space:]<>"''`]+$')),
  constraint gallery_tags        check (public.gallery_tags_ok(tags))
);

alter table public.gallery_items add column if not exists live jsonb;
alter table public.gallery_items add column if not exists poster text;

alter table public.gallery_items add column if not exists position integer not null default 0;
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'gallery_items' and column_name = 'wide'
  ) then
    alter table public.gallery_items add column wide boolean not null default false;
    update public.gallery_items set wide = true where live ->> 'type' in ('contour', 'marquee', 'logos');
  end if;
end $$;

alter table public.gallery_items drop constraint if exists gallery_image;
alter table public.gallery_items add constraint gallery_image check (
  image ~ '^([0-9a-f-]{36}|/photos)/[a-z0-9-]{1,60}\.(webp|mp4|webm|mov)$'
);
alter table public.gallery_items drop constraint if exists gallery_poster;
alter table public.gallery_items add constraint gallery_poster check (
  poster is null or (image ~ '\.(mp4|webm|mov)$' and poster ~ '^([0-9a-f-]{36}|/photos)/[a-z0-9-]{1,60}\.webp$')
);
alter table public.gallery_items
  alter column image drop not null,
  alter column width drop not null,
  alter column height drop not null;

alter table public.gallery_items drop constraint if exists gallery_shape;
alter table public.gallery_items add constraint gallery_shape check (
  (live is null and image is not null and width is not null and height is not null)
  or (live is not null and kind = 'ui' and image is null)
);

delete from public.gallery_items where live ->> 'type' in ('ocean', 'tilt', 'wave');

alter table public.gallery_items drop constraint if exists gallery_live;
alter table public.gallery_items add constraint gallery_live check (
  live is null or (
    jsonb_typeof(live) = 'object'
    and live ->> 'type' in ('select', 'inspect', 'comment', 'scramble', 'html', 'comet', 'contour', 'loop', 'glow', 'music', 'marquee', 'calendar', 'logos', 'avatars')
    and jsonb_typeof(live -> 'props') = 'object'
    and octet_length(live::text) <= 50000
  )
);

create index if not exists gallery_items_taken on public.gallery_items (taken_on desc, created_at desc);

create or replace function public.gallery_reorder(ids uuid[])
returns void
language sql security invoker set search_path = public as $$
  update public.gallery_items g
     set position = o.n
    from unnest(ids) with ordinality as o(id, n)
   where g.id = o.id and g.position is distinct from o.n;
$$;

revoke all on function public.gallery_reorder(uuid[]) from public;
grant execute on function public.gallery_reorder(uuid[]) to authenticated;

create or replace function public.gallery_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists gallery_touch on public.gallery_items;
create trigger gallery_touch before update on public.gallery_items
  for each row execute function public.gallery_touch();

alter table public.gallery_items enable row level security;

grant select on public.gallery_items to anon, authenticated;
grant insert, update, delete on public.gallery_items to authenticated;

drop policy if exists "gallery: read published" on public.gallery_items;
create policy "gallery: read published" on public.gallery_items
  for select to anon, authenticated using (published);

drop policy if exists "gallery: owner reads all" on public.gallery_items;
create policy "gallery: owner reads all" on public.gallery_items
  for select to authenticated using ((select public.is_site_owner()));

drop policy if exists "gallery: owner inserts" on public.gallery_items;
create policy "gallery: owner inserts" on public.gallery_items
  for insert to authenticated with check ((select public.is_site_owner()));

drop policy if exists "gallery: owner updates" on public.gallery_items;
create policy "gallery: owner updates" on public.gallery_items
  for update to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));

drop policy if exists "gallery: owner deletes" on public.gallery_items;
create policy "gallery: owner deletes" on public.gallery_items
  for delete to authenticated using ((select public.is_site_owner()));


insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 52428800, array['image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "gallery: public images" on storage.objects;
create policy "gallery: public images" on storage.objects
  for select using (bucket_id = 'gallery');

drop policy if exists "gallery: owner uploads" on storage.objects;
create policy "gallery: owner uploads" on storage.objects
  for insert to authenticated with check (bucket_id = 'gallery' and (select public.is_site_owner()));

drop policy if exists "gallery: owner replaces" on storage.objects;
create policy "gallery: owner replaces" on storage.objects
  for update to authenticated using (bucket_id = 'gallery' and (select public.is_site_owner()));

drop policy if exists "gallery: owner removes" on storage.objects;
create policy "gallery: owner removes" on storage.objects
  for delete to authenticated using (bucket_id = 'gallery' and (select public.is_site_owner()));


insert into public.gallery_items (id, kind, title, caption, live) values
  ('0a11ce00-0000-4000-8000-000000000001', 'ui', 'Live selection',
   'A Figma selection drawn over the hero text, cursor and all.',
   '{"type":"select","props":{"lead":"I build","text":"the whole thing","tail":".","name":"Kostis"}}'),
  ('0a11ce00-0000-4000-8000-000000000002', 'ui', 'Inspect',
   'Hover to measure it, the way Figma does.',
   '{"type":"inspect","props":{"text":""}}'),
  ('0a11ce00-0000-4000-8000-000000000003', 'ui', 'Comment pin',
   'Hover or tap the pin to read the comment.',
   '{"type":"comment","props":{"name":"Client","text":"Can you build ours on this?","time":"2m"}}')
on conflict (id) do nothing;

insert into public.gallery_items (id, kind, title, caption, live, wide) values
  ('0a11ce00-0000-4000-8000-000000000005', 'ui', 'Comet border',
   'From the async hero. A lit trail rides the edge of the video frame.',
   '{"type":"comet","props":{"title":"async","sub":"hero.mp4 · 00:42"}}', false),
  ('0a11ce00-0000-4000-8000-000000000006', 'ui', 'Contour field',
   'From Amitista Studio. Marching squares over a drifting height map.',
   '{"type":"contour","props":{}}', true),
  ('0a11ce00-0000-4000-8000-000000000007', 'ui', 'Word loop',
   'From the Fresh Finds hero. Floating paths behind a word that folds and swaps.',
   '{"type":"loop","props":{"lead":"Make it","words":"fast, reliable, secure, automated, instant"}}', false),
  ('0a11ce00-0000-4000-8000-000000000008', 'ui', 'Hover border',
   'From 7x0.site. Hover or focus the button to spin the border.',
   '{"type":"glow","props":{"text":"Scan a file"}}', false),
  ('0a11ce00-0000-4000-8000-00000000000b', 'ui', 'Music pill',
   'From Wizzard. Press play and it opens up to an equaliser and a volume slider.',
   '{"type":"music","props":{"label":"Music"}}', false),
  ('0a11ce00-0000-4000-8000-00000000000c', 'ui', 'Marquee',
   'From the Design x partners strip. Two rows slide opposite ways; hover to stop them.',
   '{"type":"marquee","props":{"items":"React, Vite, Tailwind, Supabase, Figma, WebGL, Node, Bun, Next.js, Postgres"}}', true),
  ('0a11ce00-0000-4000-8000-00000000000d', 'ui', 'Range calendar',
   'Pick a start and an end. The band follows the pointer until the second click.',
   '{"type":"calendar","props":{}}', false),
  ('0a11ce00-0000-4000-8000-00000000000e', 'ui', 'Logo wall',
   'A partners grid with a plus on every inner corner. Hover a logo to light it up.',
   '{"type":"logos","props":{"lead":"Companies we","bold":"collaborate","tail":"with.","names":"NVIDIA, Supabase, GitHub, OpenAI, Turso, Clerk, Claude, Vercel"}}', true),
  ('0a11ce00-0000-4000-8000-00000000000f', 'ui', 'Avatar stack',
   'Faces that overlap until you hover, then spread out and say who they are.',
   '{"type":"avatars","props":{"more":"99"}}', false)
on conflict (id) do nothing;

insert into public.gallery_items (id, kind, title, caption, image, poster, width, height, taken_on) values
  ('0a11ce00-0000-4000-8000-000000000101', 'photo', 'Sunset over the islands',
   'The sun going down behind the hills, its light breaking up on the water.',
   '/photos/sunset-over-the-islands-10c16923.webp', null, 1500, 2000, '2026-10-06'),
  ('0a11ce00-0000-4000-8000-000000000102', 'photo', 'Firs under a storm sky',
   'A wall of firs, with the clouds closing in on the last bit of blue.',
   '/photos/firs-under-a-storm-sky-14278955.webp', null, 1500, 2000, '2026-10-06'),
  ('0a11ce00-0000-4000-8000-000000000103', 'photo', 'Road under the trees',
   'A dirt road running under the branches, leaves already on the ground.',
   '/photos/road-under-the-trees-37f48fd6.webp', null, 1500, 2000, '2026-10-06'),
  ('0a11ce00-0000-4000-8000-000000000104', 'photo', 'Golden hour ride',
   'Down an empty road with the sun low over the sea.',
   '/photos/golden-hour-ride-e17fedd6.mp4', '/photos/golden-hour-ride-poster-0afaa5a2.webp', 360, 640, '2026-10-06')
on conflict (id) do nothing;
