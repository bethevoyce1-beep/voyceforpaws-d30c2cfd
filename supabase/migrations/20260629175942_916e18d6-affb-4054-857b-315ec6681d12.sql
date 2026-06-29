
CREATE TABLE public.acs_animals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelter_id text NOT NULL,
  shelter_name text NOT NULL,
  kennel_id text,
  name text NOT NULL,
  species text NOT NULL DEFAULT 'dog',
  breed text,
  age text,
  sex text,
  weight text,
  photo_url text NOT NULL,
  story text,
  status text NOT NULL DEFAULT 'at_risk',
  urgency int NOT NULL DEFAULT 0,
  days_at_shelter int NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  last_pulled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.acs_animals TO anon, authenticated;
GRANT ALL ON public.acs_animals TO service_role;

ALTER TABLE public.acs_animals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read of at-risk shelter animals"
  ON public.acs_animals FOR SELECT
  USING (true);

CREATE INDEX acs_animals_shelter_status_idx
  ON public.acs_animals (shelter_id, status, days_at_shelter DESC);

INSERT INTO public.acs_animals
  (shelter_id, shelter_name, kennel_id, name, species, breed, age, sex, weight, photo_url, story, status, urgency, days_at_shelter, tags)
VALUES
  ('san_antonio_acs','San Antonio ACS','D-214','Rex','dog','Pit Bull Mix','3 yr','Male','52 lb',
   'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&q=80',
   'Rex came in as a stray on a 100° afternoon. Calm, leans into every scratch, learned ''sit'' in two tries.',
   'pm_cutoff', 95, 11, ARRAY['URGENT','large']),
  ('san_antonio_acs','San Antonio ACS','D-187','Ivy','dog','Hound Mix','7 yr','Female','44 lb',
   'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&q=80',
   'Ivy walks straight to the front of her kennel, tail low but wagging. Senior dogs are always first on the list.',
   'at_risk', 88, 9, ARRAY['SENIOR']),
  ('san_antonio_acs','San Antonio ACS','C-052','Tabby','cat','Domestic Shorthair','2 yr','Female','8 lb',
   'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=600&q=80',
   'Tabby purrs the second you open her cage. URI cleared last week, fully vetted, ready to go home.',
   'med_foster', 70, 6, ARRAY['URI recovered']),
  ('san_antonio_acs','San Antonio ACS','D-302','Maama','dog','Lab Mix','5 yr','Female','61 lb',
   'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600&q=80',
   'Came in with her last pup. Bonded mom — she watches the kennel door for him.',
   'at_risk', 92, 8, ARRAY['BONDED']),
  ('san_antonio_acs','San Antonio ACS','D-091','Bandit','dog','Heeler Mix','4 yr','Male','40 lb',
   'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=600&q=80',
   'Smart, ball-obsessed, would thrive with a job. Found tied to the front gate at 6am.',
   'at_risk', 78, 7, ARRAY['high-energy']),
  ('san_antonio_acs','San Antonio ACS','D-145','Daisy','dog','Chihuahua','9 yr','Female','7 lb',
   'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&q=80',
   'Tiny, gray-muzzled, prefers laps. Owner surrender after a move.',
   'pm_cutoff', 90, 14, ARRAY['SENIOR','small']),
  ('san_antonio_acs','San Antonio ACS','D-220','Bruno','dog','Boxer Mix','2 yr','Male','58 lb',
   'https://images.unsplash.com/photo-1552053831-71594a27632d?w=600&q=80',
   'All wiggle, no manners yet. Just needs someone with patience and a backyard.',
   'at_risk', 65, 5, ARRAY['young']),
  ('san_antonio_acs','San Antonio ACS','D-401','Luna','dog','Husky Mix','3 yr','Female','48 lb',
   'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=600&q=80',
   'Vocal, blue-eyed, escape artist. Needs a fence taller than 6ft and a runner partner.',
   'at_risk', 72, 10, ARRAY['escape-risk']),
  ('san_antonio_acs','San Antonio ACS','C-108','Mittens','cat','Tuxedo','8 yr','Male','11 lb',
   'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=600&q=80',
   'Senior gentleman, wants a quiet window and one human. URI watched but stable.',
   'med_foster', 80, 12, ARRAY['SENIOR']),
  ('san_antonio_acs','San Antonio ACS','D-077','Cooper','dog','Beagle','6 yr','Male','30 lb',
   'https://images.unsplash.com/photo-1505628346881-b72b27e84530?w=600&q=80',
   'Sweet nose-led wanderer. Came in with a worn collar but no tags.',
   'at_risk', 68, 6, ARRAY[]::text[]);
