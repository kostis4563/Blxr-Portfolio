
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

create or replace function public.is_board_admin()
returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'kostisnomikos@gmail.com'
     and public.mfa_satisfied();
$$;

revoke all on function public.is_board_admin() from public;
grant execute on function public.is_board_admin() to authenticated;

create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  note        text not null default '',
  colour      text not null default 'violet',
  purpose     text not null default 'personal',
  facts       jsonb not null default '{}'::jsonb,
  lists       jsonb not null default '[]'::jsonb,
  labels      jsonb not null default '[]'::jsonb,
  remind      jsonb not null default '{}'::jsonb,
  art         jsonb not null default '{}'::jsonb,
  archived    boolean not null default false,
  seq         integer not null default 0,
  rev         integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint boards_name_len    check (char_length(name) between 1 and 60),
  constraint boards_note_len    check (char_length(note) <= 240),
  constraint boards_colour      check (colour in ('violet', 'blue', 'teal', 'green', 'amber', 'rose', 'ink')),
  constraint boards_purpose     check (purpose in ('personal', 'server', 'client', 'bot', 'site', 'studio')),
  constraint boards_facts_shape check (jsonb_typeof(facts) = 'object'),
  constraint boards_lists_shape check (jsonb_typeof(lists) = 'array' and jsonb_array_length(lists) <= 12),
  constraint boards_labels_shape check (jsonb_typeof(labels) = 'array' and jsonb_array_length(labels) <= 12),
  constraint boards_art_shape   check (jsonb_typeof(art) = 'object'),
  constraint boards_remind_shape check (jsonb_typeof(remind) = 'object')
);

create index if not exists boards_owner_idx on public.boards (owner, archived);

create table if not exists public.board_cards (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards (id) on delete cascade,
  owner       uuid not null references auth.users (id) on delete cascade,
  seq         integer not null default 0,
  list_id     text not null,
  position    double precision not null default 0,
  title       text not null,
  notes       text not null default '',
  done        boolean not null default false,
  archived    boolean not null default false,
  due         timestamptz,
  labels      text[] not null default '{}',
  checklist   jsonb not null default '[]'::jsonb,
  comments    jsonb not null default '[]'::jsonb,
  links       jsonb not null default '[]'::jsonb,
  files       jsonb not null default '[]'::jsonb,
  activity    jsonb not null default '[]'::jsonb,
  deleted_at  timestamptz,
  completed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint cards_title_len     check (char_length(title) between 1 and 140),
  constraint cards_notes_len     check (char_length(notes) <= 2000),
  constraint cards_list_len      check (char_length(list_id) between 1 and 40),
  constraint cards_labels_len    check (coalesce(array_length(labels, 1), 0) <= 12),
  constraint cards_checklist_shape check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 40),
  constraint cards_comments_shape check (jsonb_typeof(comments) = 'array' and jsonb_array_length(comments) <= 120),
  constraint cards_links_shape   check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 12),
  constraint cards_files_shape   check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 10),
  constraint cards_activity_shape check (jsonb_typeof(activity) = 'array' and jsonb_array_length(activity) <= 40)
);

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

create or replace function public.card_links_ok(links jsonb)
returns boolean
language sql immutable as $$
  select case when jsonb_typeof(links) = 'array' then
     jsonb_array_length(links) <= 12
     and not exists (
       select 1 from jsonb_array_elements(links) l
       where jsonb_typeof(l) <> 'object'
          or not public.http_url_ok(l ->> 'url', 400)
          or jsonb_typeof(l -> 'id') <> 'string' or char_length(l ->> 'id') not between 1 and 32
          or (l ? 'label' and (jsonb_typeof(l -> 'label') <> 'string' or char_length(l ->> 'label') > 60))
     )
  else false end;
$$;

create or replace function public.board_path_ok(candidate text, board uuid)
returns boolean
language sql immutable as $$
  select candidate is not null
     and char_length(candidate) <= 300
     and candidate ~ ('^[0-9a-f-]{36}/' || board::text || '/[A-Za-z0-9/_.-]+$');
$$;

create or replace function public.card_files_ok(files jsonb, board uuid)
returns boolean
language sql immutable as $$
  select case when jsonb_typeof(files) = 'array' then
     jsonb_array_length(files) <= 10
     and not exists (
       select 1 from jsonb_array_elements(files) f
       where jsonb_typeof(f) <> 'object'
          or jsonb_typeof(f -> 'id') <> 'string' or char_length(f ->> 'id') not between 1 and 32
          or jsonb_typeof(f -> 'name') <> 'string' or char_length(f ->> 'name') not between 1 and 200
          or jsonb_typeof(f -> 'type') <> 'string' or (f ->> 'type') not in ('image/webp', 'image/jpeg', 'image/png', 'image/gif', 'application/pdf')
          or jsonb_typeof(f -> 'path') <> 'string' or not public.board_path_ok(f ->> 'path', board)
          or (jsonb_typeof(f -> 'thumb') = 'string' and not public.board_path_ok(f ->> 'thumb', board))
     )
  else false end;
$$;

create or replace function public.card_checklist_ok(checklist jsonb)
returns boolean
language sql immutable as $$
  select case when jsonb_typeof(checklist) = 'array' then
     jsonb_array_length(checklist) <= 40
     and not exists (
       select 1 from jsonb_array_elements(checklist) c
       where jsonb_typeof(c) <> 'object'
          or jsonb_typeof(c -> 'id') <> 'string' or char_length(c ->> 'id') not between 1 and 32
          or jsonb_typeof(c -> 'text') <> 'string' or char_length(c ->> 'text') not between 1 and 200
          or (c ? 'done' and jsonb_typeof(c -> 'done') <> 'boolean')
     )
  else false end;
$$;

create or replace function public.card_comments_ok(comments jsonb)
returns boolean
language sql immutable as $$
  select case when jsonb_typeof(comments) = 'array' then
     jsonb_array_length(comments) <= 120
     and not exists (
       select 1 from jsonb_array_elements(comments) c
       where jsonb_typeof(c) <> 'object'
          or jsonb_typeof(c -> 'id') <> 'string' or char_length(c ->> 'id') not between 1 and 32
          or jsonb_typeof(c -> 'body') <> 'string' or char_length(c ->> 'body') not between 1 and 1000
     )
  else false end;
$$;

create or replace function public.board_lists_ok(lists jsonb)
returns boolean
language sql immutable as $$
  select case when jsonb_typeof(lists) = 'array' then
     jsonb_array_length(lists) <= 12
     and not exists (
       select 1 from jsonb_array_elements(lists) l
       where jsonb_typeof(l) <> 'object'
          or jsonb_typeof(l -> 'id') <> 'string' or char_length(l ->> 'id') not between 1 and 40
          or (l ? 'name' and (jsonb_typeof(l -> 'name') <> 'string' or char_length(l ->> 'name') > 32))
     )
  else false end;
$$;

create or replace function public.board_art_ok(art jsonb, board uuid)
returns boolean
language sql immutable as $$
  select case when jsonb_typeof(art) = 'object' then not exists (
       select 1 from jsonb_each(art) e
       where jsonb_typeof(e.value) <> 'object'
          or jsonb_typeof(e.value -> 'path') <> 'string'
          or not public.board_path_ok(e.value ->> 'path', board)
     ) else false end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cards_links_ok') then
    alter table public.board_cards
      add constraint cards_links_ok     check (public.card_links_ok(links)) not valid,
      add constraint cards_files_ok     check (public.card_files_ok(files, board_id)) not valid,
      add constraint cards_checklist_ok check (public.card_checklist_ok(checklist)) not valid,
      add constraint cards_comments_ok  check (public.card_comments_ok(comments)) not valid,
      add constraint cards_labels_shape check (public.text_items_ok(labels, 40)) not valid;
    alter table public.boards
      add constraint boards_lists_ok check (public.board_lists_ok(lists)) not valid,
      add constraint boards_art_ok   check (public.board_art_ok(art, id)) not valid;
  end if;
end $$;

create index if not exists board_cards_board_idx on public.board_cards (board_id, list_id, position);
create index if not exists board_cards_owner_idx on public.board_cards (owner);
create index if not exists board_cards_bin_idx on public.board_cards (deleted_at) where deleted_at is not null;

create index if not exists board_cards_live_idx on public.board_cards (board_id, position)
  include (owner, archived, done, due)
  where deleted_at is null;

drop index if exists public.board_cards_due_idx;
create index if not exists board_cards_agenda_idx on public.board_cards (due)
  include (owner)
  where due is not null and not done and not archived and deleted_at is null;

create or replace function public.boards_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.rev = coalesce(old.rev, 0) + 1;
  return new;
end $$;

drop trigger if exists boards_touch on public.boards;
create trigger boards_touch before update on public.boards
  for each row execute function public.boards_touch();

create or replace function public.board_cards_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  next_seq integer;
  board_owner uuid;
begin
  if tg_op = 'INSERT' then
    select owner into board_owner from public.boards where id = new.board_id;
    if board_owner is null then
      raise exception 'no such board';
    end if;
    if board_owner <> auth.uid() and not public.is_board_admin() then
      raise exception 'that board is not yours';
    end if;
    update public.boards set seq = seq + 1 where id = new.board_id returning seq into next_seq;
    new.seq = next_seq;
    new.owner = board_owner;
  else
    new.updated_at = now();
    new.owner = old.owner;
    new.seq = old.seq;
    if new.done and not old.done then
      new.completed_at = now();
    elsif old.done and not new.done then
      new.completed_at = null;
    end if;
    update public.boards set updated_at = now() where id = new.board_id;
  end if;
  return new;
end $$;

drop trigger if exists board_cards_stamp on public.board_cards;
create trigger board_cards_stamp before insert or update on public.board_cards
  for each row execute function public.board_cards_stamp();

alter table public.boards enable row level security;
alter table public.board_cards enable row level security;

drop policy if exists "boards: read own" on public.boards;
create policy "boards: read own" on public.boards
  for select using ((select auth.uid()) = owner or (select public.is_board_admin()));

drop policy if exists "boards: insert own" on public.boards;
create policy "boards: insert own" on public.boards
  for insert with check ((select auth.uid()) = owner);

drop policy if exists "boards: update own" on public.boards;
create policy "boards: update own" on public.boards
  for update using ((select auth.uid()) = owner or (select public.is_board_admin()))
  with check ((select auth.uid()) = owner or (select public.is_board_admin()));

drop policy if exists "boards: delete own" on public.boards;
create policy "boards: delete own" on public.boards
  for delete using ((select auth.uid()) = owner or (select public.is_board_admin()));

drop policy if exists "cards: read own" on public.board_cards;
create policy "cards: read own" on public.board_cards
  for select using ((select auth.uid()) = owner or (select public.is_board_admin()));

drop policy if exists "cards: insert own" on public.board_cards;
create policy "cards: insert own" on public.board_cards
  for insert with check (
    (select public.is_board_admin())
    or exists (select 1 from public.boards b where b.id = board_id and b.owner = (select auth.uid()))
  );

drop policy if exists "cards: update own" on public.board_cards;
create policy "cards: update own" on public.board_cards
  for update using ((select auth.uid()) = owner or (select public.is_board_admin()))
  with check ((select auth.uid()) = owner or (select public.is_board_admin()));

drop policy if exists "cards: delete own" on public.board_cards;
create policy "cards: delete own" on public.board_cards
  for delete using ((select auth.uid()) = owner or (select public.is_board_admin()));

create or replace view public.board_index
with (security_invoker = on) as
select
  b.*,
  coalesce(c.cards, 0)    as count_cards,
  coalesce(c.done, 0)     as count_done,
  coalesce(c.overdue, 0)  as count_overdue,
  coalesce(c.soon, 0)     as count_soon,
  coalesce(c.archived_cards, 0) as count_archived
from public.boards b
left join lateral (
  select
    count(*) filter (where not archived)                                   as cards,
    count(*) filter (where not archived and done)                          as done,
    count(*) filter (where not archived and not done and due < now())      as overdue,
    count(*) filter (where not archived and not done
                       and due >= now() and due < now() + interval '48 hours') as soon,
    count(*) filter (where archived)                                       as archived_cards
  from public.board_cards
  where board_id = b.id and deleted_at is null
) c on true;

grant select on public.board_index to authenticated;

create or replace function public.boards_agenda(horizon interval default interval '14 days')
returns table (
  card_id   uuid,
  board_id  uuid,
  board_name text,
  colour    text,
  title     text,
  due       timestamptz
)
language sql stable as $$
  select c.id, c.board_id, b.name, b.colour, c.title, c.due
    from public.board_cards c
    join public.boards b on b.id = c.board_id
   where c.due is not null
     and not c.done and not c.archived and c.deleted_at is null
     and not b.archived
     and c.due < now() + horizon
   order by c.due
   limit 50;
$$;

grant execute on function public.boards_agenda(interval) to authenticated;

create or replace function public.boards_sweep_bin()
returns void
language sql volatile as $$
  delete from public.board_cards
   where deleted_at is not null
     and deleted_at < now() - interval '24 hours'
     and (owner = auth.uid() or public.is_board_admin());
$$;

grant execute on function public.boards_sweep_bin() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'boards', 'boards', false, 4194304,
  array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "boards: read own files" on storage.objects;
create policy "boards: read own files" on storage.objects
  for select using (
    bucket_id = 'boards'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_board_admin()))
  );

drop policy if exists "boards: insert own files" on storage.objects;
create policy "boards: insert own files" on storage.objects
  for insert with check (
    bucket_id = 'boards'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_board_admin()))
  );

drop policy if exists "boards: update own files" on storage.objects;
create policy "boards: update own files" on storage.objects
  for update using (
    bucket_id = 'boards'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_board_admin()))
  );

drop policy if exists "boards: delete own files" on storage.objects;
create policy "boards: delete own files" on storage.objects
  for delete using (
    bucket_id = 'boards'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_board_admin()))
  );
