
ALTER TABLE public.acs_animals ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.acs_animals ADD COLUMN IF NOT EXISTS kennel text;

CREATE TABLE IF NOT EXISTS public.acs_animal_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id uuid NOT NULL REFERENCES public.acs_animals(id) ON DELETE CASCADE,
  source text NOT NULL,
  url text NOT NULL,
  credit text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.acs_animal_media TO anon;
GRANT SELECT, INSERT ON public.acs_animal_media TO authenticated;
GRANT ALL ON public.acs_animal_media TO service_role;

ALTER TABLE public.acs_animal_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read of acs animal media"
  ON public.acs_animal_media FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Anyone may add acs animal media"
  ON public.acs_animal_media FOR INSERT
  TO anon, authenticated WITH CHECK (true);
