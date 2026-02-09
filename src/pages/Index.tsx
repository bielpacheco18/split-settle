import { useAuth } from "@/contexts/AuthContext";
import { useBalances } from "@/hooks/useExpenses";
import { useFriends } from "@/hooks/useFriends";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { PlusCircle, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Index() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: balances, isLoading } = useBalances();
  const { acceptedFriends } = useFriends();

  const balanceEntries = Object.entries(balances ?? {});
  const totalOwed = balanceEntries.filter(([, v]) => v > 0).reduce((s, [, v]) => s + v, 0);
  const totalOwing = balanceEntries.filter(([, v]) => v < 0).reduce((s, [, v]) => s + Math.abs(v), 0);

  const friendMap = Object.fromEntries(acceptedFriends.map((f: any) => [f.id, f]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Olá, {profile?.name || "amigo"} 👋
        </h1>
        <p className="text-muted-foreground">Aqui está o resumo das suas contas</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/15">
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Te devem</p>
              <p className="text-2xl font-bold text-success">
                R$ {totalOwed.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/15">
              <TrendingDown className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Você deve</p>
              <p className="text-2xl font-bold text-destructive">
                R$ {totalOwing.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick add */}
      <Link to="/add-expense">
        <Button className="w-full gap-2" size="lg">
          <PlusCircle className="h-5 w-5" />
          Adicionar despesa
        </Button>
      </Link>

      {/* Friend balances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Saldos com amigos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {balanceEntries.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum saldo ainda. Adicione amigos e despesas!</p>
          )}
          {balanceEntries.map(([friendId, balance]) => {
            const friend = friendMap[friendId];
            const name = friend?.name || "Usuário";
            const initials = name.slice(0, 2).toUpperCase();
            return (
              <div key={friendId} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{name}</span>
                </div>
                <span className={balance > 0 ? "font-semibold text-success" : "font-semibold text-destructive"}>
                  {balance > 0 ? "+" : ""}R$ {balance.toFixed(2)}
                </span>
              </div>
            );
          })}
          {balanceEntries.length > 0 && (
            <Link to="/history" className="flex items-center gap-1 text-sm text-primary hover:underline">
              Ver histórico completo <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
