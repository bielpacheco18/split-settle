-- Fix: infinite recursion in group_members RLS policies
-- The SELECT policy was querying group_members from within group_members (recursion)
-- Solution: use a SECURITY DEFINER function that bypasses RLS

-- Remove recursive policies
DROP POLICY IF EXISTS "members can view group_members" ON public.group_members;
DROP POLICY IF EXISTS "creator can insert members" ON public.group_members;
DROP POLICY IF EXISTS "creator can delete members" ON public.group_members;
DROP POLICY IF EXISTS "members can view group" ON public.groups;

-- Function that checks membership WITHOUT triggering RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

-- group_members: SELECT — usa a função para evitar recursão
CREATE POLICY "members can view group_members"
ON public.group_members FOR SELECT
USING (
  public.is_group_member(group_id, auth.uid())
  OR group_id IN (SELECT id FROM public.groups WHERE created_by = auth.uid())
);

-- group_members: INSERT
CREATE POLICY "creator can insert members"
ON public.group_members FOR INSERT
WITH CHECK (
  group_id IN (SELECT id FROM public.groups WHERE created_by = auth.uid())
  OR user_id = auth.uid()
);

-- group_members: DELETE
CREATE POLICY "creator can delete members"
ON public.group_members FOR DELETE
USING (
  group_id IN (SELECT id FROM public.groups WHERE created_by = auth.uid())
  OR user_id = auth.uid()
);

-- groups: SELECT — também usa a função
CREATE POLICY "members can view group"
ON public.groups FOR SELECT
USING (
  public.is_group_member(id, auth.uid())
  OR created_by = auth.uid()
);
