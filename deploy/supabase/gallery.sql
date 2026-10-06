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
$$;


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

-- Upgrades a table made before live components existed; harmless on a fresh one.
alter table public.gallery_items add column if not exists live jsonb;
alter table public.gallery_items add column if not exists poster text;

-- `image` holds the uploaded file: a WebP picture or a video. A video also
-- carries a WebP poster frame for thumbnails and the moment before it plays.
alter table public.gallery_items drop constraint if exists gallery_image;
alter table public.gallery_items add constraint gallery_image check (
  image ~ '^[0-9a-f-]{36}/[a-z0-9-]{1,60}\.(webp|mp4|webm|mov)$'
);
alter table public.gallery_items drop constraint if exists gallery_poster;
alter table public.gallery_items add constraint gallery_poster check (
  poster is null or (image ~ '\.(mp4|webm|mov)$' and poster ~ '^[0-9a-f-]{36}/[a-z0-9-]{1,60}\.webp$')
);
alter table public.gallery_items
  alter column image drop not null,
  alter column width drop not null,
  alter column height drop not null;

-- An item is either an uploaded image or a live UI component, never both.
alter table public.gallery_items drop constraint if exists gallery_shape;
alter table public.gallery_items add constraint gallery_shape check (
  (live is null and image is not null and width is not null and height is not null)
  or (live is not null and kind = 'ui' and image is null)
);

alter table public.gallery_items drop constraint if exists gallery_live;
alter table public.gallery_items add constraint gallery_live check (
  live is null or (
    jsonb_typeof(live) = 'object'
    and live ->> 'type' in ('select', 'inspect', 'comment', 'scramble', 'html', 'ocean', 'comet', 'contour', 'loop', 'glow')
    and jsonb_typeof(live -> 'props') = 'object'
    and octet_length(live::text) <= 50000
  )
);

create index if not exists gallery_items_taken on public.gallery_items (taken_on desc, created_at desc);

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
-- 50 MB is the largest single upload on Supabase's free plan. Images are shrunk
-- to WebP under 3 MB in the browser; videos go up as they are.
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


-- The three hero pieces, so the UI tab is not empty. Fixed ids: re-running
-- never duplicates them, but it does bring back one you deleted.
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

-- Pieces lifted from other projects, same deal with the fixed ids.
insert into public.gallery_items (id, kind, title, caption, live) values
  ('0a11ce00-0000-4000-8000-000000000004', 'ui', 'Ocean',
   'From Noizy. Gerstner waves in a three.js shader. Move across it to drag the sun.',
   '{"type":"ocean","props":{}}'),
  ('0a11ce00-0000-4000-8000-000000000005', 'ui', 'Comet border',
   'From the async hero. A lit trail rides the edge of the video frame.',
   '{"type":"comet","props":{"title":"async","sub":"hero.mp4 · 00:42"}}'),
  ('0a11ce00-0000-4000-8000-000000000006', 'ui', 'Contour field',
   'From Amitista Studio. Marching squares over a drifting height map.',
   '{"type":"contour","props":{}}'),
  ('0a11ce00-0000-4000-8000-000000000007', 'ui', 'Word loop',
   'From the Fresh Finds hero. Floating paths behind a word that folds and swaps.',
   '{"type":"loop","props":{"lead":"Make it","words":"fast, reliable, secure, automated, instant"}}'),
  ('0a11ce00-0000-4000-8000-000000000008', 'ui', 'Hover border',
   'From 7x0.site. Hover or focus the button to spin the border.',
   '{"type":"glow","props":{"text":"Scan a file"}}')
on conflict (id) do nothing;
