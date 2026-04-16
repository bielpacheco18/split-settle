import { useState } from "react";
import { useFriends } from "@/hooks/useFriends";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus, Check, X, Search, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function sendInvite(toEmail: string, fromEmail: string) {
  const appUrl = window.location.origin;
  const text = `Oi! Te convido para usar o SplitEasy — o app para dividir despesas com amigos.\n\nBaixe aqui: ${appUrl}\n\nDepois de criar sua conta, me adicione pelo email: ${fromEmail}`;

  if (navigator.share) {
    navigator.share({ title: "Convite SplitEasy", text }).catch(() => {});
  } else {
    const mailto = `mailto:${toEmail}?subject=${encodeURIComponent("Convite para o SplitEasy")}&body=${encodeURIComponent(text)}`;
    window.open(mailto, "_blank");
  }
}

export default function Friends() {
  const { user } = useAuth();
  const { acceptedFriends, pendingReceived, pendingSent, addFriendById, acceptFriend, removeFriend } = useFriends();
  const [emailSearch, setEmailSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [notFoundEmail, setNotFoundEmail] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ friendshipId: string; name: string } | null>(null);
  const { toast } = useToast();

  const handleEmailSearch = async () => {
    const email = emailSearch.trim().toLowerCase();
    if (!email) return;
    if (email === user?.email) {
      toast({ title: "Esse é você!", variant: "destructive" });
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
      const alreadyFriend = acceptedFriends.some((f: any) => f.id === data.id);
      const alreadySent = pendingSent.some((f: any) => f.id === data.id);
      const alreadyReceived = pendingReceived.some((f: any) => f.id === data.id);
      if (alreadyFriend) { toast({ title: "Já são amigos!", variant: "destructive" }); return; }
      if (alreadySent) { toast({ title: "Solicitação já enviada", variant: "destructive" }); return; }
      if (alreadyReceived) {
        toast({ title: "Esse usuário já te enviou uma solicitação!", description: "Aceite na seção de solicitações recebidas." });
        return;
      }
      addFriendById.mutate(data.id);
      setEmailSearch("");
    } catch (err: any) {
      // If table doesn't exist or RLS error, still show invite option
      setNotFoundEmail(email);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Amigos</h1>

      {/* Add friend by email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" /> Adicionar amigo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Email do amigo..."
              value={emailSearch}
              onChange={(e) => { setEmailSearch(e.target.value); setNotFoundEmail(null); }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleEmailSearch())}
            />
            <Button type="button" onClick={handleEmailSearch} disabled={searchLoading || addFriendById.isPending}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>

          {/* Not found — invite prompt */}
          {notFoundEmail && (
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{notFoundEmail}</span> ainda não tem conta no SplitEasy.
              </p>
              <Button
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
                Enviar convite para {notFoundEmail}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending received */}
      {pendingReceived.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Solicitações recebidas
              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {pendingReceived.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingReceived.map((f: any) => (
              <div key={f.friendshipId} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">{(f.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium">{f.name || "Usuário"}</span>
                    {f.email && <p className="text-xs text-muted-foreground">{f.email}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" onClick={() => acceptFriend.mutate(f.friendshipId)}>
                    <Check className="h-4 w-4 text-success" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => setRemoveTarget({ friendshipId: f.friendshipId, name: f.name || "Usuário" })}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending sent */}
      {pendingSent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Solicitações enviadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingSent.map((f: any) => (
              <div key={f.friendshipId} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">{(f.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium">{f.name || "Usuário"}</span>
                    {f.email && <p className="text-xs text-muted-foreground">{f.email}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Pendente</span>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRemoveTarget({ friendshipId: f.friendshipId, name: f.name || "Usuário" })}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Accepted friends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seus amigos ({acceptedFriends.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {acceptedFriends.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum amigo ainda. Busque pelo email!</p>
          )}
          {acceptedFriends.map((f: any) => (
            <div key={f.friendshipId} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">{(f.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <span className="font-medium">{f.name || "Usuário"}</span>
                  {f.email && <p className="text-xs text-muted-foreground">{f.email}</p>}
                </div>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRemoveTarget({ friendshipId: f.friendshipId, name: f.name || "Usuário" })}>
                Remover
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover amigo?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.name} será removido(a) da sua lista de amigos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removeTarget) removeFriend.mutate(removeTarget.friendshipId);
                setRemoveTarget(null);
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
