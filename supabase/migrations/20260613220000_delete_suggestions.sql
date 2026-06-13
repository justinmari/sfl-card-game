-- Admin: delete a single archived suggestion
CREATE OR REPLACE FUNCTION admin_delete_suggestion(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM card_suggestions
  WHERE id = p_id AND status = 'archived';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found or not archived';
  END IF;
END;
$$;

-- Admin: delete all archived suggestions
CREATE OR REPLACE FUNCTION admin_delete_all_archived()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM card_suggestions
  WHERE status = 'archived';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
