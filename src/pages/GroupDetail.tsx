import { useParams, useNavigate, Link } from "react-router-dom";
import { useGroupDetail, useGroups } from "@/hooks/useGroups";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, PlusCircle, Users, Receipt, TrendingUp, TrendingDown } from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/components/PageTransition";

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { groupsQuery } = useGroups();
  const { membersQuery, expensesQuery, myBalances } = useGroupDetail(id);

  const group = groupsQuery.data?.find((g) => g.id === id);
  const members = membersQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];

  const totalExpenses = expenses.reduce((s, e) => s + e.total_amount, 0);
  const myTotal = expenses.reduce((s, e) => {
    const part = e.expense_participants.find((p) => p.user_id === user?.id);
    return s + (part?.amount_due ?? 0);
  }, 0);

  const memberMap = Object.fromEntries(
    members.map((m) => [m.user_id, m.profiles?.name ?? "Usuário"])
  );

  return (
    <StaggerContainer className="space-y-6">
      {/* Header */}
      <StaggerItem>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/groups")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{group?.name ?? "Grupo"}</h1>
            {group?.description && (
              <p className="text-sm text-muted-foreground">{group.description}</p>
            )}
          </div>
        </div>
      </StaggerItem>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <StaggerItem>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total do grupo</p>
              <p className="text-lg font-bold text-foreground">R$ {totalExpenses.toFixed(2)}</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Minha parte</p>
              <p className="text-lg font-bold text-primary">R$ {myTotal.toFixed(2)}</p>
            </CardContent>
          </Card>
        </StaggerItem>
      </div>

      {/* My balances with group members */}
      {Object.keys(myBalances).length > 0 && (
        <StaggerItem>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Seus saldos no grupo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(myBalances).map(([uid, amount]) => {
                const name = memberMap[uid] ?? "Usuário";
                return (
                  <div key={uid} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">{amount > 0 ? "te deve" : "você deve"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {amount > 0
                        ? <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                        : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                      <span className={`font-semibold text-sm ${amount > 0 ? "text-green-500" : "text-destructive"}`}>
                        R$ {Math.abs(amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </StaggerItem>
      )}

      {/* Members */}
      <StaggerItem>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Membros ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px]">
                      {(m.profiles?.name ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">
                    {m.user_id === user?.id ? "Você" : m.profiles?.name ?? "Usuário"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Add expense button */}
      <StaggerItem>
        <Link to={`/add-expense?group=${id}`}>
          <Button className="w-full gap-2" size="lg">
            <PlusCircle className="h-5 w-5" />
            Adicionar despesa ao grupo
          </Button>
        </Link>
      </StaggerItem>

      {/* Expenses */}
      <StaggerItem>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Despesas ({expenses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {expensesQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma despesa ainda. Adicione a primeira!
              </p>
            ) : (
              <div className="space-y-2">
                {expenses.map((expense) => {
                  const payerName = expense.paid_by === user?.id
                    ? "Você"
                    : memberMap[expense.paid_by] ?? "Alguém";
                  const myPart = expense.expense_participants.find((p) => p.user_id === user?.id);
                  return (
                    <div key={expense.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{expense.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {expense.expense_date} · pago por {payerName}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-semibold">R$ {expense.total_amount.toFixed(2)}</p>
                        {myPart && (
                          <p className="text-xs text-muted-foreground">
                            sua parte: R$ {myPart.amount_due.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>
    </StaggerContainer>
  );
}
