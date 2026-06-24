-- ============================================================
-- Holo editions: pull Golden / Diamond / Galaxy finishes
--
-- user_cards grows an `edition` column. Grain becomes
-- (user_id, card_id, edition) so a player can hold a card in
-- multiple finishes, each with its own count. Existing rows
-- become 'regular'. buy_pack rolls a finish on every pulled
-- card (independent of which card it is). Rates are global,
-- admin-tunable, and live in app_settings.
-- ============================================================

-- 1. user_cards: add edition, swap the unique grain
ALTER TABLE user_cards
  ADD COLUMN IF NOT EXISTS edition text NOT NULL DEFAULT 'regular';

ALTER TABLE user_cards
  DROP CONSTRAINT IF EXISTS user_cards_edition_check;
ALTER TABLE user_cards
  ADD CONSTRAINT user_cards_edition_check
  CHECK (edition IN ('regular', 'golden', 'diamond', 'galaxy'));

-- Old unique was (user_id, card_id); replace with (user_id, card_id, edition).
-- Drop the old unique by its COLUMN-NAME SET (not its name), so a
-- differently-named constraint can't silently survive and block holo inserts.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname,
           (SELECT array_agg(att.attname::text ORDER BY att.attname)
            FROM unnest(con.conkey) AS ck
            JOIN pg_attribute att
              ON att.attrelid = con.conrelid AND att.attnum = ck) AS colnames
    FROM pg_constraint con
    WHERE con.conrelid = 'public.user_cards'::regclass AND con.contype = 'u'
  LOOP
    IF r.colnames = ARRAY['card_id', 'user_id'] THEN  -- sorted alphabetically
      EXECUTE format('ALTER TABLE user_cards DROP CONSTRAINT %I', r.conname);
    END IF;
  END LOOP;
END $$;

ALTER TABLE user_cards
  DROP CONSTRAINT IF EXISTS user_cards_user_card_edition_key;
ALTER TABLE user_cards
  ADD CONSTRAINT user_cards_user_card_edition_key
  UNIQUE (user_id, card_id, edition);

-- 2. holo_rates: per-card chance (percent) of each holo finish. One row per
-- finish — adding a future finish is just an INSERT. A dedicated typed table
-- (vs app_settings jsonb). Regular has no row — it's the remainder after the
-- holo finishes. (Rarity drop rates will get their own table when fixed-rarity
-- packs are built, since they're per-pack and must sum to 100.)
CREATE TABLE IF NOT EXISTS holo_rates (
  edition text PRIMARY KEY CHECK (edition IN ('golden', 'diamond', 'galaxy')),
  rate numeric NOT NULL DEFAULT 0 CHECK (rate >= 0 AND rate <= 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE holo_rates ENABLE ROW LEVEL SECURITY;

-- Readable by any signed-in user (shown in admin + future drop-rate displays).
-- Writes go only through rpc_admin_set_holo_rates (SECURITY DEFINER) or service role.
DROP POLICY IF EXISTS "Anyone can read holo_rates" ON holo_rates;
CREATE POLICY "Anyone can read holo_rates" ON holo_rates
  FOR SELECT TO authenticated USING (true);

INSERT INTO holo_rates (edition, rate) VALUES
  ('golden', 0.1),
  ('diamond', 0.05),
  ('galaxy', 0.01)
ON CONFLICT (edition) DO NOTHING;

-- 3. buy_pack: roll a finish on every pulled card
CREATE OR REPLACE FUNCTION buy_pack(p_pack_id uuid, p_quantity integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_user_id uuid;
  v_pack record;
  v_profile record;
  v_total_cost int;
  v_pulled_cards jsonb := '[]'::jsonb;
  v_pack_cards jsonb;
  v_roll float;
  v_cumulative float;
  v_card jsonb;
  v_card_id uuid;
  v_picked_ids uuid[];
  v_attempts int;
  v_is_new boolean;
  v_existing_count int;
  v_new_balance int;
  -- holo finish roll
  v_rate_golden numeric;
  v_rate_diamond numeric;
  v_rate_galaxy numeric;
  v_finish_roll float;
  v_finish text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_quantity < 1 or p_quantity > 10 then
    raise exception 'Invalid quantity';
  end if;

  select * into v_pack from packs where id = p_pack_id and is_active = true;
  if v_pack is null then
    raise exception 'Pack not found';
  end if;

  v_total_cost := v_pack.price * p_quantity;

  select * into v_profile from profiles where id = v_user_id for update;
  if v_profile is null then
    raise exception 'Profile not found';
  end if;

  -- Rate limit: 2-second cooldown between purchases
  if v_profile.last_pack_purchase is not null
     and v_profile.last_pack_purchase > now() - interval '2 seconds' then
    raise exception 'Please wait before purchasing again';
  end if;

  if v_profile.gruten != -1 and v_profile.gruten < v_total_cost then
    raise exception 'Not enough Gruten';
  end if;

  -- Holo finish rates (per-card %, global). Missing row => 0 (never pulls that finish).
  v_rate_golden  := coalesce((select rate from holo_rates where edition = 'golden'), 0);
  v_rate_diamond := coalesce((select rate from holo_rates where edition = 'diamond'), 0);
  v_rate_galaxy  := coalesce((select rate from holo_rates where edition = 'galaxy'), 0);

  select jsonb_agg(jsonb_build_object(
    'pull_percentage', pc.pull_percentage,
    'card_id', c.id,
    'name', c.name,
    'rarity', c.rarity,
    'image_url', c.image_url,
    'description', c.description,
    'creature_name', cr.name
  ))
  into v_pack_cards
  from pack_cards pc
  join cards c on c.id = pc.card_id
  left join creatures cr on cr.id = c.creature_id
  where pc.pack_id = p_pack_id;

  if v_pack_cards is null or jsonb_array_length(v_pack_cards) = 0 then
    raise exception 'Pack has no cards';
  end if;

  for q in 1..p_quantity loop
    v_picked_ids := '{}';

    for i in 1..v_pack.cards_per_pack loop
      v_attempts := 0;

      <<roll_loop>>
      loop
        v_attempts := v_attempts + 1;
        v_roll := random() * 100;
        v_cumulative := 0;

        for j in 0..jsonb_array_length(v_pack_cards) - 1 loop
          v_card := v_pack_cards->j;
          v_cumulative := v_cumulative + (v_card->>'pull_percentage')::float;
          if v_roll < v_cumulative then
            v_card_id := (v_card->>'card_id')::uuid;

            if v_card_id = any(v_picked_ids) and array_length(v_picked_ids, 1) < jsonb_array_length(v_pack_cards) and v_attempts < 100 then
              continue roll_loop;
            end if;

            v_picked_ids := array_append(v_picked_ids, v_card_id);

            -- Independent finish roll (rarest-first). Finish is orthogonal to
            -- which card was pulled: any card can come in any finish.
            v_finish_roll := random() * 100;
            if v_finish_roll < v_rate_galaxy then
              v_finish := 'galaxy';
            elsif v_finish_roll < v_rate_galaxy + v_rate_diamond then
              v_finish := 'diamond';
            elsif v_finish_roll < v_rate_galaxy + v_rate_diamond + v_rate_golden then
              v_finish := 'golden';
            else
              v_finish := 'regular';
            end if;

            -- "New" is per (card, finish): a golden of a card you own in
            -- regular still counts as a fresh pull worth celebrating.
            select count into v_existing_count from user_cards
              where user_id = v_user_id and card_id = v_card_id and edition = v_finish;
            v_is_new := v_existing_count is null or v_existing_count = 0;

            insert into user_cards (user_id, card_id, edition, count)
            values (v_user_id, v_card_id, v_finish, 1)
            on conflict (user_id, card_id, edition)
            do update set count = user_cards.count + 1;

            v_pulled_cards := v_pulled_cards || jsonb_build_array(
              v_card || jsonb_build_object('is_new', v_is_new, 'edition', v_finish));
            exit roll_loop;
          end if;
        end loop;
      end loop;
    end loop;
  end loop;

  if v_profile.gruten != -1 then
    v_new_balance := v_profile.gruten - v_total_cost;
    update profiles set gruten = v_new_balance, last_pack_purchase = now() where id = v_user_id;
  else
    v_new_balance := -1;
    update profiles set last_pack_purchase = now() where id = v_user_id;
  end if;

  -- Log the transaction
  insert into gruten_transactions (user_id, type, amount, balance_after, metadata)
  values (v_user_id, 'pack_purchase', -v_total_cost, v_new_balance,
    jsonb_build_object('pack_id', p_pack_id, 'pack_name', v_pack.name, 'quantity', p_quantity));

  return jsonb_build_object(
    'cards', v_pulled_cards,
    'gruten_remaining', v_new_balance
  );
end;
$$;

-- 4. get_players: a card owned in multiple finishes is still one unique card
CREATE OR REPLACE FUNCTION public.get_players()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return (
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'avatar_url', p.avatar_url,
      'role', p.role,
      'unique_cards', (select count(distinct uc.card_id) from user_cards uc where uc.user_id = p.id and uc.count > 0),
      'joined_at', (select u.created_at from auth.users u where u.id = p.id),
      'top_cards', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'image_url', c.image_url,
          'rarity', c.rarity,
          'description', c.description,
          'creature_name', cr.name,
          'author_name', c.author_name,
          'author_anonymous', c.author_anonymous
        )), '[]'::jsonb)
        from unnest(p.top_cards) as tc(card_id)
        join cards c on c.id = tc.card_id
        left join creatures cr on cr.id = c.creature_id
      )
    ))
    from profiles p
    where p.full_name is not null and p.hidden = false
  );
end;
$function$;

-- 5. Admin: tune the holo pull rates (percent-per-card). Galaxy + diamond +
-- golden must leave room for regular, so their sum can't exceed 100.
CREATE OR REPLACE FUNCTION rpc_admin_set_holo_rates(
  p_golden numeric,
  p_diamond numeric,
  p_galaxy numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_golden IS NULL OR p_diamond IS NULL OR p_galaxy IS NULL
     OR p_golden < 0 OR p_diamond < 0 OR p_galaxy < 0
     OR p_golden > 100 OR p_diamond > 100 OR p_galaxy > 100 THEN
    RAISE EXCEPTION 'Each rate must be between 0 and 100';
  END IF;

  IF p_golden + p_diamond + p_galaxy > 100 THEN
    RAISE EXCEPTION 'Holo rates sum to more than 100%%';
  END IF;

  INSERT INTO holo_rates (edition, rate, updated_at, updated_by) VALUES
    ('golden',  p_golden,  now(), auth.uid()),
    ('diamond', p_diamond, now(), auth.uid()),
    ('galaxy',  p_galaxy,  now(), auth.uid())
  ON CONFLICT (edition) DO UPDATE
    SET rate = excluded.rate, updated_at = now(), updated_by = auth.uid();
END;
$$;
