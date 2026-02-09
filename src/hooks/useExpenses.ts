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
    }: {
      description: string;
      total_amount: number;
      category: string;
      expense_date: string;
      participants: ExpenseParticipant[];
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: expense, error: expError } = await supabase
        .from("expenses")
        .insert({
          description,
          total_amount,
          category,
          expense_date,
          paid_by: user.id,
        })
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

  return { expensesQuery, createExpense };
}

export function useBalances() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["balances", user?.id],
    queryFn: async () => {
      if (!user) return {};

      // Get all expenses where user is payer or participant
      const { data: expenses } = await supabase
        .from("expenses")
        .select("*, expense_participants(*)");

      // Get all settlements
      const { data: settlements } = await supabase
        .from("settlements")
        .select("*");

      const balances: Record<string, number> = {};

      // Process expenses
      (expenses ?? []).forEach((exp: any) => {
        const participants = exp.expense_participants ?? [];
        if (exp.paid_by === user.id) {
          // I paid — others owe me
          participants.forEach((p: any) => {
            if (p.user_id !== user.id) {
              balances[p.user_id] = (balances[p.user_id] ?? 0) + Number(p.amount_due);
            }
          });
        } else {
          // Someone else paid — I might owe them
          const myPart = participants.find((p: any) => p.user_id === user.id);
          if (myPart) {
            balances[exp.paid_by] = (balances[exp.paid_by] ?? 0) - Number(myPart.amount_due);
          }
        }
      });

      // Process settlements
      (settlements ?? []).forEach((s: any) => {
        if (s.from_user_id === user.id) {
          // I paid someone
          balances[s.to_user_id] = (balances[s.to_user_id] ?? 0) + Number(s.amount);
        } else if (s.to_user_id === user.id) {
          // Someone paid me
          balances[s.from_user_id] = (balances[s.from_user_id] ?? 0) - Number(s.amount);
        }
      });

      return balances;
    },
    enabled: !!user,
  });
}
