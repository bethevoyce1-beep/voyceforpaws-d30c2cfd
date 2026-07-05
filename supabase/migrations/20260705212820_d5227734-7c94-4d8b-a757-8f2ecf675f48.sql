
-- 1. acs_animal_media: restrict inserts to authenticated users with validated content
DROP POLICY IF EXISTS "Anyone may add acs animal media" ON public.acs_animal_media;

REVOKE INSERT ON public.acs_animal_media FROM anon;

CREATE POLICY "Authenticated users may add acs animal media"
ON public.acs_animal_media
FOR INSERT
TO authenticated
WITH CHECK (
  url ~* '^https?://'
  AND length(url) <= 2048
  AND source IN ('facebook','youtube','web','instagram','tiktok','x','other')
  AND (note IS NULL OR length(note) <= 500)
  AND (credit IS NULL OR length(credit) <= 200)
  AND EXISTS (SELECT 1 FROM public.acs_animals a WHERE a.id = animal_id)
);

-- 2. network_signups: explicit deny SELECT for anon and authenticated
CREATE POLICY "Deny public reads of network signups"
ON public.network_signups
AS RESTRICTIVE
FOR SELECT
TO anon, authenticated
USING (false);
