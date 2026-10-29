-- ACS listing-page states: foster_care, foster_family_pending, at_acs
--
-- When an animal drops off San Antonio's capacity list, resolve_unknowns()
-- (acs-pull/pull_acs.py) now reads the "I'm located at" line on its ACS
-- PetSearch page and files it under what ACS's own page says:
--   Foster Care                         -> foster_care            ("ACS Foster Hold")
--   Foster Care + Foster Family Pending -> foster_family_pending  ("Foster Pending")
--   ACS Campus ...                      -> at_acs                 ("Still at ACS")
--
-- acs_apply_pull()'s "unknown" sweep re-files every off-list animal that is
-- not in its exclusion list as 'unknown' on every 15-minute pull. Without this
-- change the three states above would be wiped back to 'unknown' within
-- minutes. They are deliberately NOT added to the 'secured' sweep: an animal
-- ACS still lists for adoption from a foster home has not been placed, and
-- calling it Secured would be a false claim about a real animal.
--
-- Applied as an in-place edit of the live definition (one list, nothing else)
-- so this file cannot drift from the function it changes. Idempotent.
--
-- Tested 2026-10-29 against production inside a transaction that was forced
-- to roll back: with the old function A819787 (foster) became 'secured' and
-- A830364 became 'unknown'; with this change foster_care,
-- foster_family_pending and at_acs all survived a full pull of the 24 listed
-- animals (upserted 24, unknown 0, placed 0).

do $migration$
declare
  v_old constant text :=
    $q$status_key not in ('euthanized','unknown','left','secured','adopthold','adoption','foster','watch','following_up')$q$;
  v_new constant text :=
    $q$status_key not in ('euthanized','unknown','left','secured','adopthold','adoption','foster','watch','following_up','foster_care','foster_family_pending','at_acs')$q$;
  v_def text;
begin
  select pg_get_functiondef('public.acs_apply_pull'::regproc) into v_def;

  if position(v_new in v_def) > 0 then
    raise notice 'acs_apply_pull already excludes the listing states - nothing to do';
    return;
  end if;

  if position(v_old in v_def) = 0 then
    raise exception 'acs_apply_pull no longer contains the expected unknown-sweep list; update this migration by hand';
  end if;

  execute replace(v_def, v_old, v_new);
end
$migration$;
