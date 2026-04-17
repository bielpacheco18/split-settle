import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Search, UserPlus, Send, UsersRound, Camera, X, Sparkles } from "lucide-react";
import { useGroupDetail } from "@/hooks/useGroups";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string;
const CATEGORIES = ["alimentação", "transporte", "moradia", "lazer", "saúde", "educação", "compras", "outros"];

async function extractReceiptData(base64Image: string, mimeType: string) {
  if (!GROQ_API_KEY) throw new Error("VITE_GROQ_API_KEY não configurada");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.2-11b-vision-preview",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            {
              type: "text",
              text: `Analise este comprovante/nota fiscal e extraia as informações. Responda SOMENTE em JSON válido, sem markdown:
{"description":"nome do estabelecimento ou produto principal","total_amount":0.00,"category":"uma de: alimentação/transporte/moradia/lazer/saúde/educação/compras/outros","expense_date":"YYYY-MM-DD ou null se não visível"}`,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Groq Vision: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";

  // Extract JSON from response
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("IA não retornou JSON válido");
  return JSON.parse(match[0]) as {
    description: string;
    total_amount: number;
    category: string;
    expense_date: string | null;
  };
}

function sendInvite(toEmail: string, fromEmail: string) {
  const appUrl = window.location.origin;
  const text = `Oi! Te convido para usar o SplitEasy — o app para dividir despesas com amigos.\n\nBaixe aqui: ${appUrl}\n\nDepois de criar sua conta, me adicione pelo email: ${fromEmail}`;
  if (navigator.share) {
    navigator.share({ title: "Convite SplitEasy", text }).catch(() => {});
  } else {
    window.open(`mailto:${toEmail}?subject=${encodeURIComponent("Convite para o SplitEasy")}&body=${encodeURIComponent(text)}`, "_blank");
  }
}

export default function AddExpense() {
  const { user } = useAuth();
  const { acceptedFriends } = useFriends();
  const { createExpense } = useExpenses();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get("group") ?? undefined;
  const { membersQuery } = useGroupDetail(groupId);

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
  const [notFoundEmail, setNotFoundEmail] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setReceiptPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setReceiptFile(file);

    // Extract with AI
    setExtracting(true);
    try {
      const base64Reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        base64Reader.onload = (ev) => {
          const result = ev.target?.result as string;
          resolve(result.split(",")[1]);
        };
        base64Reader.onerror = reject;
        base64Reader.readAsDataURL(file);
      });

      const extracted = await extractReceiptData(base64, file.type);

      if (extracted.description) setDescription(extracted.description);
      if (extracted.total_amount > 0) setTotalAmount(extracted.total_amount.toFixed(2));
      if (extracted.category && CATEGORIES.includes(extracted.category)) setCategory(extracted.category);
      if (extracted.expense_date) setExpenseDate(extracted.expense_date);

      toast({ title: "Comprovante analisado!", description: "Campos preenchidos pela IA. Revise antes de salvar." });
    } catch (err: any) {
      toast({ title: "Não foi possível ler o comprovante", description: err.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  // Pre-select group members when coming from a group
  useEffect(() => {
    if (!groupId || !membersQuery.data || !user) return;
    const memberIds = membersQuery.data
      .map((m) => m.user_id)
      .filter((id) => id !== user.id);
    setSelectedFriends(memberIds);
  }, [groupId, membersQuery.data, user]);

  const handleEmailSearch = async () => {
    const email = emailSearch.trim().toLowerCase();
    if (!email) return;
    if (email === user?.email) {
      toast({ title: "Você já é participante", variant: "destructive" });
      return;
    }
    setNotFoundEmail(null);
    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setNotFoundEmail(email);
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
        // Auto-send friend request
        const ids = [user!.id, data.id].sort();
        const { error: frError } = await supabase.from("friendships").insert({
          user_id_1: ids[0],
          user_id_2: ids[1],
          requested_by: user!.id,
          status: "pending",
        });
        if (frError && !frError.message.includes("duplicate")) {
          console.error("Friend request error:", frError);
        }
        setInvitedUsers((prev) => [...prev, { id: data.id, name: data.name || "Usuário", email: data.email || email }]);
        setSelectedFriends((prev) => [...prev, data.id]);
      }
      setEmailSearch("");
      toast({ title: `${data.name || "Usuário"} adicionado!` });
    } catch (err: any) {
      // If table doesn't exist or RLS error, still show invite option
      setNotFoundEmail(email);
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

    // Upload receipt if present, then create expense
    const doCreate = async (receiptUrl?: string) => {
      createExpense.mutate(
        { description: description.trim(), total_amount: total, category, expense_date: expenseDate, participants, group_id: groupId, receipt_url: receiptUrl },
        { onSuccess: () => groupId ? navigate(`/groups/${groupId}`) : navigate("/") }
      );
    };

    if (receiptFile && user) {
      const ext = receiptFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      supabase.storage.from("receipts").upload(path, receiptFile, { upsert: false, contentType: receiptFile.type })
        .then(({ error }) => {
          if (error) { doCreate(); return; }
          const { data } = supabase.storage.from("receipts").getPublicUrl(path);
          doCreate(data.publicUrl);
        });
    } else {
      doCreate();
    }
  };

  const equalShare = participantCount > 0 ? (total / participantCount).toFixed(2) : "0.00";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nova despesa</h1>
      {groupId && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          <UsersRound className="h-4 w-4 shrink-0" />
          Despesa do grupo — membros pré-selecionados
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Receipt scanner */}
        <Card className="border-dashed">
          <CardContent className="p-4">
            {receiptPreview ? (
              <div className="space-y-3">
                <div className="relative">
                  <img src={receiptPreview} alt="Comprovante" className="w-full max-h-48 object-contain rounded-lg border border-border" />
                  <button
                    type="button"
                    onClick={() => { setReceiptPreview(null); setReceiptFile(null); }}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {extracting && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    Analisando comprovante com IA...
                  </div>
                )}
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-2 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  {extracting
                    ? <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                    : <Camera className="h-5 w-5 text-primary" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Escanear comprovante</p>
                  <p className="text-xs text-muted-foreground">A IA preenche os campos automaticamente</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleReceiptChange}
                  disabled={extracting}
                />
              </label>
            )}
          </CardContent>
        </Card>

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
                <Input type="number" inputMode="decimal" step="0.01" min="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0,00" required />
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
                onChange={(e) => { setEmailSearch(e.target.value); setNotFoundEmail(null); }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleEmailSearch())}
              />
              <Button type="button" size="icon" variant="outline" onClick={handleEmailSearch} disabled={searchLoading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {/* Not found — invite prompt */}
            {notFoundEmail && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{notFoundEmail}</span> ainda não tem conta no SplitEasy.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    sendInvite(notFoundEmail, user?.email ?? "");
                    toast({ title: "Convite enviado!", description: `${notFoundEmail} foi convidado(a).` });
                    setNotFoundEmail(null);
                    setEmailSearch("");
                  }}
                >
                  <Send className="h-4 w-4" />
                  Convidar {notFoundEmail}
                </Button>
              </div>
            )}

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
                          inputMode="decimal"
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
