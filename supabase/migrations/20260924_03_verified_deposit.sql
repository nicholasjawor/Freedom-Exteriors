-- Deposits are marked paid only by /api/confirm-deposit after Stripe confirms
-- the checkout session. Replaces portal_mark_deposit_paid, which anyone with a
-- portal link could call to flip depositPaid without paying.
drop function if exists public.portal_mark_deposit_paid(text);

create or replace function public.mark_deposit_paid(p_token text, p_session_id text, p_amount numeric)
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.jobs
     set data = data || jsonb_build_object(
       'depositPaid', true,
       'depositPaidAt', to_jsonb(now()),
       'depositStripeSession', p_session_id,
       'depositAmountPaid', p_amount)
   where coalesce(p_token, '') <> '' and portal_token = p_token and job_id > 0
     and coalesce((data->>'depositPaid')::boolean, false) = false;
  return public.portal_get_job(p_token);
end $$;

revoke all on function public.mark_deposit_paid(text, text, numeric) from public, anon, authenticated;
grant execute on function public.mark_deposit_paid(text, text, numeric) to service_role;
