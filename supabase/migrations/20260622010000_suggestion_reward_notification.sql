-- ============================================================
-- Suggestion reward notification: show the suggester a one-time
-- toast the next time they load the app after their card is added.
-- The gruten is already credited (see 20260622000000); this just
-- tracks whether the celebratory toast has been shown.
-- ============================================================

ALTER TABLE card_suggestions
  ADD COLUMN IF NOT EXISTS reward_seen BOOLEAN NOT NULL DEFAULT false;

-- Existing added suggestions predate the notification: mark them seen so we
-- don't pop a toast for rewards the player already has.
UPDATE card_suggestions SET reward_seen = true WHERE status = 'added';

-- Mark all of the caller's paid, unseen suggestion rewards as seen.
CREATE OR REPLACE FUNCTION mark_suggestion_rewards_seen()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE card_suggestions
  SET reward_seen = true
  WHERE user_id = auth.uid()
    AND status = 'added'
    AND reward_paid = true
    AND reward_seen = false;
END;
$$;

ALTER FUNCTION public.mark_suggestion_rewards_seen() SET search_path = public, extensions, pg_temp;
