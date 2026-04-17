-- ============================================================
-- GRUPOS DE DESPESAS
-- ============================================================

-- Tabela de grupos
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Membros do grupo
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Vincular despesas a grupos (opcional)
ALTER TABLE public.expenses ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Groups: membros podem ver
CREATE POLICY "members can view group"
ON public.groups FOR SELECT
USING (
  id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  OR created_by = auth.uid()
);

CREATE POLICY "authenticated can create group"
ON public.groups FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "creator can update group"
ON public.groups FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "creator can delete group"
ON public.groups FOR DELETE
USING (auth.uid() = created_by);

-- Group members
CREATE POLICY "members can view group_members"
ON public.group_members FOR SELECT
USING (
  group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  OR group_id IN (SELECT id FROM public.groups WHERE created_by = auth.uid())
);

CREATE POLICY "creator can insert members"
ON public.group_members FOR INSERT
WITH CHECK (
  group_id IN (SELECT id FROM public.groups WHERE created_by = auth.uid())
  OR user_id = auth.uid()
);

CREATE POLICY "creator can delete members"
ON public.group_members FOR DELETE
USING (
  group_id IN (SELECT id FROM public.groups WHERE created_by = auth.uid())
  OR user_id = auth.uid()
);

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
