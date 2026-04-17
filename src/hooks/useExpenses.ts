import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface ExpenseParticipant {
  user_id: string;
  amount_due: number;
  split_type: "equal" | "percentage" | "exact";
}

export function useExpenses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const expensesQuery = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("*, expense_participants(*, profiles(*))")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const createExpense = useMutation({
    mutationFn: async ({
      description,
      total_amount,
      category,
      expense_date,
      participants,
      group_id,
    }: {
      description: string;
      total_amount: number;
      category: string;
      expense_date: string;
      participants: ExpenseParticipant[];
      group_id?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: expense, error: expError } = await supabase
        .from("expenses")
        .insert({ description, total_amount, category, expense_date, paid_by: user.id, ...(group_id ? { group_id } : {}) })
        .select()
        .single();
      if (expError) throw expError;

      const participantRows = participants.map((p) => ({
        expense_id: expense.id,
        user_id: p.user_id,
        amount_due: p.amount_due,
        split_type: p.split_type,
      }));
      const { error: partError } = await supabase.from("expense_participants").insert(participantRows);
      if (partError) throw partError;

      return expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      toast({ title: "Despesa registrada!" });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateExpense = useMutation({
    mutationFn: async ({
      id,
      description,
      total_amount,
      category,
      expense_date,
    }: {
      id: string;
      description: string;
      total_amount: number;
      category: string;
      expense_date: string;
    }) => {
      const { error } = await supabase
        .from("expenses")
        .update({ description, total_amount, category, expense_date })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      toast({ title: "Despesa atualizada!" });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      toast({ title: "Despesa excluída." });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  return { expensesQuery, createExpense, updateExpense, deleteExpense };
}

export function useBalances() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["balances", user?.id],
    queryFn: async () => {
      if (!user) return {};

      const { data: expenses } = await supabase
        .from("expenses")
        .select("*, expense_participants(*)");

      const { data: settlements } = await supabase
        .from("settlements")
        .select("*");

      const balances: Record<string, number> = {};

      (expenses ?? []).forEach((exp: any) => {
        const participants = exp.expense_participants ?? [];
        if (exp.paid_by === user.id) {
          participants.forEach((p: any) => {
            if (p.user_id !== user.id) {
              balances[p.user_id] = (balances[p.user_id] ?? 0) + Number(p.amount_due);
            }
          });
        } else {
          const myPart = participants.find((p: any) => p.user_id === user.id);
          if (myPart) {
            balances[exp.paid_by] = (balances[exp.paid_by] ?? 0) - Number(myPart.amount_due);
          }
        }
      });

      (settlements ?? []).forEach((s: any) => {
        if (s.from_user_id === user.id) {
          balances[s.to_user_id] = (balances[s.to_user_id] ?? 0) + Number(s.amount);
        } else if (s.to_user_id === user.id) {
          balances[s.from_user_id] = (balances[s.from_user_id] ?? 0) - Number(s.amount);
        }
      });

      return balances;
    },
    enabled: !!user,
  });
}
