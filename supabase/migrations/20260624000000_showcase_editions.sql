-- ============================================================
-- Showcase holo finishes: let players choose which finish of each
-- top-card to display, and surface it to other players.
--
-- top_card_editions is a sibling array to profiles.top_cards, aligned
-- by index. The uuid[] stays the source of truth for which cards;
-- the finish is purely cosmetic. Missing / 'regular' = plain.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS top_card_editions text[] NOT NULL DEFAULT '{}'::text[];

-- update_profile: accept a parallel editions array and validate the player
-- owns each (card, finish). Drop the old 3-arg signature first (rather than
-- adding a 4-arg overload) to avoid PostgREST overload ambiguity.
DROP FUNCTION IF EXISTS public.update_profile(text, text, uuid[]);

CREATE OR REPLACE FUNCTION public.update_profile(
  p_full_name text,
  p_avatar_url text DEFAULT NULL::text,
  p_top_cards uuid[] DEFAULT '{}'::uuid[],
  p_top_card_editions text[] DEFAULT '{}'::text[]
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

  if array_length(p_top_cards, 1) > 4 then
    raise exception 'Maximum 4 top cards';
  end if;

  -- Each showcased (card, finish) must be owned. A missing finish defaults to
  -- 'regular'; unnest zips the two arrays by position.
  if array_length(p_top_cards, 1) > 0 then
    if exists (
      select 1 from unnest(p_top_cards, p_top_card_editions) with ordinality as tc(card_id, edition, ord)
      where not exists (
        select 1 from user_cards uc
        where uc.user_id = v_user_id
          and uc.card_id = tc.card_id
          and uc.edition = coalesce(tc.edition, 'regular')
          and uc.count > 0
      )
    ) then
      raise exception 'You can only showcase finishes you own';
    end if;
  end if;

  update profiles
  set full_name = p_full_name,
      avatar_url = coalesce(p_avatar_url, avatar_url),
      top_cards = p_top_cards,
      top_card_editions = p_top_card_editions
  where id = v_user_id;
end;
$function$;

-- get_players: return each top card's chosen finish, preserving showcase order.
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
      'unique_cards', (select count(distinct uc.card_id) from user_cards uc where uc.user_id = p.id and uc.count > 0),
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
          'author_anonymous', c.author_anonymous,
          'edition', coalesce(tc.edition, 'regular')
        ) order by tc.ord), '[]'::jsonb)
        from unnest(p.top_cards, coalesce(p.top_card_editions, '{}'::text[])) with ordinality as tc(card_id, edition, ord)
        join cards c on c.id = tc.card_id
        left join creatures cr on cr.id = c.creature_id
      )
    ))
    from profiles p
    where p.full_name is not null and p.hidden = false
  );
end;
$function$;
