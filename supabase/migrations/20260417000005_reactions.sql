CREATE TABLE public.expense_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(expense_id, user_id, emoji)
);

ALTER TABLE public.expense_reactions ENABLE ROW LEVEL SECURITY;

-- Participantes da despesa podem ver as reações
CREATE POLICY "participants can view reactions"
ON public.expense_reactions FOR SELECT
USING (
  expense_id IN (
    SELECT expense_id FROM public.expense_participants WHERE user_id = auth.uid()
  )
  OR expense_id IN (
    SELECT id FROM public.expenses WHERE paid_by = auth.uid()
  )
);

-- Usuário autenticado pode reagir a despesas que participa
CREATE POLICY "participants can add reactions"
ON public.expense_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    expense_id IN (
      SELECT expense_id FROM public.expense_participants WHERE user_id = auth.uid()
    )
    OR expense_id IN (
      SELECT id FROM public.expenses WHERE paid_by = auth.uid()
    )
  )
);

-- Usuário pode remover própria reação
CREATE POLICY "user can delete own reaction"
ON public.expense_reactions FOR DELETE
USING (auth.uid() = user_id);
