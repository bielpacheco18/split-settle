import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFriends } from "@/hooks/useFriends";
import { useExpenses, ExpenseParticipant } from "@/hooks/useExpenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  "alimentação", "transporte", "moradia", "lazer", "saúde", "educação", "compras", "outros",
];

export default function AddExpense() {
  const { user } = useAuth();
  const { acceptedFriends } = useFriends();
  const { createExpense } = useExpenses();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [category, setCategory] = useState("outros");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [splitType, setSplitType] = useState<"equal" | "percentage" | "exact">("equal");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const total = parseFloat(totalAmount) || 0;
  const allParticipantIds = [user!.id, ...selectedFriends];
  const participantCount = allParticipantIds.length;

  const getParticipants = (): ExpenseParticipant[] => {
    if (splitType === "equal") {
      const each = total / participantCount;
      return allParticipantIds.map((id) => ({ user_id: id, amount_due: parseFloat(each.toFixed(2)), split_type: "equal" }));
    }
    if (splitType === "percentage") {
      return allParticipantIds.map((id) => {
        const pct = parseFloat(customAmounts[id] || "0");
        return { user_id: id, amount_due: parseFloat(((total * pct) / 100).toFixed(2)), split_type: "percentage" };
      });
    }
    // exact
    return allParticipantIds.map((id) => ({
      user_id: id,
      amount_due: parseFloat(customAmounts[id] || "0"),
      split_type: "exact",
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || total <= 0) {
      toast({ title: "Preencha os campos", variant: "destructive" });
      return;
    }
    if (selectedFriends.length === 0) {
      toast({ title: "Selecione ao menos um amigo", variant: "destructive" });
      return;
    }

    const participants = getParticipants();
    const sumDue = participants.reduce((s, p) => s + p.amount_due, 0);
    if (Math.abs(sumDue - total) > 0.02) {
      toast({ title: "A soma dos valores não bate com o total", variant: "destructive" });
      return;
    }

    createExpense.mutate(
      { description: description.trim(), total_amount: total, category, expense_date: expenseDate, participants },
      { onSuccess: () => navigate("/") }
    );
  };

  const equalShare = participantCount > 0 ? (total / participantCount).toFixed(2) : "0.00";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nova despesa</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Detalhes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Jantar no restaurante" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor total (R$)</Label>
                <Input type="number" step="0.01" min="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0,00" required />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Participantes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {acceptedFriends.length === 0 ? (
              <p className="text-sm text-muted-foreground">Adicione amigos primeiro para dividir despesas.</p>
            ) : (
              acceptedFriends.map((f: any) => (
                <label key={f.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50">
                  <Checkbox
                    checked={selectedFriends.includes(f.id)}
                    onCheckedChange={(checked) => {
                      setSelectedFriends((prev) =>
                        checked ? [...prev, f.id] : prev.filter((id) => id !== f.id)
                      );
                    }}
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{(f.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{f.name || "Usuário"}</span>
                </label>
              ))
            )}
          </CardContent>
        </Card>

        {selectedFriends.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Divisão</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Select value={splitType} onValueChange={(v) => setSplitType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Igual</SelectItem>
                  <SelectItem value="percentage">Por porcentagem</SelectItem>
                  <SelectItem value="exact">Valores exatos</SelectItem>
                </SelectContent>
              </Select>

              <div className="space-y-2">
                {allParticipantIds.map((id) => {
                  const isMe = id === user!.id;
                  const friend = acceptedFriends.find((f: any) => f.id === id);
                  const name = isMe ? "Você" : friend?.name || "Usuário";
                  return (
                    <div key={id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <span className="text-sm font-medium">{name}</span>
                      {splitType === "equal" ? (
                        <span className="text-sm text-muted-foreground">R$ {equalShare}</span>
                      ) : (
                        <Input
                          type="number"
                          step="0.01"
                          className="w-28"
                          placeholder={splitType === "percentage" ? "%" : "R$"}
                          value={customAmounts[id] || ""}
                          onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [id]: e.target.value }))}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={createExpense.isPending}>
          {createExpense.isPending ? "Salvando..." : "Registrar despesa"}
        </Button>
      </form>
    </div>
  );
}
