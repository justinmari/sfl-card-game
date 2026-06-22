-- ============================================================
-- Persistent card authors.
--   * cards.author_id        — the real uploader; the DB always tracks who
--                              submitted a card, even when shown anonymously.
--   * cards.author_name      — public display name; NULL when anonymous so a
--                              private name is never exposed on the
--                              world-readable cards table.
--   * cards.author_anonymous — drives the "by Anonymous" credit.
--   * card_suggestions.is_anonymous — the submitter's anonymity choice,
--                              carried onto the card when an admin adds it.
-- ============================================================

ALTER TABLE card_suggestions
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS author_anonymous BOOLEAN NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- submit_card_suggestion gains an anonymity flag. Drop the old 5-arg
-- signature first so PostgREST doesn't see overlapping overloads (HTTP 300).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS submit_card_suggestion(text, text, text, text, uuid);

CREATE OR REPLACE FUNCTION submit_card_suggestion(
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_rarity TEXT DEFAULT 'common',
  p_creature_id UUID DEFAULT NULL,
  p_is_anonymous BOOLEAN DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_id UUID;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM card_suggestions
  WHERE user_id = auth.uid()
    AND status = 'pending';

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'You have reached the maximum of 10 pending suggestions';
  END IF;

  INSERT INTO card_suggestions (user_id, title, description, image_url, rarity, creature_id, is_anonymous)
  VALUES (auth.uid(), p_title, p_description, p_image_url, p_rarity, p_creature_id, p_is_anonymous)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public.submit_card_suggestion(text, text, text, text, uuid, boolean) SET search_path = public, extensions, pg_temp;

-- ------------------------------------------------------------
-- admin_get_suggestions now returns is_anonymous. Adding a column to the
-- RETURNS TABLE changes the return type, so the function must be dropped first.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS admin_get_suggestions(text);

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
  is_anonymous BOOLEAN,
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
    cs.is_anonymous,
    cs.created_at
  FROM card_suggestions cs
  LEFT JOIN profiles p ON p.id = cs.user_id
  LEFT JOIN creatures c ON c.id = cs.creature_id
  WHERE cs.status = p_status
  ORDER BY cs.created_at DESC;
END;
$$;

ALTER FUNCTION public.admin_get_suggestions(text) SET search_path = public, extensions, pg_temp;

-- ------------------------------------------------------------
-- get_players(): include author credit on each top card so the friends page
-- can show it. Same return type (jsonb), additive fields.
-- ------------------------------------------------------------
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
      'unique_cards', (select count(*) from user_cards uc where uc.user_id = p.id and uc.count > 0),
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
$function$
;
