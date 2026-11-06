-- Müşavir Takip — Supabase şeması
-- Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını yapıştırın → Run.

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('client', 'status', 'doc', 'fee')),
  key        text        not null,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);

alter table public.records enable row level security;

-- Her kullanıcı yalnızca kendi kayıtlarını görür ve değiştirir
drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;

create policy "records_select_own" on public.records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "records_insert_own" on public.records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "records_update_own" on public.records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "records_delete_own" on public.records
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.records to authenticated;

-- Canlı güncelleme (telefonda yapılan değişiklik web'de anında görünsün)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'
  ) then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;
