-- Baseline schema for local testing
-- Mirrors the production Supabase schema

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  avatar_url TEXT,
  gruten INTEGER NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT false,
  role TEXT,
  last_daily_claim DATE,
  top_cards UUID[]
);

CREATE TABLE IF NOT EXISTS creatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  rarity TEXT,
  creature_id UUID REFERENCES creatures(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS card_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id),
  skill_id TEXT NOT NULL REFERENCES skills(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  image_url TEXT,
  cards_per_pack INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pack_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES packs(id),
  card_id UUID NOT NULL REFERENCES cards(id),
  pull_percentage NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_id UUID NOT NULL REFERENCES cards(id),
  count INTEGER NOT NULL DEFAULT 1,
  obtained_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  slot INTEGER NOT NULL,
  name TEXT NOT NULL,
  card_ids UUID[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS changelogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arena_lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  max_players INTEGER NOT NULL DEFAULT 8,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arena_lobby_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID NOT NULL REFERENCES arena_lobbies(id),
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  avatar_url TEXT,
  deck_slot INTEGER,
  deck_cards JSONB,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arena_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id TEXT NOT NULL,
  arena_lobby_id UUID REFERENCES arena_lobbies(id),
  seed INTEGER NOT NULL,
  players JSONB NOT NULL,
  hp JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  matchups JSONB,
  connected_players JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arena_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES arena_sessions(id),
  round_num INTEGER NOT NULL,
  result JSONB NOT NULL,
  skills_used JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arena_ready (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES arena_sessions(id),
  user_id UUID NOT NULL,
  round_num INTEGER NOT NULL,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  skills JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id, round_num)
);

-- Grant permissions (Supabase does this automatically via Dashboard, but migrations need it explicitly)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- Enable RLS on tables that need it
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_lobby_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_ready ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Service role full access to profiles" ON profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own cards" ON user_cards FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role full access to user_cards" ON user_cards FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own decks" ON decks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can manage own decks" ON decks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service role full access to decks" ON decks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can view lobbies" ON arena_lobbies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access to arena_lobbies" ON arena_lobbies FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can view lobby players" ON arena_lobby_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access to arena_lobby_players" ON arena_lobby_players FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can view arena sessions" ON arena_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access to arena_sessions" ON arena_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can view arena rounds" ON arena_rounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access to arena_rounds" ON arena_rounds FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can manage arena ready" ON arena_ready FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to arena_ready" ON arena_ready FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public tables (no RLS, anyone can read)
-- creatures, cards, skills, card_skills, packs, pack_cards, changelogs are public read

-- is_admin() helper used by RPC functions
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;
