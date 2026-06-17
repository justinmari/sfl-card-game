-- Arena decks must have EXACTLY 5 cards (previously up to 5 was allowed). A deck
-- with any other count is invalid and can't be saved; the arena also re-checks.
CREATE OR REPLACE FUNCTION public.save_deck(p_slot integer, p_name text, p_card_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_slot < 1 or p_slot > 3 then
    raise exception 'Invalid slot (1-3)';
  end if;

  if coalesce(array_length(p_card_ids, 1), 0) != 5 then
    raise exception 'Deck must have exactly 5 cards';
  end if;

  -- Validate all cards are owned
  if exists (
    select 1 from unnest(p_card_ids) as dc(card_id)
    where not exists (
      select 1 from user_cards where user_id = v_user_id and card_id = dc.card_id and count > 0
    )
  ) then
    raise exception 'You can only use cards you own';
  end if;

  -- Cards must be unique
  if 5 != (select count(distinct x) from unnest(p_card_ids) as x) then
    raise exception 'Deck must have unique cards';
  end if;

  insert into decks (user_id, slot, name, card_ids)
  values (v_user_id, p_slot, p_name, p_card_ids)
  on conflict (user_id, slot)
  do update set name = p_name, card_ids = p_card_ids;
end;
$function$
;
