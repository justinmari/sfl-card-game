-- Add per-player stats to get_players(): unique card count (collection size)
-- and the account's join date (from auth.users). Additive — same shape plus two
-- new fields, so existing callers keep working.
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
          'creature_name', cr.name
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
