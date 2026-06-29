CREATE TABLE public.network_signups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  zip text NOT NULL,
  phone text,
  city text,
  roles text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'shareable_card',
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.network_signups TO anon, authenticated;
GRANT ALL ON public.network_signups TO service_role;

ALTER TABLE public.network_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone may submit a network signup"
  ON public.network_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX network_signups_created_at_idx ON public.network_signups (created_at DESC);
CREATE INDEX network_signups_email_idx ON public.network_signups (lower(email));