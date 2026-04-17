import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  member_count?: number;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  profiles: { id: string; name: string; email: string | null };
}

export interface GroupExpense {
  id: string;
  description: string;
  total_amount: number;
  category: string;
  expense_date: string;
  paid_by: string;
  group_id: string | null;
  expense_participants: {
    user_id: string;
    amount_due: number;
    split_type: string;
    profiles: { id: string; name: string } | null;
  }[];
}

export function useGroups() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const groupsQuery = useQuery({
    queryKey: ["groups", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups" as any)
        .select(`
          id, name, description, created_by, created_at,
          group_members(count)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((g: any) => ({
        ...g,
        member_count: g.group_members?.[0]?.count ?? 0,
      })) as Group[];
    },
  });

  const createGroup = useMutation({
    mutationFn: async ({ name, description, memberIds }: { name: string; description?: string; memberIds: string[] }) => {
      if (!user) throw new Error("Não autenticado");

      const { data: group, error: gErr } = await supabase
        .from("groups" as any)
        .insert({ name, description: description || null, created_by: user.id })
        .select()
        .single();
      if (gErr) throw gErr;

      // Add creator + selected members
      const allMembers = Array.from(new Set([user.id, ...memberIds]));
      const { error: mErr } = await supabase
        .from("group_members" as any)
        .insert(allMembers.map((uid) => ({ group_id: (group as any).id, user_id: uid })));
      if (mErr) throw mErr;

      return group as any as Group;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  });

  const deleteGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from("groups" as any).delete().eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  });

  return { groupsQuery, createGroup, deleteGroup };
}

export function useGroupDetail(groupId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ["group-members", groupId],
    enabled: !!groupId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members" as any)
        .select("id, group_id, user_id, joined_at, profiles(id, name, email)")
        .eq("group_id", groupId!);
      if (error) throw error;
      return (data ?? []) as GroupMember[];
    },
  });

  const expensesQuery = useQuery({
    queryKey: ["group-expenses", groupId],
    enabled: !!groupId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          id, description, total_amount, category, expense_date, paid_by, group_id,
          expense_participants(user_id, amount_due, split_type, profiles(id, name))
        `)
        .eq("group_id", groupId!)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GroupExpense[];
    },
  });

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("group_members" as any)
        .insert({ group_id: groupId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group-members", groupId] }),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("group_members" as any)
        .delete()
        .eq("group_id", groupId!)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group-members", groupId] }),
  });

  // Calculate balances between all group members
  const balances = (() => {
    if (!user || !expensesQuery.data || !membersQuery.data) return {};
    const members = membersQuery.data.map((m) => m.user_id);
    // net[a][b] = how much a owes b (positive = a owes b)
    const net: Record<string, Record<string, number>> = {};
    for (const uid of members) net[uid] = {};

    for (const expense of expensesQuery.data) {
      const payer = expense.paid_by;
      for (const p of expense.expense_participants) {
        if (p.user_id === payer) continue;
        // p.user_id owes payer
        if (!net[p.user_id]) net[p.user_id] = {};
        if (!net[payer]) net[payer] = {};
        net[p.user_id][payer] = (net[p.user_id][payer] ?? 0) + p.amount_due;
        net[payer][p.user_id] = (net[payer][p.user_id] ?? 0) - p.amount_due;
      }
    }
    return net;
  })();

  // Simplified: return my balances with each member
  const myBalances: Record<string, number> = {};
  if (user && balances[user.id]) {
    for (const [uid, amount] of Object.entries(balances[user.id])) {
      if (Math.abs(amount) > 0.01) myBalances[uid] = -amount; // positive = they owe me
    }
  }

  return { membersQuery, expensesQuery, addMember, removeMember, myBalances };
}
