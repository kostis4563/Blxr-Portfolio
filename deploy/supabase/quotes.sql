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


create table if not exists public.quotes (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null,
  body         text not null,
  author       text not null default 'Blxr',
  explanation  text not null default '',
  featured     boolean not null default false,
  published    boolean not null default true,
  added_on     date not null default current_date,
  edited_on    date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint quotes_slug_unique     unique (slug),
  constraint quotes_slug            check (char_length(slug) <= 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint quotes_body_len        check (char_length(body) between 1 and 300),
  constraint quotes_author_len      check (char_length(author) between 1 and 60),
  constraint quotes_explanation_len check (char_length(explanation) <= 4000),
  constraint quotes_dates           check (edited_on is null or edited_on >= added_on)
);

create unique index if not exists quotes_one_featured on public.quotes (featured) where featured;
create index if not exists quotes_added on public.quotes (added_on desc);

create or replace function public.quotes_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists quotes_touch on public.quotes;
create trigger quotes_touch before update on public.quotes
  for each row execute function public.quotes_touch();

create or replace function public.quotes_single_featured()
returns trigger language plpgsql as $$
begin
  update public.quotes set featured = false where featured and id <> new.id;
  return new;
end $$;

drop trigger if exists quotes_single_featured on public.quotes;
create trigger quotes_single_featured before insert or update of featured on public.quotes
  for each row when (new.featured) execute function public.quotes_single_featured();

alter table public.quotes enable row level security;

grant select on public.quotes to anon, authenticated;
grant insert, update, delete on public.quotes to authenticated;

drop policy if exists "quotes: read published" on public.quotes;
create policy "quotes: read published" on public.quotes
  for select to anon, authenticated using (published);

drop policy if exists "quotes: owner reads all" on public.quotes;
create policy "quotes: owner reads all" on public.quotes
  for select to authenticated using ((select public.is_site_owner()));

drop policy if exists "quotes: owner inserts" on public.quotes;
create policy "quotes: owner inserts" on public.quotes
  for insert to authenticated with check ((select public.is_site_owner()));

drop policy if exists "quotes: owner updates" on public.quotes;
create policy "quotes: owner updates" on public.quotes
  for update to authenticated
  using ((select public.is_site_owner()))
  with check ((select public.is_site_owner()));

drop policy if exists "quotes: owner deletes" on public.quotes;
create policy "quotes: owner deletes" on public.quotes
  for delete to authenticated using ((select public.is_site_owner()));


insert into public.quotes (slug, body, author, featured, added_on)
values ('true-heroes-never-run', 'True heroes never run.', 'Blxr', true, '2026-10-13')
on conflict (slug) do nothing;
