-- StageMatch existing-database migration. Preserves all rows.
begin;
-- Run only after reviewing the schema described in SUPABASE.md.
-- This restores offer privileges/RLS to the StageMatch contract and disables browser-side deletion.

do $$
begin
  if to_regclass('public.offers') is null or to_regclass('public.profiles') is null then
    raise exception 'Expected public.offers and public.profiles. Inspect the current schema before migrating.';
  end if;
  if to_regprocedure('public.current_role()') is null then
    raise exception 'Expected public.current_role(). Inspect the current authorization functions before migrating.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) then
    raise exception 'Expected profiles.role. Inspect the current profile schema before migrating.';
  end if;
  if exists (
    select required.column_name
    from (values
      ('id'), ('owner_id'), ('title'), ('company_name'), ('city'), ('specialty'),
      ('description'), ('skills'), ('period'), ('duration'), ('is_published'), ('created_at')
    ) as required(column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'offers'
        and c.column_name = required.column_name
    )
  ) then
    raise exception 'The offers table does not match the expected StageMatch schema. No changes were applied.';
  end if;
end;
$$;

alter table public.offers enable row level security;
revoke all on public.offers from anon, authenticated;
grant select on public.offers to anon, authenticated;
grant insert on public.offers to authenticated;
grant update (title, company_name, city, specialty, description, skills, period, duration, is_published)
  on public.offers to authenticated;

drop policy if exists offer_read on public.offers;
drop policy if exists offer_add on public.offers;
drop policy if exists offer_edit on public.offers;
drop policy if exists offer_remove on public.offers;
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

commit;
