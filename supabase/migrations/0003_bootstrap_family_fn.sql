-- =============================================================
-- Migration: 0003_bootstrap_family_fn.sql
-- Creates a SECURITY DEFINER RPC that atomically creates a family
-- and inserts the calling user as owner.
--
-- Required because family_members INSERT policy checks has_family_role(),
-- which is circular for a brand-new user with no existing memberships.
-- This function bypasses RLS safely — only callable by authenticated users;
-- no service_role exposure on the client.
-- =============================================================

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

  -- Create the family
  insert into families (name, owner_id)
  values (p_name, auth.uid())
  returning id into v_family_id;

  -- Add the caller as owner (bypasses RLS — that's the point of SECURITY DEFINER)
  insert into family_members (family_id, user_id, role)
  values (v_family_id, auth.uid(), 'owner');

  return v_family_id;
end;
$$;
