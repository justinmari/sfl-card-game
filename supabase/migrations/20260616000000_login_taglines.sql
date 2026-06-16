-- Login taglines: short flavor lines shown (randomly) on the login page.
-- Read by the anon role since the login page is rendered before auth.

CREATE TABLE IF NOT EXISTS login_taglines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS login_taglines_text_key ON public.login_taglines USING btree (text);

GRANT ALL ON TABLE public.login_taglines TO anon, authenticated, service_role;

ALTER TABLE public.login_taglines ENABLE ROW LEVEL SECURITY;

-- Public read: the login page queries this with the anon key, before auth.
DROP POLICY IF EXISTS "Anyone can view login taglines" ON public.login_taglines;
CREATE POLICY "Anyone can view login taglines"
  ON public.login_taglines AS permissive FOR SELECT TO public
  USING (true);

-- Admins manage the set.
DROP POLICY IF EXISTS "Admins can manage login taglines" ON public.login_taglines;
CREATE POLICY "Admins can manage login taglines"
  ON public.login_taglines AS permissive FOR ALL TO public
  USING (public.is_admin());

-- Seed an initial set (idempotent on the unique text index).
INSERT INTO public.login_taglines (text) VALUES
  ('Collect. Build. Battle.'),
  ('Open packs. Chase secret rares.'),
  ('Every roll counts.'),
  ('Build your deck. Rule the arena.'),
  ('Eight enter. One walks away.'),
  ('Pull. Power up. Throw down.'),
  ('Your cards. Your call.'),
  ('Gruten well spent.'),
  ('May the dice be ever in your favor.'),
  ('Stack the odds. Roll anyway.')
ON CONFLICT (text) DO NOTHING;
