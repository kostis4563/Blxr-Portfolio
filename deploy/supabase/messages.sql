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

create table if not exists public.threads (
  id              uuid primary key default gen_random_uuid(),
  member          uuid not null unique references auth.users (id) on delete cascade,
  member_seen_at  timestamptz not null default now(),
  owner_seen_at   timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.threads (id) on delete cascade,
  author      uuid not null references auth.users (id) on delete cascade,
  from_owner  boolean not null default false,
  body        text not null default '',
  files       jsonb not null default '[]'::jsonb,
  reply_to    uuid references public.messages (id) on delete set null,
  reactions   jsonb not null default '{}'::jsonb,
  edited_at   timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint messages_body_len       check (char_length(body) <= 4000),
  constraint messages_files_shape    check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 6),
  constraint messages_reactions_shape check (jsonb_typeof(reactions) = 'object'),
  constraint messages_has_content    check (deleted_at is not null or char_length(btrim(body)) > 0 or jsonb_array_length(files) > 0)
);

create index if not exists messages_thread_idx on public.messages (thread_id, created_at);
create index if not exists messages_thread_updated_idx on public.messages (thread_id, updated_at);

create or replace function public.threads_stamp()
returns trigger
language plpgsql as $$
begin
  new.member = old.member;
  new.created_at = old.created_at;
  if public.is_site_owner() then
    new.member_seen_at = old.member_seen_at;
  else
    new.owner_seen_at = old.owner_seen_at;
  end if;
  return new;
end $$;

drop trigger if exists threads_stamp on public.threads;
create trigger threads_stamp before update on public.threads
  for each row execute function public.threads_stamp();

create or replace function public.messages_stamp()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  thread_member uuid;
  emoji text;
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  if tg_op = 'INSERT' then
    select member into thread_member from public.threads where id = new.thread_id;
    if thread_member is null then
      raise exception 'no such conversation';
    end if;
    if thread_member <> auth.uid() and not public.is_site_owner() then
      raise exception 'that conversation is not yours';
    end if;
    new.author = auth.uid();
    new.from_owner = public.is_site_owner();
    new.reactions = '{}'::jsonb;
    new.edited_at = null;
    new.deleted_at = null;
    new.created_at = now();
    new.updated_at = now();
    if new.reply_to is not null and not exists (
      select 1 from public.messages where id = new.reply_to and thread_id = new.thread_id
    ) then
      new.reply_to = null;
    end if;
    update public.threads set updated_at = now() where id = new.thread_id;
  else
    new.thread_id = old.thread_id;
    new.author = old.author;
    new.from_owner = old.from_owner;
    new.reply_to = old.reply_to;
    new.created_at = old.created_at;
    new.updated_at = now();
    if old.deleted_at is not null then
      raise exception 'that message was unsent';
    end if;
    if old.author <> auth.uid() then
      if new.body is distinct from old.body or new.files is distinct from old.files or new.deleted_at is not null then
        raise exception 'only the sender can change a message';
      end if;
      new.edited_at = old.edited_at;
    elsif new.deleted_at is not null then
      new.deleted_at = now();
      new.body = '';
      new.files = '[]'::jsonb;
      new.reactions = '{}'::jsonb;
    elsif new.body is distinct from old.body or new.files is distinct from old.files then
      new.edited_at = now();
    else
      new.edited_at = old.edited_at;
    end if;
  end if;

  if (select count(*) from jsonb_object_keys(new.reactions)) > 8 then
    raise exception 'too many reactions';
  end if;
  for emoji in select jsonb_object_keys(new.reactions) loop
    if char_length(emoji) > 8 or jsonb_typeof(new.reactions -> emoji) <> 'array' or jsonb_array_length(new.reactions -> emoji) > 2 then
      raise exception 'malformed reaction';
    end if;
  end loop;

  return new;
end $$;

drop trigger if exists messages_stamp on public.messages;
create trigger messages_stamp before insert or update on public.messages
  for each row execute function public.messages_stamp();

alter table public.threads enable row level security;
alter table public.messages enable row level security;

drop policy if exists "threads: own or owner" on public.threads;
create policy "threads: own or owner" on public.threads
  for select using (member = auth.uid() or public.is_site_owner());

drop policy if exists "threads: open own" on public.threads;
create policy "threads: open own" on public.threads
  for insert with check (member = auth.uid());

drop policy if exists "threads: mark own" on public.threads;
create policy "threads: mark own" on public.threads
  for update using (member = auth.uid() or public.is_site_owner())
  with check (member = auth.uid() or public.is_site_owner());

drop policy if exists "threads: clear own" on public.threads;
create policy "threads: clear own" on public.threads
  for delete using (member = auth.uid() or public.is_site_owner());

drop policy if exists "messages: read own thread" on public.messages;
create policy "messages: read own thread" on public.messages
  for select using (exists (
    select 1 from public.threads t where t.id = thread_id and (t.member = auth.uid() or public.is_site_owner())
  ));

drop policy if exists "messages: send in own thread" on public.messages;
create policy "messages: send in own thread" on public.messages
  for insert with check (author = auth.uid() and exists (
    select 1 from public.threads t where t.id = thread_id and (t.member = auth.uid() or public.is_site_owner())
  ));

drop policy if exists "messages: change in own thread" on public.messages;
create policy "messages: change in own thread" on public.messages
  for update using (exists (
    select 1 from public.threads t where t.id = thread_id and (t.member = auth.uid() or public.is_site_owner())
  ));

create or replace function public.messages_open()
returns public.threads
language plpgsql as $$
declare
  held public.threads;
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  if public.is_site_owner() then
    raise exception 'the owner reads the inbox instead';
  end if;
  insert into public.threads (member) values (auth.uid()) on conflict (member) do nothing;
  select * into held from public.threads where member = auth.uid();
  return held;
end $$;

create or replace function public.messages_owner()
returns table (name text, avatar text, handle text)
language sql stable security definer set search_path = public as $$
  select
    coalesce(
      p.display_name,
      u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'user_name',
      split_part(u.email, '@', 1)
    ) as name,
    coalesce(p.avatar_url, u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') as avatar,
    p.handle
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(u.email) = 'kostisnomikos@gmail.com'
  limit 1;
$$;

create or replace function public.messages_inbox()
returns table (
  id uuid, member uuid, member_seen_at timestamptz, owner_seen_at timestamptz, created_at timestamptz, updated_at timestamptz,
  name text, email text, avatar text, handle text, provider text, joined timestamptz,
  last_body text, last_at timestamptz, last_from_owner boolean, last_files integer,
  unread integer
)
language sql stable security definer set search_path = public as $$
  select
    t.id, t.member, t.member_seen_at, t.owner_seen_at, t.created_at, t.updated_at,
    coalesce(
      p.display_name,
      u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'user_name',
      split_part(u.email, '@', 1)
    ) as name,
    u.email::text as email,
    coalesce(p.avatar_url, u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') as avatar,
    p.handle,
    coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider,
    u.created_at as joined,
    last.body as last_body, last.created_at as last_at, last.from_owner as last_from_owner, last.files as last_files,
    (
      select count(*)::integer from public.messages m
      where m.thread_id = t.id and not m.from_owner and m.deleted_at is null and m.created_at > t.owner_seen_at
    ) as unread
  from public.threads t
  join auth.users u on u.id = t.member
  left join public.profiles p on p.id = t.member
  left join lateral (
    select m.body, m.created_at, m.from_owner, jsonb_array_length(m.files)::integer as files
    from public.messages m
    where m.thread_id = t.id and m.deleted_at is null
    order by m.created_at desc
    limit 1
  ) last on true
  where public.is_site_owner()
  order by t.updated_at desc;
$$;

create or replace function public.messages_unread()
returns integer
language sql stable as $$
  select coalesce(sum(
    (select count(*) from public.messages m
     where m.thread_id = t.id and m.deleted_at is null
       and m.from_owner <> public.is_site_owner()
       and m.created_at > case when public.is_site_owner() then t.owner_seen_at else t.member_seen_at end)
  ), 0)::integer
  from public.threads t;
$$;

create or replace function public.messages_seen(thread uuid)
returns void
language sql as $$
  update public.threads set
    owner_seen_at  = case when public.is_site_owner() then now() else owner_seen_at end,
    member_seen_at = case when public.is_site_owner() then member_seen_at else now() end
  where id = thread;
$$;

revoke all on function public.messages_open() from public;
revoke all on function public.messages_owner() from public;
revoke all on function public.messages_inbox() from public;
revoke all on function public.messages_unread() from public;
revoke all on function public.messages_seen(uuid) from public;
grant execute on function public.messages_open() to authenticated;
grant execute on function public.messages_owner() to authenticated;
grant execute on function public.messages_inbox() to authenticated;
grant execute on function public.messages_unread() to authenticated;
grant execute on function public.messages_seen(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'threads'
    ) then
      alter publication supabase_realtime add table public.threads;
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('realtime.messages') is null or to_regprocedure('realtime.topic()') is null then
    return;
  end if;

  execute 'drop policy if exists "messages: listen on own channels" on realtime.messages';
  execute $p$
    create policy "messages: listen on own channels" on realtime.messages
      for select to authenticated using (
        realtime.topic() = 'messages:lobby'
        or exists (
          select 1 from public.threads t
          where realtime.topic() = 'thread:' || t.id::text and (t.member = auth.uid() or public.is_site_owner())
        )
      )
  $p$;

  execute 'drop policy if exists "messages: speak on own channels" on realtime.messages';
  execute $p$
    create policy "messages: speak on own channels" on realtime.messages
      for insert to authenticated with check (
        (realtime.topic() = 'messages:lobby' and public.is_site_owner())
        or exists (
          select 1 from public.threads t
          where realtime.topic() = 'thread:' || t.id::text and (t.member = auth.uid() or public.is_site_owner())
        )
      )
  $p$;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('messages', 'messages', false, 4194304, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "messages: read own thread files" on storage.objects;
create policy "messages: read own thread files" on storage.objects
  for select using (bucket_id = 'messages' and exists (
    select 1 from public.threads t
    where t.id::text = (storage.foldername(name))[1] and (t.member = auth.uid() or public.is_site_owner())
  ));

drop policy if exists "messages: add own thread files" on storage.objects;
create policy "messages: add own thread files" on storage.objects
  for insert with check (bucket_id = 'messages' and exists (
    select 1 from public.threads t
    where t.id::text = (storage.foldername(name))[1] and (t.member = auth.uid() or public.is_site_owner())
  ));

drop policy if exists "messages: remove own thread files" on storage.objects;
create policy "messages: remove own thread files" on storage.objects
  for delete using (bucket_id = 'messages' and exists (
    select 1 from public.threads t
    where t.id::text = (storage.foldername(name))[1] and (t.member = auth.uid() or public.is_site_owner())
  ));
