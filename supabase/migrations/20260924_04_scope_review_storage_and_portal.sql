-- Scope Review (step 1 of the CRM port). Additive; safe with the current app.
--
-- 1) Private bucket for carrier estimate PDFs, path {jobId}/{reviewId}.pdf.
--    Only admins can upload/read/delete; the server reads with the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scope-documents', 'scope-documents', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "scope-documents: admin read" on storage.objects;
create policy "scope-documents: admin read" on storage.objects
  for select to authenticated using (bucket_id = 'scope-documents' and public.is_admin());
drop policy if exists "scope-documents: admin upload" on storage.objects;
create policy "scope-documents: admin upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'scope-documents' and public.is_admin());
drop policy if exists "scope-documents: admin delete" on storage.objects;
create policy "scope-documents: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'scope-documents' and public.is_admin());

-- 2) Portal: include the homeowner summary from the most recent Scope Review
--    the contractor explicitly shared (shareSummaryWithHomeowner = true).
--    Nothing else from scopeReviews (line items, rebuttals, letters) is exposed.
create or replace function public.portal_get_job(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', j.data->'id', 'name', j.data->'name', 'address', j.data->'address', 'city', j.data->'city',
    'state', j.data->'state', 'type', j.data->'type', 'stage', j.data->'stage', 'assigned', j.data->'assigned',
    'insurer', j.data->'insurer', 'claimNum', j.data->'claimNum', 'estimate', j.data->'estimate',
    'notes', j.data->'notes', 'installDate', j.data->'installDate', 'added', j.data->'added',
    'photos', j.data->'photos', 'depositPaid', j.data->'depositPaid', 'depositPaidAt', j.data->'depositPaidAt',
    'portalSignature', j.data->'portalSignature', 'portalSignatureImage', j.data->'portalSignatureImage',
    'portalSignedAt', j.data->'portalSignedAt',
    'scopeReviewSummary', (
      select jsonb_build_object('text', r->'homeownerSummary', 'date', r->'createdAt')
        from jsonb_array_elements(
               case when jsonb_typeof(j.data->'scopeReviews') = 'array' then j.data->'scopeReviews' else '[]'::jsonb end
             ) r
       where r->>'shareSummaryWithHomeowner' = 'true'
         and coalesce(r->>'homeownerSummary', '') <> ''
       order by r->>'createdAt' desc
       limit 1)
  ))
  from public.jobs j
  where coalesce(p_token, '') <> '' and j.portal_token = p_token and j.job_id > 0
  limit 1
$$;
