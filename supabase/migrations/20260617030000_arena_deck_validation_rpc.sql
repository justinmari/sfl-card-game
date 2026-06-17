-- ============================================================
-- Fix: the host's server-side deck re-validation (startGame → resolveArenaDeck)
-- read each player's `decks` + `user_cards` rows directly, but RLS scopes both
-- tables to the owner (user_id = auth.uid()). So the host could never read
-- another player's deck → every multiplayer start failed with
-- "<player>'s deck is invalid: Deck must have exactly 5 cards".
--
-- Resolve + validate a player's arena deck in a SECURITY DEFINER RPC instead,
-- guarded so the caller may only resolve decks of players who share a lobby
-- with them (no dumping arbitrary users' decks). Validation is authoritative
-- (exactly 5 unique, owned cards) and reads straight from the tables, so a
-- forged client-supplied deck still can't get through.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_resolve_arena_deck(p_user_id uuid, p_slot integer)
RETURNS TABLE (id uuid, name text, image_url text, rarity text, creature_name text, skill_ids text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
declare
  v_caller uuid := auth.uid();
  v_card_ids uuid[];
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  -- The caller may only resolve decks of players in a lobby they're also in.
  if not exists (
    select 1
    from arena_lobby_players me
    join arena_lobby_players them on them.lobby_id = me.lobby_id
    where me.user_id = v_caller and them.user_id = p_user_id
  ) then
    raise exception 'Not authorized';
  end if;

  if p_slot is null then
    raise exception 'No deck selected';
  end if;

  select d.card_ids into v_card_ids
  from decks d
  where d.user_id = p_user_id and d.slot = p_slot;

  if coalesce(array_length(v_card_ids, 1), 0) != 5 then
    raise exception 'Deck must have exactly 5 cards';
  end if;

  if 5 != (select count(distinct x) from unnest(v_card_ids) as x) then
    raise exception 'Deck must have unique cards';
  end if;

  if exists (
    select 1 from unnest(v_card_ids) as dc(card_id)
    where not exists (
      select 1 from user_cards uc
      where uc.user_id = p_user_id and uc.card_id = dc.card_id and uc.count > 0
    )
  ) then
    raise exception 'Deck contains cards you don''t own';
  end if;

  return query
  select c.id, c.name, c.image_url, c.rarity, cr.name as creature_name,
         coalesce(
           (select array_agg(cs.skill_id order by cs.skill_id) from card_skills cs where cs.card_id = c.id),
           array[]::text[]
         ) as skill_ids
  from unnest(v_card_ids) with ordinality as d(card_id, ord)
  join cards c on c.id = d.card_id
  left join creatures cr on cr.id = c.creature_id
  order by d.ord;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_resolve_arena_deck(uuid, integer) TO authenticated;
