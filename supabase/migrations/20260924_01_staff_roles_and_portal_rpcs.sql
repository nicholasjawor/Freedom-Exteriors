-- Phase A (additive, safe to apply while the old frontend is still live).
-- Adds the staff roster, role-aware RLS policies for signed-in users, and
-- SECURITY DEFINER functions for the customer portal. The legacy
-- "Allow all for anon" policies are left in place until phase B.

-- ---------------------------------------------------------------------------
-- Staff roster: who can sign in to the CRM and what they can see.
-- `name` must match the value stored in jobs.data->>'assigned'.
-- One person can have several logins (rows) with the same name.
-- ---------------------------------------------------------------------------
create table if not exists public.staff (
  email text primary key check (email = lower(email)),
  name  text not null,
  role  text not null check (role in ('admin', 'rep'))
);
alter table public.staff enable row level security;

insert into public.staff (email, name, role) values
  ('nicholasjawor@gmail.com',          'Nick',   'admin'),
  ('nick@freedom-exteriors.com',       'Nick',   'admin'),
  ('victor@freedom-exteriors.com',     'Victor', 'rep'),
  ('gonzalezhomeservicesmn@gmail.com', 'Victor', 'rep'),
  ('bdecheine17@gmail.com',            'Brett',  'rep')
on conflict (email) do update set name = excluded.name, role = excluded.role;

-- Helpers used by policies. SECURITY DEFINER so they can read staff without
-- recursing through staff's own RLS.
create or replace function public.staff_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.staff where email = lower(auth.email())
$$;

create or replace function public.staff_name() returns text
language sql stable security definer set search_path = '' as $$
  select name from public.staff where email = lower(auth.email())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.staff where email = lower(auth.email())), false)
$$;

revoke all on function public.staff_role(), public.staff_name(), public.is_admin() from public, anon;
grant execute on function public.staff_role(), public.staff_name(), public.is_admin() to authenticated;

drop policy if exists "staff: read own row, admins read all" on public.staff;
create policy "staff: read own row, admins read all" on public.staff
  for select to authenticated
  using (email = lower(auth.email()) or public.is_admin());

-- ---------------------------------------------------------------------------
-- Normalize existing assignments to roster names.
-- ---------------------------------------------------------------------------
update public.jobs set data = jsonb_set(data, '{assigned}', '"Victor"')
  where job_id > 0 and lower(data->>'assigned') = 'victor' and data->>'assigned' <> 'Victor';
update public.jobs set data = jsonb_set(data, '{assigned}', '"Nick"')
  where job_id > 0 and data->>'assigned' = 'Me';

-- ---------------------------------------------------------------------------
-- jobs: admins do everything; reps see/edit only jobs assigned to them and
-- can read (not write) the shared pricing/materials rows (job_id -1, -2).
-- ---------------------------------------------------------------------------
drop policy if exists "jobs: staff select" on public.jobs;
create policy "jobs: staff select" on public.jobs
  for select to authenticated
  using (
    public.is_admin()
    or (public.staff_role() = 'rep' and (job_id in (-1, -2) or data->>'assigned' = public.staff_name()))
  );

drop policy if exists "jobs: staff insert" on public.jobs;
create policy "jobs: staff insert" on public.jobs
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.staff_role() = 'rep' and job_id > 0 and data->>'assigned' = public.staff_name())
  );

-- WITH CHECK stops a rep from reassigning a job away from themselves.
drop policy if exists "jobs: staff update" on public.jobs;
create policy "jobs: staff update" on public.jobs
  for update to authenticated
  using (
    public.is_admin()
    or (public.staff_role() = 'rep' and job_id > 0 and data->>'assigned' = public.staff_name())
  )
  with check (
    public.is_admin()
    or (public.staff_role() = 'rep' and job_id > 0 and data->>'assigned' = public.staff_name())
  );

drop policy if exists "jobs: admin delete" on public.jobs;
create policy "jobs: admin delete" on public.jobs
  for delete to authenticated
  using (public.is_admin());

-- messages / mail_*: admin only for signed-in users. Homeowners post
-- messages through portal_send_message(); the HailTrace import script uses
-- the service role key, which bypasses RLS.
drop policy if exists "messages: admin all" on public.messages;
create policy "messages: admin all" on public.messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mail_campaigns: admin all" on public.mail_campaigns;
create policy "mail_campaigns: admin all" on public.mail_campaigns
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mail_targets: admin all" on public.mail_targets;
create policy "mail_targets: admin all" on public.mail_targets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Customer portal. Anonymous visitors can only reach the single job whose
-- portal_token they hold, only see the fields the portal displays, and only
-- make the specific changes the portal offers.
-- ---------------------------------------------------------------------------
create or replace function public.portal_get_job(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', data->'id', 'name', data->'name', 'address', data->'address', 'city', data->'city',
    'state', data->'state', 'type', data->'type', 'stage', data->'stage', 'assigned', data->'assigned',
    'insurer', data->'insurer', 'claimNum', data->'claimNum', 'estimate', data->'estimate',
    'notes', data->'notes', 'installDate', data->'installDate', 'added', data->'added',
    'photos', data->'photos', 'depositPaid', data->'depositPaid', 'depositPaidAt', data->'depositPaidAt',
    'portalSignature', data->'portalSignature', 'portalSignatureImage', data->'portalSignatureImage',
    'portalSignedAt', data->'portalSignedAt'
  ))
  from public.jobs
  where coalesce(p_token, '') <> '' and portal_token = p_token and job_id > 0
  limit 1
$$;

create or replace function public.portal_mark_deposit_paid(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.jobs
     set data = data || jsonb_build_object('depositPaid', true, 'depositPaidAt', to_jsonb(now()))
   where coalesce(p_token, '') <> '' and portal_token = p_token and job_id > 0
     and coalesce((data->>'depositPaid')::boolean, false) = false;
  return public.portal_get_job(p_token);
end $$;

create or replace function public.portal_save_signature(p_token text, p_name text, p_image text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(trim(p_name), '') = '' or p_image not like 'data:image/png;base64,%' then
    raise exception 'invalid signature';
  end if;
  update public.jobs
     set data = data || jsonb_build_object(
       'portalSignature', left(trim(p_name), 200),
       'portalSignatureImage', p_image,
       'portalSignedAt', to_jsonb(now()))
   where coalesce(p_token, '') <> '' and portal_token = p_token and job_id > 0;
  return public.portal_get_job(p_token);
end $$;

create or replace function public.portal_add_photos(p_token text, p_photos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_photos) <> 'array' or jsonb_array_length(p_photos) > 20 then
    raise exception 'invalid photos';
  end if;
  update public.jobs
     set data = jsonb_set(data, '{photos}', coalesce(data->'photos', '[]'::jsonb) || p_photos)
   where coalesce(p_token, '') <> '' and portal_token = p_token and job_id > 0;
  return public.portal_get_job(p_token);
end $$;

create or replace function public.portal_send_message(p_token text, p_message text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  select coalesce(data->>'name', 'Homeowner') into v_name
    from public.jobs where coalesce(p_token, '') <> '' and portal_token = p_token and job_id > 0 limit 1;
  if v_name is null then raise exception 'invalid portal link'; end if;
  if coalesce(trim(p_message), '') = '' then raise exception 'empty message'; end if;
  insert into public.messages (portal_token, homeowner_name, message, read)
  values (p_token, v_name, left(trim(p_message), 5000), false);
end $$;

revoke all on function public.portal_get_job(text), public.portal_mark_deposit_paid(text),
  public.portal_save_signature(text, text, text), public.portal_add_photos(text, jsonb),
  public.portal_send_message(text, text) from public;
grant execute on function public.portal_get_job(text), public.portal_mark_deposit_paid(text),
  public.portal_save_signature(text, text, text), public.portal_add_photos(text, jsonb),
  public.portal_send_message(text, text) to anon, authenticated;
