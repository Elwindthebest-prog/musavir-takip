-- Müşavir Takip — Ekip (büro) hesabı geçişi
-- Veriler kullanıcıya değil BÜROYA ait olur. Her kullanıcı tek bir büroya üyedir.
-- Büro sahibi (owner) e-postayla davet eder; davet edilen kişi aynı e-postayla
-- hesap açıp daveti kabul eder.
-- Mevcut kullanıcıların her biri için bir büro açılır ve kayıtları oraya taşınır.
-- Tekrar çalıştırılabilir (idempotent).

-- ---------- Tablolar ----------
create table if not exists public.offices (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Büro',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.office_members (
  office_id uuid not null references public.offices (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null check (role in ('owner', 'member')),
  email     text not null,
  joined_at timestamptz not null default now(),
  primary key (office_id, user_id),
  unique (user_id)
);

create table if not exists public.office_invites (
  office_id  uuid not null references public.offices (id) on delete cascade,
  email      text not null,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (office_id, email)
);

alter table public.offices        enable row level security;
alter table public.office_members enable row level security;
alter table public.office_invites enable row level security;

-- ---------- Yardımcı fonksiyonlar (RLS içinde döngüye girmemek için security definer) ----------
create or replace function public.my_office_id() returns uuid
language sql stable security definer set search_path = public as $$
  select office_id from public.office_members where user_id = auth.uid()
$$;

create or replace function public.my_office_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.office_members where user_id = auth.uid()
$$;

create or replace function public.my_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- ---------- Mevcut kullanıcılara büro aç, kayıtları taşı ----------
alter table public.records add column if not exists office_id uuid references public.offices (id) on delete cascade;

do $$
declare r record; oid uuid;
begin
  for r in select id, email from auth.users loop
    if not exists (select 1 from public.office_members where user_id = r.id) then
      insert into public.offices (name, created_by) values ('Büro', r.id) returning id into oid;
      insert into public.office_members (office_id, user_id, role, email) values (oid, r.id, 'owner', lower(coalesce(r.email, '')));
    end if;
  end loop;
  update public.records rec set office_id = m.office_id
    from public.office_members m
    where m.user_id = rec.user_id and rec.office_id is null;
end $$;

-- Birincil anahtar artık (büro, tür, anahtar)
alter table public.records drop constraint if exists records_pkey;
alter table public.records alter column office_id set not null;
alter table public.records add constraint records_pkey primary key (office_id, kind, key);

-- user_id artık "son düzenleyen" bilgisi; kullanıcı silinince kayıt silinmesin
alter table public.records drop constraint if exists records_user_id_fkey;
alter table public.records alter column user_id drop not null;
alter table public.records add constraint records_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

-- ---------- Satır güvenliği ----------
drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;
drop policy if exists "records_office" on public.records;
create policy "records_office" on public.records for all to authenticated
  using (office_id = public.my_office_id()) with check (office_id = public.my_office_id());

drop policy if exists "offices_member_read" on public.offices;
create policy "offices_member_read" on public.offices for select to authenticated
  using (id = public.my_office_id());

drop policy if exists "members_same_office" on public.office_members;
create policy "members_same_office" on public.office_members for select to authenticated
  using (office_id = public.my_office_id());

drop policy if exists "invites_read" on public.office_invites;
create policy "invites_read" on public.office_invites for select to authenticated
  using (office_id = public.my_office_id() or email = public.my_email());

-- Büro tablolarına doğrudan yazma yok; değişiklikler aşağıdaki fonksiyonlarla yapılır
grant select on public.offices, public.office_members, public.office_invites to authenticated;
grant select, insert, update, delete on public.records to authenticated;

-- ---------- İşlemler (RPC) ----------
-- Kullanıcının bürosu; yoksa kendisi için yeni büro açar
create or replace function public.my_office() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); oid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select office_id into oid from office_members where user_id = uid;
  if oid is null then
    insert into offices (name, created_by) values ('Büro', uid) returning id into oid;
    insert into office_members (office_id, user_id, role, email) values (oid, uid, 'owner', my_email());
  end if;
  return (select json_build_object('id', o.id, 'name', o.name, 'role', m.role)
          from offices o join office_members m on m.office_id = o.id and m.user_id = uid
          where o.id = oid);
end $$;

create or replace function public.rename_office(p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_office_role() is distinct from 'owner' then raise exception 'only_owner'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'empty_name'; end if;
  update offices set name = left(trim(p_name), 80) where id = my_office_id();
end $$;

create or replace function public.invite_member(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare em text := lower(trim(p_email));
begin
  if my_office_role() is distinct from 'owner' then raise exception 'only_owner'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if exists (select 1 from office_members where office_id = my_office_id() and email = em) then
    raise exception 'already_member';
  end if;
  insert into office_invites (office_id, email, invited_by) values (my_office_id(), em, auth.uid())
    on conflict (office_id, email) do nothing;
end $$;

create or replace function public.cancel_invite(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_office_role() is distinct from 'owner' then raise exception 'only_owner'; end if;
  delete from office_invites where office_id = my_office_id() and email = lower(trim(p_email));
end $$;

create or replace function public.remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_office_role() is distinct from 'owner' then raise exception 'only_owner'; end if;
  if p_user = auth.uid() then raise exception 'cannot_remove_self'; end if;
  delete from office_members where office_id = my_office_id() and user_id = p_user;
end $$;

-- Üye bürodan ayrılır; sonraki my_office() çağrısında kendine boş bir büro açılır
create or replace function public.leave_office() returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_office_role() = 'owner' then raise exception 'owner_cannot_leave'; end if;
  delete from office_members where user_id = auth.uid();
end $$;

-- Bana gelen davetler
create or replace function public.my_invites() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
           'office_id', i.office_id, 'office_name', o.name,
           'invited_by', (select email from office_members where user_id = i.invited_by limit 1))
         order by i.created_at), '[]'::json)
  from office_invites i join offices o on o.id = i.office_id
  where i.email = my_email() and i.office_id is distinct from my_office_id()
$$;

-- Daveti kabul et: mevcut bürodan ayrıl (kimse kalmazsa o büro ve verileri silinir), yenisine katıl
create or replace function public.accept_invite(p_office uuid) returns json
language plpgsql security definer set search_path = public as $$
declare em text := my_email(); old uuid := my_office_id();
begin
  if not exists (select 1 from office_invites where office_id = p_office and email = em) then
    raise exception 'no_invite';
  end if;
  if old is not null and old <> p_office then
    if my_office_role() = 'owner'
       and exists (select 1 from office_members where office_id = old and user_id <> auth.uid()) then
      raise exception 'owner_has_members';
    end if;
    delete from office_members where user_id = auth.uid();
    if not exists (select 1 from office_members where office_id = old) then
      delete from offices where id = old;
    end if;
  end if;
  insert into office_members (office_id, user_id, role, email) values (p_office, auth.uid(), 'member', em)
    on conflict do nothing;
  delete from office_invites where office_id = p_office and email = em;
  return my_office();
end $$;

-- Yalnızca giriş yapmış kullanıcılar çağırabilsin
revoke execute on function public.my_office_id(), public.my_office_role(), public.my_email(), public.my_office(),
  public.rename_office(text), public.invite_member(text), public.cancel_invite(text), public.remove_member(uuid),
  public.leave_office(), public.my_invites(), public.accept_invite(uuid) from public, anon;
grant execute on function public.my_office_id(), public.my_office_role(), public.my_email(), public.my_office(),
  public.rename_office(text), public.invite_member(text), public.cancel_invite(text), public.remove_member(uuid),
  public.leave_office(), public.my_invites(), public.accept_invite(uuid) to authenticated;
