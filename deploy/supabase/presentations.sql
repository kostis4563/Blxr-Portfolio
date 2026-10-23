create or replace function public.is_guest()
returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

revoke all on function public.is_guest() from public;
grant execute on function public.is_guest() to authenticated;

create or replace function public.presentation_slides_ok(slides jsonb, deck uuid, author uuid)
returns boolean
language sql immutable as $$
  select case when jsonb_typeof(slides) = 'array' then
     jsonb_array_length(slides) between 1 and 100
     and not exists (
       select 1 from jsonb_array_elements(slides) s
       where jsonb_typeof(s) <> 'object'
          or jsonb_typeof(s -> 'id') <> 'string' or char_length(s ->> 'id') not between 1 and 32
          or coalesce(s ->> 'layout', '') not in ('title', 'section', 'bullets', 'columns', 'split', 'image', 'quote', 'stat')
          or (jsonb_typeof(s -> 'notes') = 'string' and char_length(s ->> 'notes') > 4000)
          or (jsonb_typeof(s -> 'image') = 'object'
              and coalesce(s -> 'image' ->> 'path', '') !~ ('^' || author::text || '/' || deck::text || '/[A-Za-z0-9._-]{1,80}$'))
     )
  else false end;
$$;

create table if not exists public.presentations (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default 'Untitled presentation',
  theme       text not null default 'midnight',
  transition  text not null default 'fade',
  numbers     boolean not null default true,
  slides      jsonb not null default '[{"id": "s1", "layout": "title"}]'::jsonb,
  share_token text,
  shared_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint presentations_title_len   check (char_length(title) between 1 and 120),
  constraint presentations_theme       check (theme in ('midnight', 'paper', 'mono', 'aurora', 'forest', 'ocean', 'sunset')),
  constraint presentations_transition  check (transition in ('none', 'fade', 'slide')),
  constraint presentations_slides_size check (octet_length(slides::text) <= 400000),
  constraint presentations_slides_ok   check (public.presentation_slides_ok(slides, id, owner)),
  constraint presentations_token       check (share_token is null or share_token ~ '^[A-Za-z0-9_-]{22,64}$'),
  constraint presentations_token_unique unique (share_token)
);

create index if not exists presentations_owner_idx on public.presentations (owner, updated_at desc);

create or replace function public.presentations_touch()
returns trigger language plpgsql as $$
begin
  new.id = old.id;
  new.owner = old.owner;
  new.created_at = old.created_at;
  new.updated_at = now();
  if new.share_token is distinct from old.share_token then
    new.shared_at = case when new.share_token is null then null else now() end;
  else
    new.shared_at = old.shared_at;
  end if;
  return new;
end $$;

drop trigger if exists presentations_touch on public.presentations;
create trigger presentations_touch before update on public.presentations
  for each row execute function public.presentations_touch();

create or replace function public.presentations_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.presentations where owner = new.owner) >= 200 then
    raise exception 'presentation_limit';
  end if;
  new.shared_at = case when new.share_token is null then null else now() end;
  return new;
end $$;

drop trigger if exists presentations_cap on public.presentations;
create trigger presentations_cap before insert on public.presentations
  for each row execute function public.presentations_cap();

alter table public.presentations enable row level security;

revoke all on public.presentations from anon;
grant select, insert, update, delete on public.presentations to authenticated;

drop policy if exists "presentations: read own" on public.presentations;
create policy "presentations: read own" on public.presentations
  for select to authenticated using ((select auth.uid()) = owner);

drop policy if exists "presentations: insert own" on public.presentations;
create policy "presentations: insert own" on public.presentations
  for insert to authenticated with check ((select auth.uid()) = owner and not (select public.is_guest()));

drop policy if exists "presentations: update own" on public.presentations;
create policy "presentations: update own" on public.presentations
  for update to authenticated
  using ((select auth.uid()) = owner)
  with check ((select auth.uid()) = owner);

drop policy if exists "presentations: delete own" on public.presentations;
create policy "presentations: delete own" on public.presentations
  for delete to authenticated using ((select auth.uid()) = owner);

create or replace function public.shared_presentation(token text)
returns table (
  id         uuid,
  title      text,
  theme      text,
  transition text,
  numbers    boolean,
  slides     jsonb,
  updated_at timestamptz,
  author     text
)
language sql stable security definer set search_path = public as $$
  select p.id, p.title, p.theme, p.transition, p.numbers,
         (select coalesce(jsonb_agg(s - 'notes' order by n), '[]'::jsonb)
            from jsonb_array_elements(p.slides) with ordinality as e(s, n)),
         p.updated_at,
         case when pr.visibility in ('public', 'unlisted') then pr.display_name end
    from public.presentations p
    left join public.profiles pr on pr.id = p.owner
   where token ~ '^[A-Za-z0-9_-]{22,64}$'
     and p.share_token = token
   limit 1;
$$;

revoke all on function public.shared_presentation(text) from public;
grant execute on function public.shared_presentation(text) to anon, authenticated;

create or replace function public.presentation_file_shared(path text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.presentations p
     where p.share_token is not null
       and p.owner::text = split_part(path, '/', 1)
       and p.id::text = split_part(path, '/', 2)
  );
$$;

revoke all on function public.presentation_file_shared(text) from public;
grant execute on function public.presentation_file_shared(text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'presentations', 'presentations', false, 5242880,
  array['image/webp', 'image/jpeg', 'image/png', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "presentations: read own files" on storage.objects;
create policy "presentations: read own files" on storage.objects
  for select using (
    bucket_id = 'presentations'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "presentations: read shared files" on storage.objects;
create policy "presentations: read shared files" on storage.objects
  for select using (
    bucket_id = 'presentations'
    and public.presentation_file_shared(name)
  );

drop policy if exists "presentations: insert own files" on storage.objects;
create policy "presentations: insert own files" on storage.objects
  for insert with check (
    bucket_id = 'presentations'
    and not (select public.is_guest())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "presentations: update own files" on storage.objects;
create policy "presentations: update own files" on storage.objects
  for update using (
    bucket_id = 'presentations'
    and not (select public.is_guest())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "presentations: delete own files" on storage.objects;
create policy "presentations: delete own files" on storage.objects
  for delete using (
    bucket_id = 'presentations'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
