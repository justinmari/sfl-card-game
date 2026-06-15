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
