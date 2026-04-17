import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const REACTION_EMOJIS = ["👍", "✅", "😅", "💸", "🙏"] as const;

export interface Reaction {
  id: string;
  expense_id: string;
  user_id: string;
  emoji: string;
  profiles?: { name: string } | null;
}

// Grouped: { "👍": [{ user_id, name }], ... }
export type ReactionsMap = Record<string, { user_id: string; name: string }[]>;

export function useReactions(expenseIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const reactionsQuery = useQuery({
    queryKey: ["reactions", expenseIds.join(",")],
    enabled: expenseIds.length > 0 && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_reactions" as any)
        .select("id, expense_id, user_id, emoji, profiles(name)")
        .in("expense_id", expenseIds);
      if (error) throw error;
      return (data ?? []) as Reaction[];
    },
  });

  // Group by expense_id then emoji
  const byExpense: Record<string, ReactionsMap> = {};
  for (const r of reactionsQuery.data ?? []) {
    if (!byExpense[r.expense_id]) byExpense[r.expense_id] = {};
    if (!byExpense[r.expense_id][r.emoji]) byExpense[r.expense_id][r.emoji] = [];
    byExpense[r.expense_id][r.emoji].push({
      user_id: r.user_id,
      name: (r.profiles as any)?.name ?? "Usuário",
    });
  }

  const toggleReaction = useMutation({
    mutationFn: async ({ expenseId, emoji }: { expenseId: string; emoji: string }) => {
      if (!user) throw new Error("Not authenticated");

      const existing = reactionsQuery.data?.find(
        (r) => r.expense_id === expenseId && r.emoji === emoji && r.user_id === user.id
      );

      if (existing) {
        const { error } = await supabase
          .from("expense_reactions" as any)
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("expense_reactions" as any)
          .insert({ expense_id: expenseId, user_id: user.id, emoji });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reactions"] });
    },
  });

  return { byExpense, toggleReaction, isLoading: reactionsQuery.isLoading };
}
