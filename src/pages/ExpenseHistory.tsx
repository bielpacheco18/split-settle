import { useState } from "react";
import { useExpenses, useBalances } from "@/hooks/useExpenses";
import { useSettlements } from "@/hooks/useSettlements";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Receipt, CheckCircle, Clock, TrendingUp, Pencil, Trash2, Filter, X, ArrowDownLeft, ArrowUpRight, HandCoins } from "lucide-react";

const CATEGORIES = [
  "alimentação", "transporte", "moradia", "lazer", "saúde", "educação", "compras", "outros",
];

type StatusFilter = "all" | "pending" | "partial" | "settled";

export default function ExpenseHistory() {
  const { user } = useAuth();
  const { expensesQuery, updateExpense, deleteExpense } = useExpenses();
  const { data: balances } = useBalances();
  const { settlementsQuery, deleteSettlement } = useSettlements();
  const expenses = expensesQuery.data ?? [];
  const settlements = settlementsQuery.data ?? [];

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDate, setEditDate] = useState("");

  // Delete confirms
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<any | null>(null);
  const [deleteSettlementTarget, setDeleteSettlementTarget] = useState<any | null>(null);

  const openEdit = (exp: any) => {
    setEditTarget(exp);
    setEditDescription(exp.description);
    setEditAmount(String(exp.total_amount));
    setEditCategory(exp.category);
    setEditDate(exp.expense_date);
  };

  const handleUpdate = () => {
    if (!editTarget) return;
    updateExpense.mutate(
      {
        id: editTarget.id,
        description: editDescription.trim(),
        total_amount: parseFloat(editAmount),
        category: editCategory,
        expense_date: editDate,
      },
      { onSuccess: () => setEditTarget(null) }
    );
  };

  const getExpenseStatus = (exp: any): "settled" | "partial" | "pending" => {
    if (!user) return "pending";
    const isPayer = exp.paid_by === user.id;
    const participants = exp.expense_participants ?? [];

    if (isPayer) {
      const others = participants.filter((p: any) => p.user_id !== user.id);
      if (others.length === 0) return "settled";
      const totalOwedInExpense = others.reduce((s: number, p: any) => s + Number(p.amount_due), 0);
      if (totalOwedInExpense < 0.01) return "settled";
      const allSettled = others.every((p: any) => ((balances ?? {})[p.user_id] ?? null) !== null && ((balances ?? {})[p.user_id] ?? 1) <= 0.01);
      const anySettled = others.some((p: any) => ((balances ?? {})[p.user_id] ?? null) !== null && ((balances ?? {})[p.user_id] ?? 1) <= 0.01);
      if (allSettled) return "settled";
      if (anySettled) return "partial";
      return "pending";
    } else {
      const myPart = participants.find((p: any) => p.user_id === user.id);
      if (!myPart) return "settled";
      const netBalance = (balances ?? {})[exp.paid_by] ?? null;
      if (netBalance === null) return "pending";
      if (netBalance >= -0.01) return "settled";
      if (Math.abs(netBalance) < Number(myPart.amount_due) - 0.01) return "partial";
      return "pending";
    }
  };

  const statusConfig = {
    settled: { label: "Quitada", icon: CheckCircle, className: "bg-success/15 text-success border-success/30" },
    partial: { label: "Parcial", icon: TrendingUp, className: "bg-warning/15 text-warning border-warning/30" },
    pending: { label: "Pendente", icon: Clock, className: "bg-destructive/15 text-destructive border-destructive/30" },
  };

  const filteredExpenses = expenses.filter((exp: any) => {
    if (statusFilter !== "all" && getExpenseStatus(exp) !== statusFilter) return false;
    if (categoryFilter !== "all" && exp.category !== categoryFilter) return false;
    return true;
  });

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (categoryFilter !== "all" ? 1 : 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Histórico</h1>

      <Tabs defaultValue="expenses">
        <TabsList className="w-full">
          <TabsTrigger value="expenses" className="flex-1">
            Despesas
            {expenses.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({expenses.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="settlements" className="flex-1">
            Pagamentos
            {settlements.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({settlements.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── DESPESAS ── */}
        <TabsContent value="expenses" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{filteredExpenses.length} resultado{filteredExpenses.length !== 1 ? "s" : ""}</span>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="h-4 w-4" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <Card>
              <CardContent className="flex flex-wrap gap-4 p-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="partial">Parcial</SelectItem>
                      <SelectItem value="settled">Quitada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-8 w-40 text-xs capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {activeFilterCount > 0 && (
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs text-muted-foreground"
                      onClick={() => { setStatusFilter("all"); setCategoryFilter("all"); }}
                    >
                      <X className="h-3 w-3" /> Limpar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {expenses.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Receipt className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhuma despesa registrada ainda.</p>
              </CardContent>
            </Card>
          )}

          {expenses.length > 0 && filteredExpenses.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Filter className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhuma despesa corresponde aos filtros.</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {filteredExpenses.map((exp: any) => {
              const isPayer = exp.paid_by === user?.id;
              const myParticipation = exp.expense_participants?.find((p: any) => p.user_id === user?.id);
              const status = getExpenseStatus(exp);
              const { label, icon: StatusIcon, className: statusClass } = statusConfig[status];

              return (
                <Card key={exp.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0 pr-2">
                        <div className="flex flex-wrap items-center gap-2">
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
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold">R$ {Number(exp.total_amount).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {isPayer ? "Você pagou" : "Pago por outro"}
                        </p>
                        {myParticipation && (
                          <p className="text-sm text-muted-foreground">
                            Sua parte: R$ {Number(myParticipation.amount_due).toFixed(2)}
                          </p>
                        )}
                        {isPayer && (
                          <div className="mt-2 flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => openEdit(exp)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteExpenseTarget(exp)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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
        </TabsContent>

        {/* ── PAGAMENTOS / SETTLEMENTS ── */}
        <TabsContent value="settlements" className="space-y-3 mt-4">
          {settlements.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <HandCoins className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum pagamento registrado ainda.</p>
              </CardContent>
            </Card>
          )}
          {settlements.map((s: any) => {
            const isPayer = s.from_user_id === user?.id;
            const otherProfile = isPayer ? s.to_profile : s.from_profile;
            const otherName = otherProfile?.name || "Usuário";

            return (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isPayer ? "bg-destructive/15" : "bg-success/15"}`}>
                      {isPayer
                        ? <ArrowUpRight className="h-4 w-4 text-destructive" />
                        : <ArrowDownLeft className="h-4 w-4 text-success" />
                      }
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {isPayer ? `Você pagou ${otherName}` : `${otherName} te pagou`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(s.settled_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${isPayer ? "text-destructive" : "text-success"}`}>
                      {isPayer ? "-" : "+"}R$ {Number(s.amount).toFixed(2)}
                    </span>
                    {isPayer && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteSettlementTarget(s)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Edit Expense Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar despesa</DialogTitle>
            <DialogDescription>Altere os dados da despesa. Os participantes não são alterados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor total (R$)</Label>
                <Input type="number" step="0.01" min="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={updateExpense.isPending}>
              {updateExpense.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Expense Confirm */}
      <AlertDialog open={!!deleteExpenseTarget} onOpenChange={(open) => !open && setDeleteExpenseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteExpenseTarget?.description}" será excluída permanentemente. Os saldos serão recalculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteExpense.mutate(deleteExpenseTarget.id);
                setDeleteExpenseTarget(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Settlement Confirm */}
      <AlertDialog open={!!deleteSettlementTarget} onOpenChange={(open) => !open && setDeleteSettlementTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O pagamento de R$ {Number(deleteSettlementTarget?.amount ?? 0).toFixed(2)} será removido e o saldo recalculado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteSettlement.mutate(deleteSettlementTarget.id);
                setDeleteSettlementTarget(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
