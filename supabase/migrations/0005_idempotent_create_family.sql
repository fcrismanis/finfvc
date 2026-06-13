-- 0005_idempotent_create_family.sql
-- ─────────────────────────────────────────────────────────────
-- Makes create_family_for_user() idempotent.
--
-- Before: each call inserted a new family + membership. AuthContext only calls
-- it when no membership is found, but a race (two tabs, double-mount, retry)
-- could call it twice and create a SECOND family for the same user.
--
-- After: if the caller already belongs to a family, return that family_id and
-- skip creation. This is the RPC's own guard, complementing the client check.
-- It only reads the caller's own membership (auth.uid()), so no security change.
--
-- Residual: two truly-concurrent first-calls could still both pass the guard
-- before either inserts (narrow window). Acceptable for beta; a unique
-- constraint is intentionally NOT added because a user may legitimately belong
-- to multiple families in the future (shared family plans).
-- ─────────────────────────────────────────────────────────────

create or replace function public.create_family_for_user(p_name text default 'Minha Família')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Idempotency guard: reuse the caller's existing family if any
  select family_id into v_family_id
  from family_members
  where user_id = auth.uid()
  limit 1;

  if v_family_id is not null then
    return v_family_id;
  end if;

  insert into families (name, owner_id)
  values (p_name, auth.uid())
  returning id into v_family_id;

  insert into family_members (family_id, user_id, role)
  values (v_family_id, auth.uid(), 'owner');

  return v_family_id;
end;
$$;
