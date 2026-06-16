-- ============================================================
-- skill_effects: composes skills from battle_effects. A skill with rows here is
-- DB-driven (admin-editable); a skill without rows falls back to the in-code
-- registry. Seeds the 13 built-in skills wherever the skill row exists.
-- ============================================================

CREATE TABLE IF NOT EXISTS skill_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id text NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  battle_effect_id uuid NOT NULL REFERENCES battle_effects(id) ON DELETE CASCADE,
  ordinal int NOT NULL DEFAULT 0,
  UNIQUE (skill_id, battle_effect_id)
);

GRANT SELECT ON TABLE public.skill_effects TO authenticated;
GRANT ALL ON TABLE public.skill_effects TO service_role;

ALTER TABLE skill_effects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read skill effects" ON skill_effects;
CREATE POLICY "read skill effects"
  ON skill_effects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin manage skill effects" ON skill_effects;
CREATE POLICY "admin manage skill effects"
  ON skill_effects FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed the built-in skill → effect mapping (only where the skill row exists).
INSERT INTO skill_effects (skill_id, battle_effect_id, ordinal)
SELECT s.id, be.id, m.ordinal
FROM (VALUES
  ('double-edge',    'double-totals',    0),
  ('loaded-dice',    'dice-bonus-2',     0),
  ('snake-eyes',     'zero-dice',        0),
  ('all-or-nothing', 'double-damage',    0),
  ('scramble',       'randomize-rarity', 0),
  ('leveler',        'level-power',      0),
  ('beatdown',       'flat-damage-3',    0),
  ('reverse-uno',    'reverse-damage',   0),
  ('underdog',       'big-dice',         0),
  ('heal-instead',   'heal-instead',     0),
  ('brown-tint',     'brown-tint',       0),
  ('gift-exchange',  'redeal-all',       0),
  ('final-form',     'ascend-rarity',    0),
  ('final-form',     'ascend-power',     1)
) AS m(skill_id, effect_key, ordinal)
JOIN skills s ON s.id = m.skill_id
JOIN battle_effects be ON be.key = m.effect_key
ON CONFLICT (skill_id, battle_effect_id) DO NOTHING;
