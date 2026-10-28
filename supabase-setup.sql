-- StageMatch: schema for a new, empty Supabase database only.
-- Do not run on an existing project until its schema and data have been reviewed.
-- This project uses profiles.role (student/employer/admin), not store products/orders.

create extension if not exists pgcrypto;

-- One profile per Auth user. Role is changed only by a trusted administrator in SQL Editor.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  role text not null default 'student' check (role in ('student', 'employer', 'admin')),
  created_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 4 and 160),
  company_name text not null,
  city text not null,
  specialty text not null,
  description text not null,
  skills text[] not null default '{}',
  period text not null default '',
  duration text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  cover_letter text check (cover_letter is null or length(cover_letter) <= 5000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (offer_id, student_id)
);

-- New Auth users receive a student profile. Metadata is limited to display names.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Read the current user's role without exposing role changes to browser code.
create function public.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles as p where p.id = auth.uid()
$$;
revoke all on function public.current_role() from public, anon, authenticated;
grant execute on function public.current_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.offers enable row level security;
alter table public.applications enable row level security;

revoke all on public.profiles, public.offers, public.applications from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name) on public.profiles to authenticated;
grant select on public.offers to anon, authenticated;
grant insert on public.offers to authenticated;
grant update (title, company_name, city, specialty, description, skills, period, duration, is_published) on public.offers to authenticated;
grant select, insert on public.applications to authenticated;
grant update (status) on public.applications to authenticated;

create policy profile_read on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.current_role() = 'admin'
    or exists (
      select 1 from public.applications as a
      join public.offers as o on o.id = a.offer_id
      where a.student_id = profiles.id and o.owner_id = auth.uid()
    )
  );
create policy profile_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy offer_read on public.offers
  for select to anon, authenticated
  using (is_published or owner_id = auth.uid() or public.current_role() = 'admin');
create policy offer_add on public.offers
  for insert to authenticated
  with check (owner_id = auth.uid() and public.current_role() in ('employer', 'admin'));
create policy offer_edit on public.offers
  for update to authenticated
  using (public.current_role() = 'admin' or (owner_id = auth.uid() and public.current_role() = 'employer'))
  with check (public.current_role() = 'admin' or (owner_id = auth.uid() and public.current_role() = 'employer'));
-- Offers are unpublished instead of deleted so their application history is preserved.

create policy applications_read on public.applications
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.current_role() = 'admin'
    or exists (select 1 from public.offers as o where o.id = offer_id and o.owner_id = auth.uid())
  );
create policy applications_add on public.applications
  for insert to authenticated
  with check (
    student_id = auth.uid()
    and public.current_role() = 'student'
    and status = 'new'
    and exists (select 1 from public.offers as o where o.id = offer_id and o.is_published)
  );
create policy applications_status on public.applications
  for update to authenticated
  using (
    public.current_role() = 'admin'
    or exists (select 1 from public.offers as o where o.id = offer_id and o.owner_id = auth.uid())
  )
  with check (
    public.current_role() = 'admin'
    or exists (select 1 from public.offers as o where o.id = offer_id and o.owner_id = auth.uid())
  );

create index offers_owner_created on public.offers (owner_id, created_at desc);
create index offers_published_created on public.offers (created_at desc) where is_published;
create index applications_student_created on public.applications (student_id, created_at desc);
create index applications_offer_created on public.applications (offer_id, created_at desc);

-- No fictitious offers are inserted as live records.
