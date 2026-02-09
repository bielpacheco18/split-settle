import { useExpenses } from "@/hooks/useExpenses";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Receipt } from "lucide-react";

export default function ExpenseHistory() {
  const { user } = useAuth();
  const { expensesQuery } = useExpenses();
  const expenses = expensesQuery.data ?? [];

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
          return (
            <Card key={exp.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold">{exp.description}</p>
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
