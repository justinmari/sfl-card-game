-- Card Types: pure labels attached to cards (many-to-many).
-- A card can have 0, 1, or multiple types. No battle effect yet — a future
-- feature will read these labels (e.g. deck synergy when N cards share a type).
-- Mirrors the creatures/card_skills patterns (admin-managed, public read).

CREATE TABLE IF NOT EXISTS types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS types_name_key ON public.types USING btree (name);

CREATE TABLE IF NOT EXISTS card_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  type_id UUID NOT NULL REFERENCES types(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS card_types_card_id_type_id_key ON public.card_types USING btree (card_id, type_id);

-- Permissions (mirrors baseline blanket grants for new tables)
GRANT ALL ON TABLE public.types TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.card_types TO anon, authenticated, service_role;

-- RLS: admins manage, authenticated users read (mirrors creatures in prod)
ALTER TABLE public.types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage types" ON public.types;
CREATE POLICY "Admins can manage types"
  ON public.types AS permissive FOR ALL TO public
  USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can view types" ON public.types;
CREATE POLICY "Authenticated users can view types"
  ON public.types AS permissive FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage card_types" ON public.card_types;
CREATE POLICY "Admins can manage card_types"
  ON public.card_types AS permissive FOR ALL TO public
  USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can read card_types" ON public.card_types;
CREATE POLICY "Anyone can read card_types"
  ON public.card_types AS permissive FOR SELECT TO public
  USING (true);
