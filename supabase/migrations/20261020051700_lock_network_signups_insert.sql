-- Block direct inserts into network_signups from the public (anon) key.
-- After this, signups can only be written by the app's server
-- (submitNetworkSignup), which verifies Cloudflare Turnstile first and
-- writes with the service-role key.
--
-- APPLY ONLY AFTER the secure-signups server code is deployed and
-- SUPABASE_SERVICE_ROLE_KEY + TURNSTILE_SECRET_KEY are set in the host env.
-- Otherwise new signups will fail.

drop policy if exists "Public can join network" on public.network_signups;

-- Reads stay denied to anon/authenticated (existing policy unchanged).
