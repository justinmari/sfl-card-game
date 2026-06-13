-- Card suggestions table
CREATE TABLE IF NOT EXISTS card_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  rarity TEXT NOT NULL DEFAULT 'common',
  creature_id UUID REFERENCES creatures(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'added', 'archived')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE card_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can read their own suggestions
CREATE POLICY "Users can view own suggestions"
  ON card_suggestions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all suggestions
CREATE POLICY "Admins can view all suggestions"
  ON card_suggestions FOR SELECT
  USING (is_admin());

-- Submit suggestion RPC (enforces 10-card limit)
CREATE OR REPLACE FUNCTION submit_card_suggestion(
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_rarity TEXT DEFAULT 'common',
  p_creature_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_id UUID;
BEGIN
  -- Count active (non-added, non-archived) suggestions
  SELECT COUNT(*) INTO v_count
  FROM card_suggestions
  WHERE user_id = auth.uid()
    AND status = 'pending';

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'You have reached the maximum of 10 pending suggestions';
  END IF;

  INSERT INTO card_suggestions (user_id, title, description, image_url, rarity, creature_id)
  VALUES (auth.uid(), p_title, p_description, p_image_url, p_rarity, p_creature_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Admin: update suggestion status
CREATE OR REPLACE FUNCTION admin_review_suggestion(
  p_id UUID,
  p_status TEXT,
  p_admin_notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE card_suggestions
  SET status = p_status,
      admin_notes = p_admin_notes
  WHERE id = p_id;
END;
$$;

-- Admin: get all suggestions (with user info)
CREATE OR REPLACE FUNCTION admin_get_suggestions(p_status TEXT DEFAULT 'pending')
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  title TEXT,
  description TEXT,
  image_url TEXT,
  rarity TEXT,
  creature_id UUID,
  creature_name TEXT,
  status TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    cs.id,
    cs.user_id,
    p.full_name AS user_name,
    cs.title,
    cs.description,
    cs.image_url,
    cs.rarity,
    cs.creature_id,
    c.name AS creature_name,
    cs.status,
    cs.admin_notes,
    cs.created_at
  FROM card_suggestions cs
  LEFT JOIN profiles p ON p.id = cs.user_id
  LEFT JOIN creatures c ON c.id = cs.creature_id
  WHERE cs.status = p_status
  ORDER BY cs.created_at DESC;
END;
$$;

-- Get user's suggestion count
CREATE OR REPLACE FUNCTION get_suggestion_count()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM card_suggestions
    WHERE user_id = auth.uid()
      AND status = 'pending'
  );
END;
$$;
