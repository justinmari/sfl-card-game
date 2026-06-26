-- ============================================================
-- Live player-to-player trading (a real-time trade window).
--   Two players enter a shared session and each stages cards from THEIR OWN
--   collection. Each sees only the cards the other has put on the table — never
--   the other's full collection (privacy by construction). Both lock, then both
--   confirm; on mutual confirm the cards swap atomically. Any edit after locking
--   resets both locks (no last-second swaps).
-- Modelled on the arena lobby pattern (presence + broadcast + DB-as-truth).
-- All mutations go through SECURITY DEFINER RPCs; RLS lets each party read only
-- the sessions they're in.
-- ============================================================

-- ---- Tables -------------------------------------------------

CREATE TABLE IF NOT EXISTS trade_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status               text NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','completed','cancelled','expired')),
  initiator_locked     boolean NOT NULL DEFAULT false,
  partner_locked       boolean NOT NULL DEFAULT false,
  initiator_confirmed  boolean NOT NULL DEFAULT false,
  partner_confirmed    boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_sessions_no_self CHECK (initiator_id <> partner_id)
);

-- Cards each participant has staged. owner_id is the giver; the receiver is the
-- other participant. recipient_new is stamped at commit (was the card new to the
-- receiver?) so the reveal can show a NEW badge.
CREATE TABLE IF NOT EXISTS trade_session_cards (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL REFERENCES trade_sessions(id) ON DELETE CASCADE,
  owner_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id        uuid NOT NULL REFERENCES cards(id),
  edition        text NOT NULL DEFAULT 'regular'
                   CHECK (edition IN ('regular','golden','diamond','galaxy')),
  quantity       integer NOT NULL CHECK (quantity > 0),
  recipient_new  boolean NOT NULL DEFAULT false,
  CONSTRAINT trade_session_cards_unique UNIQUE (session_id, owner_id, card_id, edition)
);

CREATE INDEX IF NOT EXISTS idx_trade_sessions_partner_open
  ON trade_sessions (partner_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_trade_sessions_initiator_open
  ON trade_sessions (initiator_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_trade_session_cards_session
  ON trade_session_cards (session_id);

-- Defense-in-depth backstop: card counts must never go negative. The trade swap
-- re-validates ownership under lock so it never decrements below zero, but this
-- makes ANY future bad decrement fail loudly instead of silently minting cards.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_cards_count_nonneg') THEN
    ALTER TABLE user_cards ADD CONSTRAINT user_cards_count_nonneg CHECK (count >= 0);
  END IF;
END $$;

-- Permanent, self-contained audit of COMPLETED trades (accepted only — offers
-- are not logged). Card sets + player names are snapshotted as jsonb so the log
-- stays readable even if cards/players change later.
CREATE TABLE IF NOT EXISTS trade_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid,
  initiator_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  partner_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  initiator_name  text,
  partner_name    text,
  initiator_cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  partner_cards   jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_audit_completed ON trade_audit (completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_audit_initiator ON trade_audit (initiator_id);
CREATE INDEX IF NOT EXISTS idx_trade_audit_partner ON trade_audit (partner_id);

-- ---- RLS ----------------------------------------------------

GRANT ALL ON TABLE public.trade_sessions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.trade_session_cards TO anon, authenticated, service_role;

ALTER TABLE trade_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_session_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parties read own trade sessions" ON trade_sessions;
CREATE POLICY "Parties read own trade sessions" ON trade_sessions
  FOR SELECT TO authenticated
  USING (initiator_id = auth.uid() OR partner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Service role full access to trade_sessions" ON trade_sessions;
CREATE POLICY "Service role full access to trade_sessions" ON trade_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Parties read own staged cards" ON trade_session_cards;
CREATE POLICY "Parties read own staged cards" ON trade_session_cards
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trade_sessions s
    WHERE s.id = trade_session_cards.session_id
      AND (s.initiator_id = auth.uid() OR s.partner_id = auth.uid() OR public.is_admin())
  ));

DROP POLICY IF EXISTS "Service role full access to trade_session_cards" ON trade_session_cards;
CREATE POLICY "Service role full access to trade_session_cards" ON trade_session_cards
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trade audit: admin-only read (it's an admin log). Rows are written only by the
-- SECURITY DEFINER swap; no authenticated write policy.
GRANT ALL ON TABLE public.trade_audit TO anon, authenticated, service_role;
ALTER TABLE trade_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read trade audit" ON trade_audit;
CREATE POLICY "Admins read trade audit" ON trade_audit
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access to trade_audit" ON trade_audit;
CREATE POLICY "Service role full access to trade_audit" ON trade_audit
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---- Read helpers -------------------------------------------

-- The current user's own collection (count > 0), for the staging picker. Only
-- ever returns YOUR cards — no one can query another player's collection.
CREATE OR REPLACE FUNCTION public.get_my_cards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'card_id', c.id, 'name', c.name, 'image_url', c.image_url, 'rarity', c.rarity,
      'creature_name', cr.name, 'edition', uc.edition, 'count', uc.count
    ) order by c.name, uc.edition), '[]'::jsonb)
    from user_cards uc
    join cards c on c.id = uc.card_id
    left join creatures cr on cr.id = c.creature_id
    where uc.user_id = v_uid and uc.count > 0
  );
end;
$$;

-- Full state of one session for the room UI (participant-gated): both players,
-- the lock/confirm flags, and every staged card with display fields.
CREATE OR REPLACE FUNCTION public.get_trade_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_uid uuid := auth.uid();
  v_s trade_sessions;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_s from trade_sessions where id = p_session_id;
  if v_s is null then raise exception 'Trade not found'; end if;
  if v_s.initiator_id <> v_uid and v_s.partner_id <> v_uid and not public.is_admin() then
    raise exception 'Not a participant of this trade';
  end if;

  -- Touch-on-read: the room polls this every few seconds, so an actively-viewed
  -- session stays "fresh" and the stale sweep only reaps ones both players left.
  if v_s.status = 'open' then
    update trade_sessions set updated_at = now() where id = p_session_id;
  end if;

  return jsonb_build_object(
    'id', v_s.id,
    'status', v_s.status,
    'initiator_id', v_s.initiator_id,
    'partner_id', v_s.partner_id,
    'initiator_locked', v_s.initiator_locked,
    'partner_locked', v_s.partner_locked,
    'initiator_confirmed', v_s.initiator_confirmed,
    'partner_confirmed', v_s.partner_confirmed,
    'initiator', (select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url) from profiles p where p.id = v_s.initiator_id),
    'partner', (select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url) from profiles p where p.id = v_s.partner_id),
    'cards', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'owner_id', sc.owner_id,
        'card_id', c.id, 'name', c.name, 'image_url', c.image_url, 'rarity', c.rarity,
        'description', c.description, 'creature_name', cr.name,
        'typeNames', coalesce((select jsonb_agg(t.name order by t.name) from card_types ct join types t on t.id = ct.type_id where ct.card_id = c.id), '[]'::jsonb),
        'edition', sc.edition, 'quantity', sc.quantity, 'recipient_new', sc.recipient_new
      ) order by c.name), '[]'::jsonb)
      from trade_session_cards sc
      join cards c on c.id = sc.card_id
      left join creatures cr on cr.id = c.creature_id
      where sc.session_id = v_s.id
    )
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.pending_trade_invite_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int FROM trade_sessions
  WHERE partner_id = auth.uid() AND status = 'open';
$$;

-- Delete sessions both players have abandoned. "Fresh" is kept current by the
-- touch-on-read in get_trade_session (the room polls it), so an open session
-- idle past the window means nobody is viewing it — reap it (cards cascade).
CREATE OR REPLACE FUNCTION public.cleanup_stale_trade_sessions()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH x AS (
    DELETE FROM trade_sessions
    WHERE status = 'open' AND updated_at <= now() - interval '3 minutes'
    RETURNING 1
  )
  SELECT count(*)::int FROM x;
$$;

-- ---- Mutations ----------------------------------------------

CREATE OR REPLACE FUNCTION public.create_trade_session(p_partner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_uid uuid := auth.uid();
  v_partner profiles;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_partner_id = v_uid then raise exception 'Cannot trade with yourself'; end if;

  select * into v_partner from profiles where id = p_partner_id;
  if v_partner is null then raise exception 'Player not found'; end if;
  if coalesce(v_partner.hidden, false) or v_partner.role = 'admin' then
    raise exception 'This player is not available for trading';
  end if;

  if exists (
    select 1 from trade_sessions
    where status = 'open' and (initiator_id = v_uid or partner_id = v_uid)
  ) then
    raise exception 'You already have an active trade — finish or cancel it first';
  end if;

  insert into trade_sessions (initiator_id, partner_id)
  values (v_uid, p_partner_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Replace the caller's staged cards. Any change resets ALL lock/confirm flags.
CREATE OR REPLACE FUNCTION public.set_trade_stage(p_session_id uuid, p_cards jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_uid uuid := auth.uid();
  v_s trade_sessions;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_s from trade_sessions where id = p_session_id for update;
  if v_s is null then raise exception 'Trade not found'; end if;
  if v_s.initiator_id <> v_uid and v_s.partner_id <> v_uid then
    raise exception 'Not a participant of this trade';
  end if;
  if v_s.status <> 'open' then raise exception 'Trade is no longer open'; end if;

  delete from trade_session_cards where session_id = p_session_id and owner_id = v_uid;

  insert into trade_session_cards (session_id, owner_id, card_id, edition, quantity)
  select p_session_id, v_uid, card_id, edition, sum(qty)
  from (
    select (e->>'card_id')::uuid as card_id,
           coalesce(e->>'edition', 'regular') as edition,
           greatest(coalesce((e->>'quantity')::int, 1), 1) as qty
    from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) e
  ) lines
  group by card_id, edition;

  -- Caller must own everything they staged.
  if exists (
    select 1 from trade_session_cards sc
    left join user_cards uc
      on uc.user_id = v_uid and uc.card_id = sc.card_id and uc.edition = sc.edition
    where sc.session_id = p_session_id and sc.owner_id = v_uid
      and coalesce(uc.count, 0) < sc.quantity
  ) then
    raise exception 'You do not own enough of a staged card';
  end if;

  update trade_sessions set
    initiator_locked = false, partner_locked = false,
    initiator_confirmed = false, partner_confirmed = false,
    updated_at = now()
  where id = p_session_id;
end;
$$;

CREATE OR REPLACE FUNCTION public.set_trade_lock(p_session_id uuid, p_locked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_uid uuid := auth.uid();
  v_s trade_sessions;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_s from trade_sessions where id = p_session_id for update;
  if v_s is null then raise exception 'Trade not found'; end if;
  if v_s.status <> 'open' then raise exception 'Trade is no longer open'; end if;

  -- Unlocking is a "wait, let me reconsider" signal: it clears BOTH players'
  -- confirmations, so a trade can never complete on a stale confirm. (Locking
  -- leaves existing confirmations untouched.)
  if v_s.initiator_id = v_uid then
    update trade_sessions set
      initiator_locked = p_locked,
      initiator_confirmed = case when p_locked then initiator_confirmed else false end,
      partner_confirmed   = case when p_locked then partner_confirmed   else false end,
      updated_at = now() where id = p_session_id;
  elsif v_s.partner_id = v_uid then
    update trade_sessions set
      partner_locked = p_locked,
      partner_confirmed   = case when p_locked then partner_confirmed   else false end,
      initiator_confirmed = case when p_locked then initiator_confirmed else false end,
      updated_at = now() where id = p_session_id;
  else
    raise exception 'Not a participant of this trade';
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.cancel_trade_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  update trade_sessions set status = 'cancelled', updated_at = now()
  where id = p_session_id and status = 'open'
    and (initiator_id = v_uid or partner_id = v_uid);
  if not found then raise exception 'Cannot cancel this trade'; end if;
end;
$$;

-- Confirm. Requires both locked. When both have confirmed, run the atomic swap.
CREATE OR REPLACE FUNCTION public.confirm_trade_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_uid uuid := auth.uid();
  v_s trade_sessions;
  v_both_confirmed boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_s from trade_sessions where id = p_session_id for update;
  if v_s is null then raise exception 'Trade not found'; end if;
  if v_s.status <> 'open' then raise exception 'Trade is no longer open'; end if;
  if v_s.initiator_id <> v_uid and v_s.partner_id <> v_uid then
    raise exception 'Not a participant of this trade';
  end if;
  if not (v_s.initiator_locked and v_s.partner_locked) then
    raise exception 'Both players must lock in first';
  end if;

  if v_s.initiator_id = v_uid then
    v_s.initiator_confirmed := true;
    update trade_sessions set initiator_confirmed = true, updated_at = now() where id = p_session_id;
  else
    v_s.partner_confirmed := true;
    update trade_sessions set partner_confirmed = true, updated_at = now() where id = p_session_id;
  end if;

  v_both_confirmed := v_s.initiator_confirmed and v_s.partner_confirmed;
  if not v_both_confirmed then
    return jsonb_build_object('completed', false);
  end if;

  -- Both confirmed → execute the swap. Lock giver rows (deterministic order),
  -- re-validate ownership under lock, then swap.
  perform 1
  from trade_session_cards sc
  join user_cards uc on uc.user_id = sc.owner_id and uc.card_id = sc.card_id and uc.edition = sc.edition
  where sc.session_id = v_s.id
  order by uc.user_id, uc.card_id, uc.edition
  for update of uc;

  if exists (
    select 1 from trade_session_cards sc
    left join user_cards uc on uc.user_id = sc.owner_id and uc.card_id = sc.card_id and uc.edition = sc.edition
    where sc.session_id = v_s.id and coalesce(uc.count, 0) < sc.quantity
  ) then
    raise exception 'This trade can no longer be completed — a player no longer owns a staged card';
  end if;

  -- Stamp whether each card is new to its receiver (for the reveal), before swap.
  update trade_session_cards sc
  set recipient_new = (coalesce((
    select uc.count from user_cards uc
    where uc.user_id = case when sc.owner_id = v_s.initiator_id then v_s.partner_id else v_s.initiator_id end
      and uc.card_id = sc.card_id and uc.edition = sc.edition
  ), 0) = 0)
  where sc.session_id = v_s.id;

  -- Decrement givers.
  update user_cards uc set count = uc.count - sc.quantity
  from trade_session_cards sc
  where sc.session_id = v_s.id
    and uc.user_id = sc.owner_id and uc.card_id = sc.card_id and uc.edition = sc.edition;

  -- Increment receivers (the other participant).
  insert into user_cards (user_id, card_id, edition, count)
  select case when sc.owner_id = v_s.initiator_id then v_s.partner_id else v_s.initiator_id end,
         sc.card_id, sc.edition, sc.quantity
  from trade_session_cards sc
  where sc.session_id = v_s.id
  on conflict (user_id, card_id, edition) do update set count = user_cards.count + excluded.count;

  -- Permanent audit snapshot (accepted trades only). Staged rows still exist
  -- here; capture each side's cards + player names as jsonb.
  insert into trade_audit (session_id, initiator_id, partner_id, initiator_name, partner_name, initiator_cards, partner_cards)
  values (
    v_s.id, v_s.initiator_id, v_s.partner_id,
    (select full_name from profiles where id = v_s.initiator_id),
    (select full_name from profiles where id = v_s.partner_id),
    coalesce((select jsonb_agg(jsonb_build_object('card_id', c.id, 'name', c.name, 'edition', sc.edition, 'quantity', sc.quantity, 'rarity', c.rarity) order by c.name)
              from trade_session_cards sc join cards c on c.id = sc.card_id
              where sc.session_id = v_s.id and sc.owner_id = v_s.initiator_id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('card_id', c.id, 'name', c.name, 'edition', sc.edition, 'quantity', sc.quantity, 'rarity', c.rarity) order by c.name)
              from trade_session_cards sc join cards c on c.id = sc.card_id
              where sc.session_id = v_s.id and sc.owner_id = v_s.partner_id), '[]'::jsonb)
  );

  update trade_sessions set status = 'completed', updated_at = now() where id = v_s.id;
  return jsonb_build_object('completed', true);
end;
$$;

-- ---- Grants -------------------------------------------------

GRANT EXECUTE ON FUNCTION public.get_my_cards() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trade_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pending_trade_invite_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_trade_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_trade_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_trade_stage(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_trade_lock(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_trade_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_trade_session(uuid) TO authenticated;
