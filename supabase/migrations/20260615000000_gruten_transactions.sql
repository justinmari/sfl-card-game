-- ============================================================
-- Gruten transaction log: tracks all gruten changes
-- ============================================================

-- 1. Create the gruten_transactions table
CREATE TABLE IF NOT EXISTS gruten_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('pack_purchase', 'admin_grant', 'daily_claim', 'arena_reward', 'card_scrap')),
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gruten_transactions_user_id ON gruten_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_gruten_transactions_type ON gruten_transactions(type);
CREATE INDEX IF NOT EXISTS idx_gruten_transactions_created_at ON gruten_transactions(created_at);

-- 2. RLS: users can read their own transactions, no direct writes
ALTER TABLE gruten_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON gruten_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Update buy_pack to log transaction
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

-- 4. Update claim_daily_gruten to log transaction
CREATE OR REPLACE FUNCTION claim_daily_gruten()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_user_id uuid;
  v_profile record;
  v_today date := (now() at time zone 'America/New_York')::date;
  v_new_balance int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from profiles where id = v_user_id for update;
  if v_profile is null then
    raise exception 'Profile not found';
  end if;

  if v_profile.role = 'admin' then
    raise exception 'Admins cannot claim daily reward';
  end if;

  if v_profile.last_daily_claim = v_today then
    raise exception 'Already claimed today';
  end if;

  v_new_balance := v_profile.gruten + 500;

  update profiles
  set gruten = v_new_balance, last_daily_claim = v_today
  where id = v_user_id;

  -- Log the transaction
  insert into gruten_transactions (user_id, type, amount, balance_after, metadata)
  values (v_user_id, 'daily_claim', 500, v_new_balance, '{}'::jsonb);

  return jsonb_build_object(
    'gruten', v_new_balance,
    'claimed_at', v_today
  );
end;
$$;

-- 5. Update admin_set_gruten to log transaction
CREATE OR REPLACE FUNCTION admin_set_gruten(p_user_id uuid, p_gruten integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_admin record;
  v_old_gruten int;
  v_diff int;
begin
  select * into v_admin from profiles where id = auth.uid() and role = 'admin';
  if v_admin is null then
    raise exception 'Not authorized';
  end if;

  select gruten into v_old_gruten from profiles where id = p_user_id;
  v_diff := p_gruten - v_old_gruten;

  update profiles set gruten = p_gruten where id = p_user_id;

  -- Log the transaction
  insert into gruten_transactions (user_id, type, amount, balance_after, metadata)
  values (p_user_id, 'admin_grant', v_diff, p_gruten,
    jsonb_build_object('admin_id', auth.uid(), 'admin_name', v_admin.full_name));
end;
$$;
