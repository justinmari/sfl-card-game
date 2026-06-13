drop extension if exists "pg_net";

drop policy "Anyone can view lobbies" on "public"."arena_lobbies";

drop policy "Service role full access to arena_lobbies" on "public"."arena_lobbies";

drop policy "Anyone can view lobby players" on "public"."arena_lobby_players";

drop policy "Service role full access to arena_lobby_players" on "public"."arena_lobby_players";

drop policy "Anyone can manage arena ready" on "public"."arena_ready";

drop policy "Service role full access to arena_ready" on "public"."arena_ready";

drop policy "Anyone can view arena rounds" on "public"."arena_rounds";

drop policy "Service role full access to arena_rounds" on "public"."arena_rounds";

drop policy "Anyone can view arena sessions" on "public"."arena_sessions";

drop policy "Service role full access to arena_sessions" on "public"."arena_sessions";

drop policy "Service role full access to decks" on "public"."decks";

drop policy "Users can manage own decks" on "public"."decks";

drop policy "Service role full access to profiles" on "public"."profiles";

drop policy "Users can update own profile" on "public"."profiles";

drop policy "Users can view own profile" on "public"."profiles";

drop policy "Service role full access to user_cards" on "public"."user_cards";

drop policy "Users can view own decks" on "public"."decks";

drop policy "Users can insert own profile" on "public"."profiles";

drop policy "Users can view own cards" on "public"."user_cards";

alter table "public"."user_cards" drop constraint "user_cards_card_id_fkey";

alter table "public"."arena_lobby_players" drop constraint "arena_lobby_players_lobby_id_fkey";

alter table "public"."arena_ready" drop constraint "arena_ready_session_id_fkey";

alter table "public"."arena_rounds" drop constraint "arena_rounds_session_id_fkey";

alter table "public"."arena_sessions" drop constraint "arena_sessions_arena_lobby_id_fkey";

alter table "public"."card_skills" drop constraint "card_skills_card_id_fkey";

alter table "public"."card_skills" drop constraint "card_skills_skill_id_fkey";

alter table "public"."cards" drop constraint "cards_creature_id_fkey";

alter table "public"."pack_cards" drop constraint "pack_cards_card_id_fkey";

alter table "public"."pack_cards" drop constraint "pack_cards_pack_id_fkey";

alter table "public"."user_cards" drop constraint "user_cards_pkey";

drop index if exists "public"."user_cards_pkey";

alter table "public"."arena_ready" alter column "is_ready" set default true;

alter table "public"."arena_ready" alter column "skills" set default '[]'::jsonb;

alter table "public"."arena_rounds" alter column "skills_used" set default '[]'::jsonb;

alter table "public"."arena_sessions" alter column "connected_players" set default '[]'::jsonb;

alter table "public"."arena_sessions" alter column "hp" set default '{}'::jsonb;

alter table "public"."arena_sessions" alter column "seed" set default (floor((random() * (2147483647)::double precision)))::integer;

alter table "public"."card_skills" enable row level security;

alter table "public"."cards" alter column "rarity" set default 'common'::text;

alter table "public"."cards" enable row level security;

alter table "public"."changelogs" enable row level security;

alter table "public"."creatures" enable row level security;

alter table "public"."decks" alter column "card_ids" set default '{}'::uuid[];

alter table "public"."decks" alter column "name" set default 'Deck'::text;

alter table "public"."pack_cards" alter column "pull_percentage" set data type numeric(5,2) using "pull_percentage"::numeric(5,2);

alter table "public"."pack_cards" enable row level security;

alter table "public"."packs" alter column "cards_per_pack" set default 5;

alter table "public"."packs" alter column "is_active" set default true;

alter table "public"."packs" alter column "price" set default 100;

alter table "public"."packs" enable row level security;

alter table "public"."profiles" alter column "gruten" set default 500;

alter table "public"."profiles" alter column "id" drop default;

alter table "public"."profiles" alter column "role" set default 'user'::text;

alter table "public"."profiles" alter column "top_cards" set default '{}'::uuid[];

alter table "public"."skills" enable row level security;

CREATE UNIQUE INDEX arena_lobby_players_lobby_id_user_id_key ON public.arena_lobby_players USING btree (lobby_id, user_id);

CREATE UNIQUE INDEX arena_rounds_session_id_round_num_key ON public.arena_rounds USING btree (session_id, round_num);

CREATE UNIQUE INDEX arena_sessions_lobby_id_key ON public.arena_sessions USING btree (lobby_id);

CREATE UNIQUE INDEX card_skills_card_id_skill_id_key ON public.card_skills USING btree (card_id, skill_id);

CREATE UNIQUE INDEX creatures_name_key ON public.creatures USING btree (name);

CREATE UNIQUE INDEX decks_user_id_slot_key ON public.decks USING btree (user_id, slot);

CREATE UNIQUE INDEX pack_cards_pack_id_card_id_key ON public.pack_cards USING btree (pack_id, card_id);

CREATE UNIQUE INDEX user_cards_new_pkey ON public.user_cards USING btree (id);

CREATE UNIQUE INDEX user_cards_new_user_id_card_id_key ON public.user_cards USING btree (user_id, card_id);

alter table "public"."user_cards" add constraint "user_cards_new_pkey" PRIMARY KEY using index "user_cards_new_pkey";

alter table "public"."arena_lobby_players" add constraint "arena_lobby_players_lobby_id_user_id_key" UNIQUE using index "arena_lobby_players_lobby_id_user_id_key";

alter table "public"."arena_rounds" add constraint "arena_rounds_session_id_round_num_key" UNIQUE using index "arena_rounds_session_id_round_num_key";

alter table "public"."arena_sessions" add constraint "arena_sessions_lobby_id_key" UNIQUE using index "arena_sessions_lobby_id_key";

alter table "public"."card_skills" add constraint "card_skills_card_id_skill_id_key" UNIQUE using index "card_skills_card_id_skill_id_key";

alter table "public"."cards" add constraint "cards_rarity_check" CHECK ((rarity = ANY (ARRAY['common'::text, 'uncommon'::text, 'rare'::text, 'ultra_rare'::text, 'secret_rare'::text, 'legendary'::text]))) not valid;

alter table "public"."cards" validate constraint "cards_rarity_check";

alter table "public"."creatures" add constraint "creatures_name_key" UNIQUE using index "creatures_name_key";

alter table "public"."decks" add constraint "decks_slot_check" CHECK (((slot >= 1) AND (slot <= 3))) not valid;

alter table "public"."decks" validate constraint "decks_slot_check";

alter table "public"."decks" add constraint "decks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."decks" validate constraint "decks_user_id_fkey";

alter table "public"."decks" add constraint "decks_user_id_slot_key" UNIQUE using index "decks_user_id_slot_key";

alter table "public"."pack_cards" add constraint "pack_cards_pack_id_card_id_key" UNIQUE using index "pack_cards_pack_id_card_id_key";

alter table "public"."pack_cards" add constraint "pack_cards_pull_percentage_check" CHECK (((pull_percentage > (0)::numeric) AND (pull_percentage <= (100)::numeric))) not valid;

alter table "public"."pack_cards" validate constraint "pack_cards_pull_percentage_check";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_role_check";

alter table "public"."user_cards" add constraint "user_cards_new_card_id_fkey" FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE not valid;

alter table "public"."user_cards" validate constraint "user_cards_new_card_id_fkey";

alter table "public"."user_cards" add constraint "user_cards_new_user_id_card_id_key" UNIQUE using index "user_cards_new_user_id_card_id_key";

alter table "public"."user_cards" add constraint "user_cards_new_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_cards" validate constraint "user_cards_new_user_id_fkey";

alter table "public"."arena_lobby_players" add constraint "arena_lobby_players_lobby_id_fkey" FOREIGN KEY (lobby_id) REFERENCES public.arena_lobbies(id) ON DELETE CASCADE not valid;

alter table "public"."arena_lobby_players" validate constraint "arena_lobby_players_lobby_id_fkey";

alter table "public"."arena_ready" add constraint "arena_ready_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.arena_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."arena_ready" validate constraint "arena_ready_session_id_fkey";

alter table "public"."arena_rounds" add constraint "arena_rounds_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.arena_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."arena_rounds" validate constraint "arena_rounds_session_id_fkey";

alter table "public"."arena_sessions" add constraint "arena_sessions_arena_lobby_id_fkey" FOREIGN KEY (arena_lobby_id) REFERENCES public.arena_lobbies(id) ON DELETE CASCADE not valid;

alter table "public"."arena_sessions" validate constraint "arena_sessions_arena_lobby_id_fkey";

alter table "public"."card_skills" add constraint "card_skills_card_id_fkey" FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE not valid;

alter table "public"."card_skills" validate constraint "card_skills_card_id_fkey";

alter table "public"."card_skills" add constraint "card_skills_skill_id_fkey" FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE not valid;

alter table "public"."card_skills" validate constraint "card_skills_skill_id_fkey";

alter table "public"."cards" add constraint "cards_creature_id_fkey" FOREIGN KEY (creature_id) REFERENCES public.creatures(id) ON DELETE SET NULL not valid;

alter table "public"."cards" validate constraint "cards_creature_id_fkey";

alter table "public"."pack_cards" add constraint "pack_cards_card_id_fkey" FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE not valid;

alter table "public"."pack_cards" validate constraint "pack_cards_card_id_fkey";

alter table "public"."pack_cards" add constraint "pack_cards_pack_id_fkey" FOREIGN KEY (pack_id) REFERENCES public.packs(id) ON DELETE CASCADE not valid;

alter table "public"."pack_cards" validate constraint "pack_cards_pack_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.admin_create_user(p_email text, p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_admin record;
  v_new_user_id uuid;
begin
  select * into v_admin from profiles where id = auth.uid() and role = 'admin';
  if v_admin is null then
    raise exception 'Not authorized';
  end if;

  v_new_user_id := gen_random_uuid();
  
  insert into auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, role, aud,
    is_super_admin, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    v_new_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(), 'authenticated', 'authenticated',
    false, '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_new_user_id, v_new_user_id,
    jsonb_build_object('sub', v_new_user_id::text, 'email', p_email, 'email_verified', false, 'phone_verified', false),
    'email', v_new_user_id::text,
    now(), now(), now()
  );

  -- Create profile with no name — user fills it in on first login
  insert into profiles (id, gruten, role)
  values (v_new_user_id, 500, 'user');

  return jsonb_build_object('id', v_new_user_id, 'email', p_email);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_create_user(p_email text, p_password text, p_full_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_admin record;
  v_new_user_id uuid;
begin
  select * into v_admin from profiles where id = auth.uid() and role = 'admin';
  if v_admin is null then
    raise exception 'Not authorized';
  end if;

  v_new_user_id := gen_random_uuid();
  
  -- Insert into auth.users with all required fields
  insert into auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, role, aud,
    is_super_admin, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    v_new_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    now(), now(), 'authenticated', 'authenticated',
    false, '', '', '', ''
  );

  -- Create identity record (required for login)
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_new_user_id, v_new_user_id,
    jsonb_build_object('sub', v_new_user_id::text, 'email', p_email, 'email_verified', false, 'phone_verified', false),
    'email', v_new_user_id::text,
    now(), now(), now()
  );

  -- Create profile
  insert into profiles (id, full_name, gruten, role)
  values (v_new_user_id, p_full_name, 500, 'user');

  return jsonb_build_object('id', v_new_user_id, 'email', p_email, 'name', p_full_name);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_reset_password(p_user_id uuid, p_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_admin record;
begin
  select * into v_admin from profiles where id = auth.uid() and role = 'admin';
  if v_admin is null then
    raise exception 'Not authorized';
  end if;

  update auth.users
  set encrypted_password = crypt(p_password, gen_salt('bf'))
  where id = p_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_gruten(p_user_id uuid, p_gruten integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_admin record;
begin
  select * into v_admin from profiles where id = auth.uid() and role = 'admin';
  if v_admin is null then
    raise exception 'Not authorized';
  end if;

  update profiles set gruten = p_gruten where id = p_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_toggle_hidden(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_admin record;
begin
  select * into v_admin from profiles where id = auth.uid() and role = 'admin';
  if v_admin is null then
    raise exception 'Not authorized';
  end if;

  update profiles set hidden = not hidden where id = p_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.buy_pack(p_pack_id uuid, p_quantity integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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

            -- Check if card is new (doesn't exist or count is 0)
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
    update profiles set gruten = gruten - v_total_cost where id = v_user_id;
  end if;

  return jsonb_build_object(
    'cards', v_pulled_cards,
    'gruten_remaining', case when v_profile.gruten = -1 then -1 else v_profile.gruten - v_total_cost end
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_daily_gruten()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_user_id uuid;
  v_profile record;
  v_today date := (now() at time zone 'America/New_York')::date;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the row to prevent race conditions
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

  update profiles
  set gruten = gruten + 500, last_daily_claim = v_today
  where id = v_user_id;

  return jsonb_build_object(
    'gruten', v_profile.gruten + 500,
    'claimed_at', v_today
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_players()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
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
      'top_cards', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'image_url', c.image_url,
          'rarity', c.rarity,
          'description', c.description,
          'creature_name', cr.name
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
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_close_stale_lobby(p_lobby_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_lobby arena_lobbies;
  v_latest_round timestamptz;
  v_latest_ready timestamptz;
BEGIN
  -- Get the lobby
  SELECT * INTO v_lobby FROM arena_lobbies WHERE id = p_lobby_id;
  IF v_lobby IS NULL THEN RETURN false; END IF;

  -- Must be at least 1 hour old
  IF v_lobby.created_at > now() - interval '1 hour' THEN RETURN false; END IF;

  -- Check for recent activity: latest round or ready entry
  SELECT MAX(created_at) INTO v_latest_round
  FROM arena_rounds r
  JOIN arena_sessions s ON r.session_id = s.id
  WHERE s.arena_lobby_id = p_lobby_id;

  SELECT MAX(created_at) INTO v_latest_ready
  FROM arena_ready r
  JOIN arena_sessions s ON r.session_id = s.id
  WHERE s.arena_lobby_id = p_lobby_id;

  -- If any activity in the last hour, don't close
  IF v_latest_round IS NOT NULL AND v_latest_round > now() - interval '1 hour' THEN RETURN false; END IF;
  IF v_latest_ready IS NOT NULL AND v_latest_ready > now() - interval '1 hour' THEN RETURN false; END IF;

  -- Safe to close: delete session and lobby
  DELETE FROM arena_sessions WHERE arena_lobby_id = p_lobby_id;
  DELETE FROM arena_lobbies WHERE id = p_lobby_id;
  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_create_arena_session(p_lobby_id text, p_arena_lobby_id uuid, p_players jsonb, p_hp jsonb, p_connected_players jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_session arena_sessions;
BEGIN
  DELETE FROM arena_sessions WHERE lobby_id = p_lobby_id AND status = 'done';
  INSERT INTO arena_sessions (lobby_id, arena_lobby_id, players, hp, connected_players)
  VALUES (p_lobby_id, p_arena_lobby_id, p_players, p_hp, p_connected_players)
  ON CONFLICT (lobby_id) DO NOTHING;
  SELECT * INTO v_session FROM arena_sessions WHERE lobby_id = p_lobby_id;
  IF v_session IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', v_session.id, 'seed', v_session.seed, 'players', v_session.players, 'hp', v_session.hp);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_delete_arena_session(p_lobby_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM arena_sessions WHERE lobby_id = p_lobby_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_delete_arena_session_by_lobby(p_arena_lobby_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM arena_sessions WHERE arena_lobby_id = p_arena_lobby_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_insert_arena_round(p_session_id uuid, p_round_num integer, p_result jsonb, p_skills_used jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO arena_rounds (session_id, round_num, result, skills_used)
  VALUES (p_session_id, p_round_num, p_result, p_skills_used)
  ON CONFLICT (session_id, round_num) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_update_arena_session(p_session_id uuid, p_hp jsonb DEFAULT NULL::jsonb, p_matchups jsonb DEFAULT NULL::jsonb, p_connected_players jsonb DEFAULT NULL::jsonb, p_status text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE arena_sessions SET
    hp = COALESCE(p_hp, hp),
    matchups = COALESCE(p_matchups, matchups),
    connected_players = COALESCE(p_connected_players, connected_players),
    status = COALESCE(p_status, status)
  WHERE id = p_session_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_update_arena_session(p_session_id uuid, p_hp jsonb DEFAULT NULL::jsonb, p_matchups jsonb DEFAULT NULL::jsonb, p_connected_players jsonb DEFAULT NULL::jsonb, p_status text DEFAULT NULL::text, p_players jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE arena_sessions SET
    hp = COALESCE(p_hp, hp),
    matchups = COALESCE(p_matchups, matchups),
    connected_players = COALESCE(p_connected_players, connected_players),
    status = COALESCE(p_status, status),
    players = COALESCE(p_players, players)
  WHERE id = p_session_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.save_deck(p_slot integer, p_name text, p_card_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_slot < 1 or p_slot > 3 then
    raise exception 'Invalid slot (1-3)';
  end if;

  if array_length(p_card_ids, 1) > 5 then
    raise exception 'Maximum 5 cards per deck';
  end if;

  -- Validate all cards are owned
  if array_length(p_card_ids, 1) > 0 then
    if exists (
      select 1 from unnest(p_card_ids) as dc(card_id)
      where not exists (
        select 1 from user_cards where user_id = v_user_id and card_id = dc.card_id and count > 0
      )
    ) then
      raise exception 'You can only use cards you own';
    end if;
  end if;

  -- Check uniqueness
  if array_length(p_card_ids, 1) != (select count(distinct x) from unnest(p_card_ids) as x) then
    raise exception 'Deck must have unique cards';
  end if;

  insert into decks (user_id, slot, name, card_ids)
  values (v_user_id, p_slot, p_name, p_card_ids)
  on conflict (user_id, slot)
  do update set name = p_name, card_ids = p_card_ids;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.setup_profile(p_full_name text, p_avatar_url text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_user_id uuid;
  v_profile record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from profiles where id = v_user_id;
  if v_profile is null then
    raise exception 'Profile not found';
  end if;

  -- Only allow setup if name is not already set
  if v_profile.full_name is not null and v_profile.full_name != '' then
    raise exception 'Profile already set up';
  end if;

  update profiles
  set full_name = p_full_name, avatar_url = p_avatar_url
  where id = v_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_profile(p_full_name text, p_avatar_url text DEFAULT NULL::text, p_top_cards uuid[] DEFAULT '{}'::uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate top cards (max 4, must be owned by user)
  if array_length(p_top_cards, 1) > 4 then
    raise exception 'Maximum 4 top cards';
  end if;

  if array_length(p_top_cards, 1) > 0 then
    if exists (
      select 1 from unnest(p_top_cards) as tc(card_id)
      where not exists (
        select 1 from user_cards where user_id = v_user_id and card_id = tc.card_id and count > 0
      )
    ) then
      raise exception 'You can only showcase cards you own';
    end if;
  end if;

  update profiles
  set full_name = p_full_name, avatar_url = coalesce(p_avatar_url, avatar_url), top_cards = p_top_cards
  where id = v_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$function$
;


  create policy "Auth delete lobbies"
  on "public"."arena_lobbies"
  as permissive
  for delete
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Auth insert lobbies"
  on "public"."arena_lobbies"
  as permissive
  for insert
  to public
with check ((auth.uid() IS NOT NULL));



  create policy "Auth read lobbies"
  on "public"."arena_lobbies"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Auth update lobbies"
  on "public"."arena_lobbies"
  as permissive
  for update
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Auth delete lobby players"
  on "public"."arena_lobby_players"
  as permissive
  for delete
  to public
using (((auth.uid() = user_id) OR (auth.uid() IN ( SELECT arena_lobbies.host_id
   FROM public.arena_lobbies
  WHERE (arena_lobbies.id = arena_lobby_players.lobby_id)))));



  create policy "Auth insert lobby players"
  on "public"."arena_lobby_players"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Auth read lobby players"
  on "public"."arena_lobby_players"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Auth update lobby players"
  on "public"."arena_lobby_players"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Auth insert ready"
  on "public"."arena_ready"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Auth read ready"
  on "public"."arena_ready"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Auth update ready"
  on "public"."arena_ready"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Auth read rounds"
  on "public"."arena_rounds"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Auth read sessions"
  on "public"."arena_sessions"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Admins can manage card_skills"
  on "public"."card_skills"
  as permissive
  for all
  to public
using (public.is_admin());



  create policy "Anyone can read card skills"
  on "public"."card_skills"
  as permissive
  for select
  to public
using (true);



  create policy "Anyone can read card_skills"
  on "public"."card_skills"
  as permissive
  for select
  to public
using (true);



  create policy "Admins can delete cards"
  on "public"."cards"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));



  create policy "Admins can insert cards"
  on "public"."cards"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));



  create policy "Admins can update cards"
  on "public"."cards"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));



  create policy "Authenticated users can view cards"
  on "public"."cards"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Admins can manage changelogs"
  on "public"."changelogs"
  as permissive
  for all
  to public
using (public.is_admin());



  create policy "Anyone can read changelogs"
  on "public"."changelogs"
  as permissive
  for select
  to public
using (true);



  create policy "Admins can manage creatures"
  on "public"."creatures"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));



  create policy "Authenticated users can view creatures"
  on "public"."creatures"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Admins can manage pack cards"
  on "public"."pack_cards"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));



  create policy "Authenticated users can view pack cards"
  on "public"."pack_cards"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Admins can manage packs"
  on "public"."packs"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));



  create policy "Authenticated users can view active packs"
  on "public"."packs"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Users can read own profile or admin reads all"
  on "public"."profiles"
  as permissive
  for select
  to public
using (((auth.uid() = id) OR public.is_admin()));



  create policy "Admins can manage skills"
  on "public"."skills"
  as permissive
  for all
  to public
using (public.is_admin());



  create policy "Anyone can read skills"
  on "public"."skills"
  as permissive
  for select
  to public
using (true);



  create policy "Users can view own decks"
  on "public"."decks"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert own profile"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));



  create policy "Users can view own cards"
  on "public"."user_cards"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Admins can delete card images"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'card-images'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));



  create policy "Admins can upload card images"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'card-images'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));



  create policy "Public can view card images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'card-images'::text));



  create policy "Users can upload own avatar"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'card-images'::text) AND ((storage.foldername(name))[1] = 'avatars'::text) AND (auth.uid() IS NOT NULL)));



