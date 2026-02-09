
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Friendships table
CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted');

CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT friendships_different_users CHECK (user_id_1 <> user_id_2),
  UNIQUE (user_id_1, user_id_2)
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  category TEXT NOT NULL DEFAULT 'outros',
  paid_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Expense participants
CREATE TYPE public.split_type AS ENUM ('equal', 'percentage', 'exact');

CREATE TABLE public.expense_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  split_type public.split_type NOT NULL DEFAULT 'equal',
  UNIQUE (expense_id, user_id)
);
ALTER TABLE public.expense_participants ENABLE ROW LEVEL SECURITY;

-- Settlements (pagamentos)
CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settlements_different_users CHECK (from_user_id <> to_user_id)
);
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Helper function: check friendship
CREATE OR REPLACE FUNCTION public.is_friend(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((user_id_1 = user_a AND user_id_2 = user_b)
        OR (user_id_1 = user_b AND user_id_2 = user_a))
  );
$$;

-- Helper: check expense participant
CREATE OR REPLACE FUNCTION public.is_expense_participant(p_expense_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.expense_participants
    WHERE expense_id = p_expense_id AND user_id = p_user_id
  );
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can view friends profiles" ON public.profiles FOR SELECT USING (public.is_friend(id, auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- Friendships
CREATE POLICY "Users can view own friendships" ON public.friendships FOR SELECT USING (user_id_1 = auth.uid() OR user_id_2 = auth.uid());
CREATE POLICY "Users can create friendships" ON public.friendships FOR INSERT WITH CHECK (requested_by = auth.uid() AND (user_id_1 = auth.uid() OR user_id_2 = auth.uid()));
CREATE POLICY "Users can update own friendships" ON public.friendships FOR UPDATE USING (user_id_1 = auth.uid() OR user_id_2 = auth.uid());
CREATE POLICY "Users can delete own friendships" ON public.friendships FOR DELETE USING (user_id_1 = auth.uid() OR user_id_2 = auth.uid());

-- Expenses
CREATE POLICY "Participants can view expenses" ON public.expenses FOR SELECT USING (public.is_expense_participant(id, auth.uid()) OR paid_by = auth.uid());
CREATE POLICY "Users can create expenses" ON public.expenses FOR INSERT WITH CHECK (paid_by = auth.uid());
CREATE POLICY "Payer can update expenses" ON public.expenses FOR UPDATE USING (paid_by = auth.uid());
CREATE POLICY "Payer can delete expenses" ON public.expenses FOR DELETE USING (paid_by = auth.uid());

-- Expense participants
CREATE POLICY "Participants can view" ON public.expense_participants FOR SELECT USING (public.is_expense_participant(expense_id, auth.uid()));
CREATE POLICY "Expense creator can manage participants" ON public.expense_participants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.expenses WHERE id = expense_id AND paid_by = auth.uid())
);
CREATE POLICY "Expense creator can update participants" ON public.expense_participants FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.expenses WHERE id = expense_id AND paid_by = auth.uid())
);
CREATE POLICY "Expense creator can delete participants" ON public.expense_participants FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.expenses WHERE id = expense_id AND paid_by = auth.uid())
);

-- Settlements
CREATE POLICY "Users can view own settlements" ON public.settlements FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
CREATE POLICY "Users can create settlements" ON public.settlements FOR INSERT WITH CHECK (from_user_id = auth.uid());
CREATE POLICY "Users can delete own settlements" ON public.settlements FOR DELETE USING (from_user_id = auth.uid());
