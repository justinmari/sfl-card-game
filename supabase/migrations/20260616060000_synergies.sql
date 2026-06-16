-- ============================================================
-- Synergies: deck-composition recipes that grant battle effects. A synergy
-- fires when a deck meets its type requirements; its bound effects (with
-- scope/target) apply every round. Reuses battle_effects.
-- ============================================================

CREATE TABLE IF NOT EXISTS synergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS synergy_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  synergy_id uuid NOT NULL REFERENCES synergies(id) ON DELETE CASCADE,
  type_id uuid NOT NULL REFERENCES types(id) ON DELETE CASCADE,
  count int NOT NULL DEFAULT 1,
  UNIQUE (synergy_id, type_id)
);

CREATE TABLE IF NOT EXISTS synergy_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  synergy_id uuid NOT NULL REFERENCES synergies(id) ON DELETE CASCADE,
  battle_effect_id uuid NOT NULL REFERENCES battle_effects(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'own' CHECK (scope IN ('synergy_cards', 'own', 'matchup', 'arena')),
  target text NOT NULL DEFAULT 'allies' CHECK (target IN ('allies', 'enemies', 'everyone')),
  ordinal int NOT NULL DEFAULT 0
);

-- Discovery Codex: which synergies a user has triggered at least once.
CREATE TABLE IF NOT EXISTS discovered_synergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  synergy_id uuid NOT NULL REFERENCES synergies(id) ON DELETE CASCADE,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, synergy_id)
);

GRANT SELECT ON TABLE public.synergies, public.synergy_requirements, public.synergy_effects, public.discovered_synergies TO authenticated;
GRANT ALL ON TABLE public.synergies, public.synergy_requirements, public.synergy_effects, public.discovered_synergies TO service_role;

ALTER TABLE synergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE synergy_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE synergy_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovered_synergies ENABLE ROW LEVEL SECURITY;

-- Definitions: readable by any authenticated user; writable by admins.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['synergies', 'synergy_requirements', 'synergy_effects'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "read %1$s" ON %1$s', t);
    EXECUTE format('CREATE POLICY "read %1$s" ON %1$s FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin %1$s" ON %1$s', t);
    EXECUTE format('CREATE POLICY "admin %1$s" ON %1$s FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;

-- Discovery: a user reads and records only their own discoveries.
DROP POLICY IF EXISTS "read own discoveries" ON discovered_synergies;
CREATE POLICY "read own discoveries" ON discovered_synergies FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "insert own discoveries" ON discovered_synergies;
CREATE POLICY "insert own discoveries" ON discovered_synergies FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
