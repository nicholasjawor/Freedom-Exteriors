-- Phase B. Apply ONLY after the frontend that uses staff roles + portal_* RPCs
-- is deployed. Removes the legacy policies that let anyone holding the public
-- anon key read and write every row.
drop policy if exists "Allow all for anon" on public.jobs;
drop policy if exists "Allow all for anon" on public.messages;
drop policy if exists "Allow all for anon" on public.mail_campaigns;
drop policy if exists "Allow all for anon" on public.mail_targets;
