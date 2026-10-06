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
  image       text not null,
  width       integer not null,
  height      integer not null,
  taken_on    date not null default current_date,
  url         text,
  tags        text[] not null default '{}',
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint gallery_kind        check (kind in ('photo', 'ui')),
  constraint gallery_title_len   check (char_length(title) between 1 and 80),
  constraint gallery_caption_len check (char_length(caption) <= 600),
  constraint gallery_image       check (image ~ '^[0-9a-f-]{36}/[a-z0-9-]{1,60}\.webp$'),
  constraint gallery_size        check (width between 1 and 10000 and height between 1 and 10000),
  constraint gallery_url         check (url is null or (char_length(url) <= 300 and url ~ '^https?://[^[:space:]<>"''`]+$')),
  constraint gallery_tags        check (public.gallery_tags_ok(tags))
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
values ('gallery', 'gallery', true, 3145728, array['image/webp'])
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
