-- ============================================================
-- Arena deck holo finishes: players choose which finish of each deck card
-- to play, and opponents see it in the lobby + battle. card_editions is a
-- sibling array to decks.card_ids, aligned by index. Finish is cosmetic;
-- battle logic ignores it. Missing / 'regular' = plain.
-- ============================================================

ALTER TABLE decks
  ADD COLUMN IF NOT EXISTS card_editions text[] NOT NULL DEFAULT '{}'::text[];

-- save_deck: accept a parallel finishes array, validate each (card, finish) is
-- owned. Drop the old 3-arg signature (no overload) to avoid PostgREST ambiguity.
DROP FUNCTION IF EXISTS public.save_deck(integer, text, uuid[]);

CREATE OR REPLACE FUNCTION public.save_deck(
  p_slot integer,
  p_name text,
  p_card_ids uuid[],
  p_card_editions text[] DEFAULT '{}'::text[]
)
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

  -- Each (card, finish) must be owned. unnest zips the two arrays by position;
  -- a missing finish defaults to 'regular'.
  if exists (
    select 1 from unnest(p_card_ids, p_card_editions) with ordinality as dc(card_id, edition, ord)
    where not exists (
      select 1 from user_cards uc
      where uc.user_id = v_user_id and uc.card_id = dc.card_id
        and uc.edition = coalesce(dc.edition, 'regular') and uc.count > 0
    )
  ) then
    raise exception 'You can only use finishes you own';
  end if;

  if 5 != (select count(distinct x) from unnest(p_card_ids) as x) then
    raise exception 'Deck must have unique cards';
  end if;

  insert into decks (user_id, slot, name, card_ids, card_editions)
  values (v_user_id, p_slot, p_name, p_card_ids, p_card_editions)
  on conflict (user_id, slot)
  do update set name = p_name, card_ids = p_card_ids, card_editions = p_card_editions;
end;
$function$;

-- rpc_resolve_arena_deck: add the chosen finish to the resolved cards.
-- Return-type change requires a drop first.
DROP FUNCTION IF EXISTS public.rpc_resolve_arena_deck(uuid, integer);

CREATE OR REPLACE FUNCTION public.rpc_resolve_arena_deck(p_user_id uuid, p_slot integer)
RETURNS TABLE (id uuid, name text, image_url text, rarity text, creature_name text, skill_ids text[], edition text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
declare
  v_caller uuid := auth.uid();
  v_card_ids uuid[];
  v_card_editions text[];
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

  select d.card_ids, d.card_editions into v_card_ids, v_card_editions
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
         ) as skill_ids,
         coalesce(d.edition, 'regular') as edition
  from unnest(v_card_ids, coalesce(v_card_editions, '{}'::text[])) with ordinality as d(card_id, edition, ord)
  join cards c on c.id = d.card_id
  left join creatures cr on cr.id = c.creature_id
  order by d.ord;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_resolve_arena_deck(uuid, integer) TO authenticated;
