import { useAuth } from "@/contexts/AuthContext";
import { useBalances } from "@/hooks/useExpenses";
import { useFriends } from "@/hooks/useFriends";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { PlusCircle, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StaggerContainer, StaggerItem, AnimatedCard } from "@/components/PageTransition";
import { motion } from "framer-motion";

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
    <StaggerContainer className="space-y-6">
      <StaggerItem>
        <h1 className="text-2xl font-bold">
          Olá, {profile?.name || "amigo"} 👋
        </h1>
        <p className="text-muted-foreground">Aqui está o resumo das suas contas</p>
      </StaggerItem>

      <div className="grid gap-4 sm:grid-cols-2">
        <StaggerItem>
          <AnimatedCard>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <motion.div
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/15"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
                >
                  <TrendingUp className="h-6 w-6 text-success" />
                </motion.div>
                <div>
                  <p className="text-sm text-muted-foreground">Te devem</p>
                  <p className="text-2xl font-bold text-success">
                    R$ {totalOwed.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>
        </StaggerItem>
        <StaggerItem>
          <AnimatedCard>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <motion.div
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/15"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
                >
                  <TrendingDown className="h-6 w-6 text-destructive" />
                </motion.div>
                <div>
                  <p className="text-sm text-muted-foreground">Você deve</p>
                  <p className="text-2xl font-bold text-destructive">
                    R$ {totalOwing.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </AnimatedCard>
        </StaggerItem>
      </div>

      <StaggerItem>
        <Link to="/add-expense">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button className="w-full gap-2" size="lg">
              <PlusCircle className="h-5 w-5" />
              Adicionar despesa
            </Button>
          </motion.div>
        </Link>
      </StaggerItem>

      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saldos com amigos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {balanceEntries.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum saldo ainda. Adicione amigos e despesas!</p>
            )}
            {balanceEntries.map(([friendId, balance], i) => {
              const friend = friendMap[friendId];
              const name = friend?.name || "Usuário";
              const initials = name.slice(0, 2).toUpperCase();
              return (
                <motion.div
                  key={friendId}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.06, duration: 0.25 }}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{name}</span>
                  </div>
                  <span className={balance > 0 ? "font-semibold text-success" : "font-semibold text-destructive"}>
                    {balance > 0 ? "+" : ""}R$ {balance.toFixed(2)}
                  </span>
                </motion.div>
              );
            })}
            {balanceEntries.length > 0 && (
              <Link to="/history" className="flex items-center gap-1 text-sm text-primary hover:underline">
                Ver histórico completo <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </CardContent>
        </Card>
      </StaggerItem>
    </StaggerContainer>
  );
}
