-- ============================================================
-- Battle effects: data-driven composition of the in-code op vocabulary.
-- A battle effect = an op id + params. Skills (and later synergies) reference
-- these rows. Logic lives in code (OP_REGISTRY); composition lives here.
-- ============================================================

CREATE TABLE IF NOT EXISTS battle_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,           -- stable slug used by the engine
  name text NOT NULL,
  op text NOT NULL,                   -- must exist in OP_REGISTRY (code)
  params jsonb NOT NULL DEFAULT '{}',
  kind text[] NOT NULL DEFAULT '{}',  -- visual kinds; empty => use op default
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON TABLE public.battle_effects TO authenticated;
GRANT ALL ON TABLE public.battle_effects TO service_role;

ALTER TABLE battle_effects ENABLE ROW LEVEL SECURITY;

-- Battle definitions are computed on every client, so any authenticated user
-- may read them. Writes go through admin RPCs only.
DROP POLICY IF EXISTS "read battle effects" ON battle_effects;
CREATE POLICY "read battle effects"
  ON battle_effects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin manage battle effects" ON battle_effects;
CREATE POLICY "admin manage battle effects"
  ON battle_effects FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed the built-in effects (mirror src/lib/battle-effects/index.ts).
INSERT INTO battle_effects (key, name, op, params, kind) VALUES
  ('zero-dice',        'No Dice',          'zero_dice',        '{}',                                          ARRAY['dice']),
  ('dice-bonus-2',     'Dice Bonus +2',    'dice_bonus',       '{"amount":2}',                                ARRAY['dice']),
  ('big-dice',         'Big Dice',         'big_dice',         '{"max":10}',                                  ARRAY['dice']),
  ('double-totals',    'Double Totals',    'multiply_total',   '{"factor":2}',                                ARRAY['total']),
  ('double-damage',    'Double Damage',    'multiply_damage',  '{"factor":2}',                                ARRAY['damage']),
  ('flat-damage-3',    'Flat Damage 3',    'flat_damage',      '{"value":3}',                                 ARRAY['damage']),
  ('reverse-damage',   'Reverse Damage',   'reverse_damage',   '{}',                                          ARRAY['damage']),
  ('level-power',      'Level Power',      'set_power',        '{"value":1}',                                 ARRAY['power']),
  ('randomize-rarity', 'Randomize Rarity', 'randomize_rarity', '{}',                                          ARRAY['rarity','power']),
  ('ascend-rarity',    'Ascend Rarity',    'set_rarity_if',    '{"ifRarity":"common","toRarity":"secret_rare"}', ARRAY['rarity']),
  ('ascend-power',     'Ascend Power',     'boost_power_if',   '{"ifRarity":"common","value":6}',             ARRAY['power']),
  ('heal-instead',     'Heal Instead',     'heal_instead',     '{}',                                          ARRAY['heal']),
  ('brown-tint',       'Brown Tint',       'visual_tint',      '{"filter":"sepia(0.8) brightness(0.85)"}',    ARRAY['visual']),
  ('redeal-all',       'Redeal All',       'redeal_all',       '{}',                                          ARRAY['deck'])
ON CONFLICT (key) DO NOTHING;
