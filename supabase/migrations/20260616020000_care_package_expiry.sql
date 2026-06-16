-- ============================================================
-- Care package refinements:
--  1. Packages expire 1 day after they are sent (unopened + expired
--     packages can no longer be claimed and are cleared on the next send).
--  2. Sending a new package to a user replaces any existing unopened one,
--     so a user holds at most one active care package at a time.
-- ============================================================

-- Expiry column: 1 day after creation.
ALTER TABLE gruten_packages ADD COLUMN IF NOT EXISTS expires_at timestamptz;
UPDATE gruten_packages SET expires_at = created_at + interval '1 day' WHERE expires_at IS NULL;
ALTER TABLE gruten_packages ALTER COLUMN expires_at SET DEFAULT now() + interval '1 day';
ALTER TABLE gruten_packages ALTER COLUMN expires_at SET NOT NULL;

-- Admin sends a care package. p_user_id NULL => every non-admin player.
-- Any existing unopened package for the recipient(s) is replaced.
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
  if p_amount > 1000000 then
    raise exception 'Amount too large';
  end if;

  if p_user_id is null then
    -- Replace existing unopened packages for every non-admin, then send anew.
    delete from gruten_packages gp
      using profiles p
      where gp.user_id = p.id and p.role <> 'admin' and gp.opened_at is null;
    insert into gruten_packages (user_id, amount, sent_by)
    select id, p_amount, auth.uid() from profiles where role <> 'admin';
    get diagnostics v_count = row_count;
  else
    delete from gruten_packages where user_id = p_user_id and opened_at is null;
    insert into gruten_packages (user_id, amount, sent_by)
    values (p_user_id, p_amount, auth.uid());
    v_count := 1;
  end if;

  return jsonb_build_object('sent', v_count, 'amount', p_amount);
end;
$$;

-- Recipient opens their unopened, unexpired package(s).
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

  -- Atomically claim every unopened, unexpired package and total it.
  with opened as (
    update gruten_packages set opened_at = now()
    where user_id = v_user_id and opened_at is null and expires_at > now()
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
