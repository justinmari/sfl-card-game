-- ============================================================
-- Lifesteal + Drowsy battle effects, and a new 'non_synergy_cards' synergy
-- scope (the inverse of 'synergy_cards' — targets cards that DON'T carry the
-- synergy's type). See src/lib/battle-effects/ops.ts (lifesteal, extra_dice).
-- ============================================================

-- New building-block effects (mirror src/lib/battle-effects/index.ts).
INSERT INTO battle_effects (key, name, op, params, kind) VALUES
  ('lifesteal', 'Lifesteal', 'lifesteal', '{"mode":"flat","amount":1,"chance":100}', ARRAY['heal']),
  ('drowsy',    'Drowsy',    'extra_dice', '{"min":-1,"max":0}',                      ARRAY['extraDice'])
ON CONFLICT (key) DO NOTHING;

-- Widen the synergy_effects.scope CHECK to allow 'non_synergy_cards'.
ALTER TABLE synergy_effects DROP CONSTRAINT IF EXISTS synergy_effects_scope_check;
ALTER TABLE synergy_effects ADD CONSTRAINT synergy_effects_scope_check
  CHECK (scope IN ('synergy_cards', 'non_synergy_cards', 'own', 'matchup', 'arena'));
