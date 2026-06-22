-- ============================================================
-- Suggestion reward: pay the suggester a flat 500G the first
-- time their suggested card is added to the game. The reward is
-- credited directly to their balance (auto-added, no claim step).
-- ============================================================

-- 1. Track whether the reward has already been paid (idempotency)
ALTER TABLE card_suggestions
  ADD COLUMN IF NOT EXISTS reward_paid BOOLEAN NOT NULL DEFAULT false;

-- Existing already-added suggestions predate this feature: mark them
-- as paid so they don't trigger a surprise retroactive payout.
UPDATE card_suggestions SET reward_paid = true WHERE status = 'added';

-- 2. Allow the new transaction type in the gruten log
ALTER TABLE gruten_transactions DROP CONSTRAINT IF EXISTS gruten_transactions_type_check;
ALTER TABLE gruten_transactions ADD CONSTRAINT gruten_transactions_type_check
  CHECK (type IN ('pack_purchase', 'admin_grant', 'daily_claim', 'arena_reward', 'card_scrap', 'care_package', 'suggestion_reward'));

-- 3. Grant the reward when a suggestion transitions to 'added'
CREATE OR REPLACE FUNCTION admin_review_suggestion(
  p_id UUID,
  p_status TEXT,
  p_admin_notes TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_suggestion record;
  v_new_balance int;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_suggestion FROM card_suggestions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found';
  END IF;

  UPDATE card_suggestions
  SET status = p_status,
      admin_notes = p_admin_notes
  WHERE id = p_id;

  -- Pay the suggester a flat 500G the first time their card is added.
  IF p_status = 'added' AND NOT v_suggestion.reward_paid THEN
    -- gruten = -1 means unlimited (admin/test accounts); skip crediting those.
    UPDATE profiles
    SET gruten = gruten + 500
    WHERE id = v_suggestion.user_id AND gruten <> -1
    RETURNING gruten INTO v_new_balance;

    IF FOUND THEN
      INSERT INTO gruten_transactions (user_id, type, amount, balance_after, metadata)
      VALUES (
        v_suggestion.user_id,
        'suggestion_reward',
        500,
        v_new_balance,
        jsonb_build_object('suggestion_id', p_id, 'title', v_suggestion.title)
      );
    END IF;

    -- Mark paid even for unlimited accounts so the reward never double-fires.
    UPDATE card_suggestions SET reward_paid = true WHERE id = p_id;
  END IF;
END;
$$;

-- Re-apply the search_path hardening (CREATE OR REPLACE drops SET clauses).
ALTER FUNCTION public.admin_review_suggestion(uuid, text, text) SET search_path = public, extensions, pg_temp;
