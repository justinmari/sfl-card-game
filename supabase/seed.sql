-- Seed data for local e2e testing
-- NOTE: Test users are created via the GoTrue API in e2e/global-setup.ts
-- This file only seeds public schema data

-- Create creatures
INSERT INTO creatures (id, name) VALUES
  ('cccccccc-0001-0000-0000-000000000000', 'Fire Drake'),
  ('cccccccc-0002-0000-0000-000000000000', 'Ice Golem'),
  ('cccccccc-0003-0000-0000-000000000000', 'Shadow Cat'),
  ('cccccccc-0004-0000-0000-000000000000', 'Thunder Bird'),
  ('cccccccc-0005-0000-0000-000000000000', 'Earth Worm');

-- Create cards
INSERT INTO cards (id, name, rarity, creature_id) VALUES
  ('dddddddd-0001-0000-0000-000000000000', 'Fire Drake Common', 'common', 'cccccccc-0001-0000-0000-000000000000'),
  ('dddddddd-0002-0000-0000-000000000000', 'Ice Golem Common', 'common', 'cccccccc-0002-0000-0000-000000000000'),
  ('dddddddd-0003-0000-0000-000000000000', 'Shadow Cat Common', 'common', 'cccccccc-0003-0000-0000-000000000000'),
  ('dddddddd-0004-0000-0000-000000000000', 'Thunder Bird Uncommon', 'uncommon', 'cccccccc-0004-0000-0000-000000000000'),
  ('dddddddd-0005-0000-0000-000000000000', 'Earth Worm Uncommon', 'uncommon', 'cccccccc-0005-0000-0000-000000000000'),
  ('dddddddd-0006-0000-0000-000000000000', 'Fire Drake Rare', 'rare', 'cccccccc-0001-0000-0000-000000000000'),
  ('dddddddd-0007-0000-0000-000000000000', 'Ice Golem Rare', 'rare', 'cccccccc-0002-0000-0000-000000000000'),
  ('dddddddd-0008-0000-0000-000000000000', 'Shadow Cat Ultra', 'ultra_rare', 'cccccccc-0003-0000-0000-000000000000'),
  ('dddddddd-0009-0000-0000-000000000000', 'Thunder Bird Legendary', 'legendary', 'cccccccc-0004-0000-0000-000000000000'),
  ('dddddddd-0010-0000-0000-000000000000', 'Earth Worm Secret', 'secret_rare', 'cccccccc-0005-0000-0000-000000000000');

-- Create types (pure labels, many-to-many with cards)
INSERT INTO types (id, name, description) VALUES
  ('ffff0001-0000-0000-0000-000000000000', 'Fire', 'Burning hot cards'),
  ('ffff0002-0000-0000-0000-000000000000', 'Ice', 'Frozen cards'),
  ('ffff0003-0000-0000-0000-000000000000', 'Flying', 'Airborne cards');

-- Assign types to cards (0, 1, or multiple per card)
INSERT INTO card_types (card_id, type_id) VALUES
  ('dddddddd-0001-0000-0000-000000000000', 'ffff0001-0000-0000-0000-000000000000'), -- Fire Drake Common: Fire
  ('dddddddd-0006-0000-0000-000000000000', 'ffff0001-0000-0000-0000-000000000000'), -- Fire Drake Rare: Fire
  ('dddddddd-0002-0000-0000-000000000000', 'ffff0002-0000-0000-0000-000000000000'), -- Ice Golem Common: Ice
  ('dddddddd-0004-0000-0000-000000000000', 'ffff0003-0000-0000-0000-000000000000'), -- Thunder Bird Uncommon: Flying
  ('dddddddd-0009-0000-0000-000000000000', 'ffff0002-0000-0000-0000-000000000000'), -- Thunder Bird Legendary: Ice + Flying
  ('dddddddd-0009-0000-0000-000000000000', 'ffff0003-0000-0000-0000-000000000000');

-- Create a test pack
INSERT INTO packs (id, name, description, price, cards_per_pack, is_active) VALUES
  ('eeeeeeee-0001-0000-0000-000000000000', 'Starter Pack', 'A basic starter pack', 100, 3, true);

INSERT INTO pack_cards (pack_id, card_id, pull_percentage)
SELECT 'eeeeeeee-0001-0000-0000-000000000000', id,
  CASE rarity
    WHEN 'common' THEN 30
    WHEN 'uncommon' THEN 25
    WHEN 'rare' THEN 15
    WHEN 'ultra_rare' THEN 5
    WHEN 'legendary' THEN 3
    WHEN 'secret_rare' THEN 0.1
    ELSE 10
  END
FROM cards;

-- Ensure arena is enabled
UPDATE app_settings SET value = 'true' WHERE key = 'arena_enabled';

-- Built-in skills + their battle-effect compositions (so the admin Skills page
-- and DB-driven skill resolution have data locally). The arena e2e wipes and
-- re-seeds skills itself, so this is purely for local dev.
INSERT INTO skills (id, name, description) VALUES
 ('double-edge','Double Edge','All totals are doubled this round — for both players'),
 ('loaded-dice','Loaded Dice','All dice rolls get +2 — for both players'),
 ('snake-eyes','Snake Eyes','No dice rolls this round — base stars only, for both players'),
 ('all-or-nothing','All or Nothing','All damage this round is doubled — for both players'),
 ('scramble','Scramble','All card rarities are randomized — for both players'),
 ('leveler','Leveler','All cards are treated as commons — pure dice rolls for both'),
 ('beatdown','Beatdown','Losers take 3 damage no matter the total — for both players'),
 ('reverse-uno','Reverse Uno','Damage is dealt to the winner of each face-off instead'),
 ('underdog','Underdog','Lower rarity cards roll 0-10 no matter what — for both players'),
 ('heal-instead','Fountain of Youth','All players heal damage taken this round instead of losing HP'),
 ('brown-tint','Muddy Waters','Adds a brown tint to all players'' cards this round'),
 ('gift-exchange','Gift Exchange','All cards are shuffled together and randomly dealt into new decks for this round'),
 ('final-form','Final Form','All common cards become secret rares this round — for both players')
ON CONFLICT (id) DO NOTHING;

INSERT INTO skill_effects (skill_id, battle_effect_id, ordinal)
SELECT s.id, be.id, m.ordinal FROM (VALUES
 ('double-edge','double-totals',0),('loaded-dice','dice-bonus-2',0),('snake-eyes','zero-dice',0),
 ('all-or-nothing','double-damage',0),('scramble','randomize-rarity',0),('leveler','level-power',0),
 ('beatdown','flat-damage-3',0),('reverse-uno','reverse-damage',0),('underdog','big-dice',0),
 ('heal-instead','heal-instead',0),('brown-tint','brown-tint',0),('gift-exchange','redeal-all',0),
 ('final-form','ascend-rarity',0),('final-form','ascend-power',1)
) AS m(skill_id, effect_key, ordinal)
JOIN skills s ON s.id=m.skill_id JOIN battle_effects be ON be.key=m.effect_key
ON CONFLICT (skill_id, battle_effect_id) DO NOTHING;
