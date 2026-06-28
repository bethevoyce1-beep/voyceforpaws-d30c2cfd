
CREATE TABLE public.ai_consent_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consent_version TEXT NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash TEXT,
  user_agent_hash TEXT,
  source TEXT
);

GRANT INSERT ON public.ai_consent_log TO anon, authenticated;
GRANT ALL ON public.ai_consent_log TO service_role;

ALTER TABLE public.ai_consent_log ENABLE ROW LEVEL SECURITY;

-- Anyone (anonymous visitors included) may log their consent. No SELECT policy: rows are write-only from the app.
CREATE POLICY "Anyone may insert a consent record"
  ON public.ai_consent_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
