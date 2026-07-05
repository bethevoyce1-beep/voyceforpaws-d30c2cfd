-- Anti-scam Tier 2 (July 5, 2026): perceptual-hash dedup for report photos.
-- The client computes a 64-bit dHash of each real capture; the analyze server
-- function rejects the same hash resubmitted within a rolling 30 days
-- (with a 10-minute grace window so same-session retakes are never blocked).

CREATE TABLE IF NOT EXISTS public.photo_hashes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hash text NOT NULL,
  mission text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photo_hashes_hash_created_idx
  ON public.photo_hashes (hash, created_at DESC);

-- Service-role access only: RLS enabled with NO policies means browser
-- clients can neither read nor write this table; only the server function
-- (service-role key) touches it.
ALTER TABLE public.photo_hashes ENABLE ROW LEVEL SECURITY;
