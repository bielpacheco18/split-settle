import { useExpenses, useBalances } from "@/hooks/useExpenses";
import { useFriends } from "@/hooks/useFriends";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { BarChart3, PieChart as PieChartIcon, Users } from "lucide-react";

const COLORS = [
  "hsl(160,84%,39%)", "hsl(38,92%,50%)", "hsl(0,72%,51%)", "hsl(220,70%,55%)",
  "hsl(280,60%,55%)", "hsl(30,80%,50%)", "hsl(190,80%,45%)", "hsl(100,60%,40%)",
];

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
      <Icon className="h-10 w-10 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export default function Reports() {
  const { expensesQuery } = useExpenses();
  const { data: balances } = useBalances();
  const { acceptedFriends } = useFriends();
  const expenses = expensesQuery.data ?? [];

  // Category breakdown
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((exp: any) => {
    categoryTotals[exp.category] = (categoryTotals[exp.category] ?? 0) + Number(exp.total_amount);
  });
  const categoryData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));

  // Monthly totals
  const monthlyTotals: Record<string, number> = {};
  expenses.forEach((exp: any) => {
    const month = exp.expense_date.slice(0, 7);
    monthlyTotals[month] = (monthlyTotals[month] ?? 0) + Number(exp.total_amount);
  });
  const monthlyData = Object.entries(monthlyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));

  const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.total_amount), 0);

  const friendMap = Object.fromEntries(acceptedFriends.map((f: any) => [f.id, f]));
  const balanceEntries = Object.entries(balances ?? {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Relatórios</h1>

      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Total de despesas registradas</p>
          <p className="text-3xl font-bold">R$ {totalExpenses.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">{expenses.length} despesa{expenses.length !== 1 ? "s" : ""}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Por categoria</CardTitle></CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <EmptyState icon={PieChartIcon} text="Adicione despesas para ver a distribuição por categoria." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Gastos mensais</CardTitle></CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <EmptyState icon={BarChart3} text="Nenhum dado mensal ainda. Registre despesas para começar." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                <Bar dataKey="total" fill="hsl(160,84%,39%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Balanço por amigo</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {balanceEntries.length === 0 ? (
            <EmptyState icon={Users} text="Sem saldos ainda. Adicione amigos e divida despesas!" />
          ) : (
            balanceEntries.map(([id, bal]) => {
              const name = friendMap[id]?.name || "Usuário";
              return (
                <div key={id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="font-medium">{name}</span>
                  <span className={bal > 0 ? "font-semibold text-success" : "font-semibold text-destructive"}>
                    {bal > 0 ? "+" : ""}R$ {bal.toFixed(2)}
                  </span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
