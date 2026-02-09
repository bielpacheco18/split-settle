import { useExpenses, useBalances } from "@/hooks/useExpenses";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Receipt, CheckCircle, Clock } from "lucide-react";

export default function ExpenseHistory() {
  const { user } = useAuth();
  const { expensesQuery } = useExpenses();
  const expenses = expensesQuery.data ?? [];

  // Fetch all settlements involving the user to calculate settled amounts per friend
  const { data: settlements } = useQuery({
    queryKey: ["settlements", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("settlements")
        .select("*")
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order("settled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Build a map of total settled amounts per friend pair
  const settledByFriend: Record<string, number> = {};
  (settlements ?? []).forEach((s: any) => {
    const otherId = s.from_user_id === user?.id ? s.to_user_id : s.from_user_id;
    settledByFriend[otherId] = (settledByFriend[otherId] ?? 0) + Number(s.amount);
  });

  // For each expense, determine if the user's portion is effectively settled
  // by checking if the cumulative settlements cover the amounts
  const getExpenseStatus = (exp: any): "settled" | "partial" | "pending" => {
    if (!user) return "pending";
    const isPayer = exp.paid_by === user.id;
    const participants = exp.expense_participants ?? [];

    if (isPayer) {
      // Others owe me - check if all participants have settled
      const othersOwing = participants.filter((p: any) => p.user_id !== user.id);
      if (othersOwing.length === 0) return "settled";
      const totalOwed = othersOwing.reduce((s: number, p: any) => s + Number(p.amount_due), 0);
      // Use balance: if balance with all those friends is ~0, it's settled
      const totalSettled = othersOwing.reduce((s: number, p: any) => s + (settledByFriend[p.user_id] ?? 0), 0);
      if (totalSettled >= totalOwed - 0.02) return "settled";
      if (totalSettled > 0) return "partial";
      return "pending";
    } else {
      // I owe the payer
      const myPart = participants.find((p: any) => p.user_id === user.id);
      if (!myPart) return "settled";
      const amountDue = Number(myPart.amount_due);
      const settled = settledByFriend[exp.paid_by] ?? 0;
      if (settled >= amountDue - 0.02) return "settled";
      if (settled > 0) return "partial";
      return "pending";
    }
  };

  const statusConfig = {
    settled: { label: "Quitada", icon: CheckCircle, className: "bg-success/15 text-success border-success/30" },
    partial: { label: "Parcial", icon: Clock, className: "bg-warning/15 text-warning border-warning/30" },
    pending: { label: "Pendente", icon: Clock, className: "bg-destructive/15 text-destructive border-destructive/30" },
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Histórico</h1>

      {expenses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Receipt className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma despesa registrada ainda.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {expenses.map((exp: any) => {
          const isPayer = exp.paid_by === user?.id;
          const myParticipation = exp.expense_participants?.find((p: any) => p.user_id === user?.id);
          const status = getExpenseStatus(exp);
          const { label, icon: StatusIcon, className: statusClass } = statusConfig[status];

          return (
            <Card key={exp.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{exp.description}</p>
                      <Badge variant="outline" className={`gap-1 text-xs ${statusClass}`}>
                        <StatusIcon className="h-3 w-3" />
                        {label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(exp.expense_date), "dd MMM yyyy", { locale: ptBR })}
                    </p>
                    <Badge variant="secondary" className="capitalize">{exp.category}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">R$ {Number(exp.total_amount).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {isPayer ? "Você pagou" : "Pago por outro"}
                    </p>
                    {myParticipation && (
                      <p className="text-sm text-muted-foreground">
                        Sua parte: R$ {Number(myParticipation.amount_due).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                {exp.expense_participants && exp.expense_participants.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {exp.expense_participants.map((p: any) => (
                      <Badge key={p.id} variant="outline" className="text-xs">
                        {p.profiles?.name || "Usuário"}: R$ {Number(p.amount_due).toFixed(2)}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
