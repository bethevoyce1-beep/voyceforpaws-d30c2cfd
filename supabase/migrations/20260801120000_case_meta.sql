-- =============================================================================
-- case_meta — structured "where / who / how to help" metadata on a shared
-- rescue card. Lets a card say where the animal physically is (origin shelter),
-- which rescue is coordinating and how to reach them, where the original post
-- came from, any deadline, and the specific ask (foster/adopt/transport).
--
-- Fully ADDITIVE + backward compatible:
--   * the column is nullable, so every existing row and the photo-only flow
--     keep working unchanged;
--   * each RPC change is optional (guarded), so old callers that never send
--     case_meta behave exactly as before.
--
-- case_meta shape (all fields optional / nullable):
-- {
--   origin:   { shelter_name, city, state, address },   -- where the animal physically is
--   rescue:   { name, url, email, facebook, phone },     -- coordinating rescue
--   source_url,                                          -- where the post came from
--   deadline,                                            -- e.g. "today", or an ISO date
--   ask                                                  -- e.g. "foster", "adopt", "transport"
-- }
--
-- NOTE: This migration was authored from the LIVE function definitions
-- (read read-only via pg_get_functiondef); the shared_reports RPCs were created
-- through the Supabase dashboard and were not previously committed to the repo.
-- This file is the committed source of truth going forward. It has NOT been
-- applied to production yet.
-- =============================================================================

-- 1) New nullable column (safe to re-run).
alter table public.shared_reports add column if not exists case_meta jsonb;

-- 2) create_shared_report: also persist case_meta from p->'case_meta'.
--    (Key casing matches the existing snake_case convention in this function.)
create or replace function public.create_shared_report(p jsonb)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id text;
  v_try int := 0;
begin
  loop
    v_id := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    begin
      insert into public.shared_reports(id, image, data, mission, situation, location, note, loc_privacy, edit_token, case_meta)
      values (
        v_id,
        p->>'image',
        coalesce(p->'data', '{}'::jsonb),
        p->>'mission',
        p->>'situation',
        p->'location',
        nullif(p->>'note', ''),
        coalesce(nullif(p->>'loc_privacy', ''), 'area'),
        nullif(p->>'edit_token', '')::uuid,
        p->'case_meta'
      );
      return v_id;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 6 then raise; end if;
    end;
  end loop;
end;
$function$;

-- 3) get_shared_report: unchanged logic. to_jsonb(r) already returns every
--    column (so case_meta flows out automatically) and still strips edit_token.
--    Re-created here so this migration is self-documenting.
create or replace function public.get_shared_report(p_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v jsonb;
begin
  update public.shared_reports set views = views + 1 where id = p_id;
  select to_jsonb(r) - 'edit_token' into v from public.shared_reports r where r.id = p_id;
  return v;
end;
$function$;

-- 4) update_shared_report: creator (with the secret edit_token) can now also
--    write case_meta, same gating pattern as reporter_added. Both fields are
--    coalesce-guarded so an update that touches only one never wipes the other
--    (a key that is absent -> SQL NULL -> keep the existing value).
create or replace function public.update_shared_report(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id text := p->>'id';
  v_token uuid;
  v_rows int;
begin
  begin
    v_token := nullif(p->>'edit_token', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'bad_token');
  end;
  if v_id is null or v_token is null then
    return jsonb_build_object('ok', false, 'error', 'missing');
  end if;
  update public.shared_reports
     set reporter_added = coalesce(p->'reporter_added', reporter_added),
         case_meta      = coalesce(p->'case_meta', case_meta)
   where id = v_id and edit_token = v_token;
  get diagnostics v_rows = row_count;
  return jsonb_build_object('ok', v_rows > 0);
end;
$function$;
