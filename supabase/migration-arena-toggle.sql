-- Arena toggle: app_settings table + RPCs
-- Run this in the Supabase SQL Editor

-- 1. Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'true',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 2. Seed with arena enabled
INSERT INTO app_settings (key, value) VALUES ('arena_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- 3. RLS: anyone can read, no direct writes
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app_settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

-- 4. Enable Realtime on app_settings for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;

-- 5. RPC to disable arena (atomic: wipes everything)
CREATE OR REPLACE FUNCTION rpc_admin_disable_arena()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE app_settings SET value = 'false', updated_at = now(), updated_by = auth.uid()
  WHERE key = 'arena_enabled';

  IF NOT FOUND THEN
    INSERT INTO app_settings (key, value, updated_at, updated_by)
    VALUES ('arena_enabled', 'false', now(), auth.uid());
  END IF;

  DELETE FROM arena_ready WHERE true;
  DELETE FROM arena_lobby_players WHERE true;
  DELETE FROM arena_lobbies WHERE true;
  UPDATE arena_sessions SET status = 'done' WHERE status = 'active';
END;
$$;

-- 6. RPC to enable arena
CREATE OR REPLACE FUNCTION rpc_admin_enable_arena()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE app_settings SET value = 'true', updated_at = now(), updated_by = auth.uid()
  WHERE key = 'arena_enabled';

  IF NOT FOUND THEN
    INSERT INTO app_settings (key, value, updated_at, updated_by)
    VALUES ('arena_enabled', 'true', now(), auth.uid());
  END IF;
END;
$$;
