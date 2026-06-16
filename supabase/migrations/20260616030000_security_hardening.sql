-- ============================================================
-- Security hardening
--  A. Arena session/round RPCs gain participant/host authorization.
--     Previously any authenticated user could mutate or delete ANY
--     session by id (rig HP, inject rounds, grief games).
--  B. Pin search_path on every SECURITY DEFINER function so a planted
--     object in an earlier schema can't shadow references.
--  C. Revoke the blanket anon table/routine grants; anon only needs to
--     read login_taglines pre-auth.
-- ============================================================

-- ---------- A. Arena RPC authorization ----------
-- Helper expression used below: a caller is a participant of a session
-- when auth.uid() appears as an `id` in the session's players array.

CREATE OR REPLACE FUNCTION public.rpc_create_arena_session(p_lobby_id text, p_arena_lobby_id uuid, p_players jsonb, p_hp jsonb, p_connected_players jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  v_session arena_sessions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  -- The caller must include themselves in the session they create.
  IF NOT (p_players @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))) THEN
    RAISE EXCEPTION 'Not a participant of this session';
  END IF;
  DELETE FROM arena_sessions WHERE lobby_id = p_lobby_id AND status = 'done';
  INSERT INTO arena_sessions (lobby_id, arena_lobby_id, players, hp, connected_players)
  VALUES (p_lobby_id, p_arena_lobby_id, p_players, p_hp, p_connected_players)
  ON CONFLICT (lobby_id) DO NOTHING;
  SELECT * INTO v_session FROM arena_sessions WHERE lobby_id = p_lobby_id;
  IF v_session IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', v_session.id, 'seed', v_session.seed, 'players', v_session.players, 'hp', v_session.hp);
END;
$function$;

-- Drop the redundant 5-arg overload: PostgREST cannot disambiguate it from the
-- 6-arg version (both match a {p_session_id, p_hp, ...} call → HTTP 300), which
-- silently broke HP/status updates. The 6-arg form is a strict superset
-- (p_players defaults to NULL → COALESCE keeps the existing value).
DROP FUNCTION IF EXISTS public.rpc_update_arena_session(uuid, jsonb, jsonb, jsonb, text);

-- Update: caller is an existing participant OR is adding themselves
-- (the spectator-join path passes the joiner inside p_players).
CREATE OR REPLACE FUNCTION public.rpc_update_arena_session(p_session_id uuid, p_hp jsonb DEFAULT NULL::jsonb, p_matchups jsonb DEFAULT NULL::jsonb, p_connected_players jsonb DEFAULT NULL::jsonb, p_status text DEFAULT NULL::text, p_players jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM arena_sessions
    WHERE id = p_session_id
      AND ( players @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
            OR (p_players IS NOT NULL AND p_players @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))) )
  ) THEN
    RAISE EXCEPTION 'Not a participant of this session';
  END IF;
  UPDATE arena_sessions SET
    hp = COALESCE(p_hp, hp),
    matchups = COALESCE(p_matchups, matchups),
    connected_players = COALESCE(p_connected_players, connected_players),
    status = COALESCE(p_status, status),
    players = COALESCE(p_players, players)
  WHERE id = p_session_id;
END;
$function$;

-- Inserting a round result requires being a participant of the session.
CREATE OR REPLACE FUNCTION public.rpc_insert_arena_round(p_session_id uuid, p_round_num integer, p_result jsonb, p_skills_used jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM arena_sessions
    WHERE id = p_session_id
      AND players @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
  ) THEN
    RAISE EXCEPTION 'Not a participant of this session';
  END IF;
  INSERT INTO arena_rounds (session_id, round_num, result, skills_used)
  VALUES (p_session_id, p_round_num, p_result, p_skills_used)
  ON CONFLICT (session_id, round_num) DO NOTHING;
END;
$function$;

-- Deleting by string lobby key: allowed for a participant, or for anyone
-- when the session is abandoned (no connected players). No-op if absent.
CREATE OR REPLACE FUNCTION public.rpc_delete_arena_session(p_lobby_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM arena_sessions WHERE lobby_id = p_lobby_id) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM arena_sessions
    WHERE lobby_id = p_lobby_id
      AND ( players @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
            OR jsonb_array_length(COALESCE(connected_players, '[]'::jsonb)) = 0 )
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete this session';
  END IF;
  DELETE FROM arena_sessions WHERE lobby_id = p_lobby_id;
END;
$function$;

-- Deleting by lobby uuid is a host-only operation.
CREATE OR REPLACE FUNCTION public.rpc_delete_arena_session_by_lobby(p_arena_lobby_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM arena_lobbies WHERE id = p_arena_lobby_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the host can delete this session';
  END IF;
  DELETE FROM arena_sessions WHERE arena_lobby_id = p_arena_lobby_id;
END;
$function$;

-- ---------- B. Pin search_path on remaining SECURITY DEFINER functions ----------
-- (The arena RPCs above and the care-package RPCs are already pinned.)
ALTER FUNCTION public.is_admin() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.rpc_admin_disable_arena() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.rpc_admin_enable_arena() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.admin_create_user(text, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.admin_create_user(text, text, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.admin_reset_password(uuid, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.admin_set_gruten(uuid, integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.admin_toggle_hidden(uuid) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.buy_pack(uuid, integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.claim_daily_gruten() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_players() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.rpc_close_stale_lobby(uuid) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.save_deck(integer, text, uuid[]) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.setup_profile(text, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.update_profile(text, text, uuid[]) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.submit_card_suggestion(text, text, text, text, uuid) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.admin_review_suggestion(uuid, text, text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.admin_get_suggestions(text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.get_suggestion_count() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.admin_delete_suggestion(uuid) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.admin_delete_all_archived() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.rpc_cleanup_empty_lobbies(uuid[]) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.admin_send_care_package(uuid, integer) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.open_gruten_packages() SET search_path = public, extensions, pg_temp;

-- ---------- C. Tighten anon grants ----------
-- anon is only used pre-auth by the login page to read taglines. Strip the
-- blanket write/execute grants so a future un-RLS'd table is not world-writable.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon;
GRANT SELECT ON public.login_taglines TO anon;
