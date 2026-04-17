import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ActivityType = "expense_created" | "settlement_sent" | "settlement_received";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  timestamp: string;
  // expense fields
  description?: string;
  totalAmount?: number;
  myAmount?: number;
  payerName?: string;
  isMine?: boolean;
  // settlement fields
  amount?: number;
  otherName?: string;
}

export function useActivityFeed(limit = 40) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["activity-feed", user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];

      const [expensesRes, settlementsRes] = await Promise.all([
        supabase
          .from("expenses")
          .select(
            "id, description, total_amount, created_at, paid_by, payer:profiles!expenses_paid_by_fkey(name), expense_participants(user_id, amount_due)"
          )
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("settlements")
          .select(
            "id, amount, settled_at, from_user_id, to_user_id, from_profile:profiles!settlements_from_user_id_fkey(name), to_profile:profiles!settlements_to_user_id_fkey(name)"
          )
          .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
          .order("settled_at", { ascending: false })
          .limit(limit),
      ]);

      const items: ActivityItem[] = [];

      for (const exp of expensesRes.data ?? []) {
        const e = exp as any;
        const isMine = e.paid_by === user.id;
        const myPart = (e.expense_participants ?? []).find((p: any) => p.user_id === user.id);
        const payerName = (e.payer as any)?.name ?? "Alguém";

        items.push({
          id: `exp-${e.id}`,
          type: "expense_created",
          timestamp: e.created_at,
          description: e.description,
          totalAmount: Number(e.total_amount),
          myAmount: myPart ? Number(myPart.amount_due) : undefined,
          payerName,
          isMine,
        });
      }

      for (const s of settlementsRes.data ?? []) {
        const st = s as any;
        const isSent = st.from_user_id === user.id;
        const otherName = isSent
          ? (st.to_profile as any)?.name ?? "Alguém"
          : (st.from_profile as any)?.name ?? "Alguém";

        items.push({
          id: `set-${st.id}`,
          type: isSent ? "settlement_sent" : "settlement_received",
          timestamp: st.settled_at,
          amount: Number(st.amount),
          otherName,
        });
      }

      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return items.slice(0, limit);
    },
  });
}
