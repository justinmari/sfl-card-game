-- ============================================================
-- Gruten care packages: admins send a package to one user or all
-- players; recipients open it (like the daily claim) to collect Gruten.
-- ============================================================

CREATE TABLE IF NOT EXISTS gruten_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gruten_packages_user_unopened
  ON gruten_packages(user_id) WHERE opened_at IS NULL;

GRANT ALL ON TABLE public.gruten_packages TO anon, authenticated, service_role;

-- RLS: a user reads their own packages; admins read all. No direct writes —
-- everything goes through the SECURITY DEFINER RPCs below.
ALTER TABLE gruten_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own packages" ON gruten_packages;
CREATE POLICY "Users read own packages"
  ON gruten_packages FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Allow the new transaction type used when a package is opened.
ALTER TABLE gruten_transactions DROP CONSTRAINT IF EXISTS gruten_transactions_type_check;
ALTER TABLE gruten_transactions ADD CONSTRAINT gruten_transactions_type_check
  CHECK (type IN ('pack_purchase', 'admin_grant', 'daily_claim', 'arena_reward', 'card_scrap', 'care_package'));

-- Admin sends a care package. p_user_id NULL => every non-admin player.
CREATE OR REPLACE FUNCTION admin_send_care_package(p_user_id uuid, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_admin record;
  v_count int;
begin
  select * into v_admin from profiles where id = auth.uid() and role = 'admin';
  if v_admin is null then
    raise exception 'Not authorized';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  if p_user_id is null then
    insert into gruten_packages (user_id, amount, sent_by)
    select id, p_amount, auth.uid() from profiles where role <> 'admin';
    get diagnostics v_count = row_count;
  else
    insert into gruten_packages (user_id, amount, sent_by)
    values (p_user_id, p_amount, auth.uid());
    v_count := 1;
  end if;

  return jsonb_build_object('sent', v_count, 'amount', p_amount);
end;
$$;

-- Recipient opens all of their unopened packages at once.
CREATE OR REPLACE FUNCTION open_gruten_packages()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_total int;
  v_count int;
  v_new_balance int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from profiles where id = v_user_id for update;
  if v_profile is null then
    raise exception 'Profile not found';
  end if;

  -- Atomically claim every unopened package and total it.
  with opened as (
    update gruten_packages set opened_at = now()
    where user_id = v_user_id and opened_at is null
    returning amount
  )
  select coalesce(sum(amount), 0), count(*) into v_total, v_count from opened;

  if v_count = 0 then
    raise exception 'No packages to open';
  end if;

  if v_profile.gruten != -1 then
    v_new_balance := v_profile.gruten + v_total;
    update profiles set gruten = v_new_balance where id = v_user_id;
  else
    v_new_balance := -1;
  end if;

  insert into gruten_transactions (user_id, type, amount, balance_after, metadata)
  values (v_user_id, 'care_package', v_total, v_new_balance, jsonb_build_object('packages', v_count));

  return jsonb_build_object('opened', v_count, 'amount', v_total, 'gruten', v_new_balance);
end;
$$;
