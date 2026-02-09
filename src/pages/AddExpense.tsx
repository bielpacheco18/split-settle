import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFriends } from "@/hooks/useFriends";
import { useExpenses, ExpenseParticipant } from "@/hooks/useExpenses";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus } from "lucide-react";

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
  const [emailSearch, setEmailSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [invitedUsers, setInvitedUsers] = useState<{ id: string; name: string; email: string }[]>([]);

  const handleEmailSearch = async () => {
    const email = emailSearch.trim().toLowerCase();
    if (!email) return;
    if (email === user?.email) {
      toast({ title: "Você já é participante", variant: "destructive" });
      return;
    }
    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast({ title: "Usuário não encontrado", description: "Nenhuma conta com esse email.", variant: "destructive" });
        return;
      }
      if (selectedFriends.includes(data.id) || invitedUsers.some((u) => u.id === data.id)) {
        toast({ title: "Já adicionado", variant: "destructive" });
        return;
      }
      // Check if already a friend
      const isFriend = acceptedFriends.some((f: any) => f.id === data.id);
      if (isFriend) {
        setSelectedFriends((prev) => [...prev, data.id]);
      } else {
        setInvitedUsers((prev) => [...prev, { id: data.id, name: data.name || "Usuário", email: data.email || email }]);
        setSelectedFriends((prev) => [...prev, data.id]);
      }
      setEmailSearch("");
      toast({ title: `${data.name || "Usuário"} adicionado!` });
    } catch (err: any) {
      toast({ title: "Erro na busca", description: err.message, variant: "destructive" });
    } finally {
      setSearchLoading(false);
    }
  };

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
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Buscar por email..."
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleEmailSearch())}
              />
              <Button type="button" size="icon" variant="outline" onClick={handleEmailSearch} disabled={searchLoading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {acceptedFriends.length === 0 && invitedUsers.length === 0 && selectedFriends.length === 0 ? (
              <p className="text-sm text-muted-foreground">Busque por email ou adicione amigos para dividir despesas.</p>
            ) : (
              <>
                {acceptedFriends.map((f: any) => (
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
                ))}
                {invitedUsers
                  .filter((u) => !acceptedFriends.some((f: any) => f.id === u.id))
                  .map((u) => (
                    <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 transition-colors hover:bg-accent/50">
                      <Checkbox
                        checked={selectedFriends.includes(u.id)}
                        onCheckedChange={(checked) => {
                          setSelectedFriends((prev) =>
                            checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                          );
                        }}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs"><UserPlus className="h-3 w-3" /></AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{u.name}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </label>
                  ))}
              </>
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
                  const invited = invitedUsers.find((u) => u.id === id);
                  const name = isMe ? "Você" : friend?.name || invited?.name || "Usuário";
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
