-- Auto-close stale lobbies.
--
-- Replaces the manual per-lobby "Close" button. Stale lobbies are now closed
-- automatically whenever lobbies are queried (opening the arena lobby list or
-- loading the dashboard arena badge). A lobby is stale when it is at least one
-- hour old and has had no round or ready activity in the last hour — the same
-- rule the single-lobby rpc_close_stale_lobby enforced, applied in bulk.
CREATE OR REPLACE FUNCTION rpc_cleanup_stale_lobbies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stale uuid[];
BEGIN
  SELECT array_agg(l.id) INTO v_stale
  FROM arena_lobbies l
  WHERE l.created_at <= now() - interval '1 hour'
    AND NOT EXISTS (
      SELECT 1 FROM arena_rounds r
      JOIN arena_sessions s ON r.session_id = s.id
      WHERE s.arena_lobby_id = l.id AND r.created_at > now() - interval '1 hour'
    )
    AND NOT EXISTS (
      SELECT 1 FROM arena_ready ar
      JOIN arena_sessions s ON ar.session_id = s.id
      WHERE s.arena_lobby_id = l.id AND ar.created_at > now() - interval '1 hour'
    );

  IF v_stale IS NULL THEN RETURN 0; END IF;

  -- Sessions first (rounds/ready/players cascade off sessions + lobbies).
  DELETE FROM arena_sessions WHERE arena_lobby_id = ANY(v_stale);
  DELETE FROM arena_lobbies WHERE id = ANY(v_stale);

  RETURN COALESCE(array_length(v_stale, 1), 0);
END;
$$;

ALTER FUNCTION public.rpc_cleanup_stale_lobbies() SET search_path = public, extensions, pg_temp;
