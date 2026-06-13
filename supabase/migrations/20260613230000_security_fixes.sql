-- ============================================================
-- Security fixes: tighten RLS, add price constraint, rate limit
-- ============================================================

-- 1. Pack price must be non-negative
ALTER TABLE packs ADD CONSTRAINT packs_price_check CHECK (price >= 0);

-- 2. Tighten arena_lobbies RLS: only host can update/delete
DROP POLICY IF EXISTS "Auth update lobbies" ON arena_lobbies;
DROP POLICY IF EXISTS "Auth delete lobbies" ON arena_lobbies;

CREATE POLICY "Host or service can update lobbies"
  ON arena_lobbies FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid());

CREATE POLICY "Host or service can delete lobbies"
  ON arena_lobbies FOR DELETE
  TO authenticated
  USING (host_id = auth.uid());

-- 3. RPC to clean up empty lobbies (no players left)
CREATE OR REPLACE FUNCTION rpc_cleanup_empty_lobbies(p_lobby_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM arena_lobbies
  WHERE id = ANY(p_lobby_ids)
    AND NOT EXISTS (
      SELECT 1 FROM arena_lobby_players WHERE lobby_id = arena_lobbies.id
    );
END;
$$;

-- 4. Rate limit pack purchases: add last_pack_purchase column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_pack_purchase TIMESTAMPTZ;

-- 4. Update buy_pack to enforce 2-second cooldown between purchases
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

            select count into v_existing_count from user_cards where user_id = v_user_id and card_id = v_card_id;
            v_is_new := v_existing_count is null or v_existing_count = 0;

            insert into user_cards (user_id, card_id, count)
            values (v_user_id, v_card_id, 1)
            on conflict (user_id, card_id)
            do update set count = user_cards.count + 1;

            v_pulled_cards := v_pulled_cards || jsonb_build_array(v_card || jsonb_build_object('is_new', v_is_new));
            exit roll_loop;
          end if;
        end loop;
      end loop;
    end loop;
  end loop;

  if v_profile.gruten != -1 then
    update profiles set gruten = gruten - v_total_cost, last_pack_purchase = now() where id = v_user_id;
  else
    update profiles set last_pack_purchase = now() where id = v_user_id;
  end if;

  return jsonb_build_object(
    'cards', v_pulled_cards,
    'gruten_remaining', case when v_profile.gruten = -1 then -1 else v_profile.gruten - v_total_cost end
  );
end;
$$;
