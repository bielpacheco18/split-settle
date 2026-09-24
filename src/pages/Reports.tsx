import { useExpenses, useBalances } from "@/hooks/useExpenses";
import { useSettlements } from "@/hooks/useSettlements";
import { useFriends } from "@/hooks/useFriends";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { BarChart3, PieChart as PieChartIcon, Users, FileDown, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ExpensePoint, categoryDeviations, detectAnomalies, forecastMonth } from "@/lib/analytics";

// O jspdf-autotable grava a posição final da última tabela no próprio documento
const lastTableY = (doc: jsPDF) => (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

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
  const { data: profile } = useProfile();
  const { settlementsQuery } = useSettlements();
  const isMobile = useIsMobile();
  const expenses = expensesQuery.data ?? [];
  const settlements = settlementsQuery.data ?? [];

  const categoryTotals: Record<string, number> = {};
  expenses.forEach((exp) => {
    categoryTotals[exp.category] = (categoryTotals[exp.category] ?? 0) + Number(exp.total_amount);
  });
  const categoryData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));

  const monthlyTotals: Record<string, number> = {};
  expenses.forEach((exp) => {
    const month = exp.expense_date.slice(0, 7);
    monthlyTotals[month] = (monthlyTotals[month] ?? 0) + Number(exp.total_amount);
  });
  const monthlyData = Object.entries(monthlyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));

  const points: ExpensePoint[] = expenses.map((e) => ({
    id: e.id,
    description: e.description,
    category: e.category,
    amount: Number(e.total_amount),
    date: e.expense_date,
  }));
  const forecast = forecastMonth(points);
  const anomalies = detectAnomalies(points).slice(0, 5);
  const deviations = categoryDeviations(points);
  const brl = (v: number) => `R$ ${v.toFixed(2)}`;

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.total_amount), 0);
  const friendMap = Object.fromEntries(acceptedFriends.map((f) => [f.id, f]));
  const balanceEntries = Object.entries(balances ?? {});

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const userName = profile?.name || "Usuário";

    // ── Header ──
    doc.setFillColor(16, 185, 129); // green
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("SplitEasy", 14, 12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatório de ${userName}`, 14, 20);
    doc.text(`Gerado em ${now}`, pageW - 14, 20, { align: "right" });

    let y = 36;

    // ── Resumo ──
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo", 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Total gasto", "Nº de despesas", "Nº de pagamentos"]],
      body: [[
        `R$ ${totalExpenses.toFixed(2)}`,
        String(expenses.length),
        String(settlements.length),
      ]],
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 10 },
    });
    y = lastTableY(doc) + 10;

    // ── Saldos com amigos ──
    if (balanceEntries.length > 0) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("Saldos com amigos", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Amigo", "Saldo"]],
        body: balanceEntries.map(([id, bal]) => [
          friendMap[id]?.name || "Usuário",
          `${bal > 0 ? "+" : ""}R$ ${(bal as number).toFixed(2)}`,
        ]),
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 10 },
        columnStyles: {
          1: {
            halign: "right",
          },
        },
        didParseCell: (data) => {
          if (data.column.index === 1 && data.section === "body") {
            const val = balanceEntries[data.row.index]?.[1] as number;
            data.cell.styles.textColor = val > 0 ? [16, 185, 129] : [220, 38, 38];
          }
        },
      });
      y = lastTableY(doc) + 10;
    }

    // ── Gastos por categoria ──
    if (categoryData.length > 0) {
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("Gastos por categoria", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Categoria", "Total", "% do total"]],
        body: categoryData
          .sort((a, b) => b.value - a.value)
          .map(({ name, value }) => [
            name.charAt(0).toUpperCase() + name.slice(1),
            `R$ ${value.toFixed(2)}`,
            `${totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : 0}%`,
          ]),
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 10 },
      });
      y = lastTableY(doc) + 10;
    }

    // ── Gastos mensais ──
    if (monthlyData.length > 0) {
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("Gastos mensais", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Mês", "Total"]],
        body: monthlyData.map(({ month, total }) => [month, `R$ ${total.toFixed(2)}`]),
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 10 },
      });
      y = lastTableY(doc) + 10;
    }

    // ── Despesas detalhadas ──
    if (expenses.length > 0) {
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("Despesas", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Data", "Descrição", "Categoria", "Total"]],
        body: expenses.map((exp) => [
          format(new Date(exp.expense_date), "dd/MM/yyyy"),
          exp.description,
          exp.category.charAt(0).toUpperCase() + exp.category.slice(1),
          `R$ ${Number(exp.total_amount).toFixed(2)}`,
        ]),
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 9 },
        columnStyles: { 3: { halign: "right" } },
      });
      y = lastTableY(doc) + 10;
    }

    // ── Pagamentos ──
    if (settlements.length > 0) {
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("Pagamentos registrados", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Data", "De", "Para", "Valor"]],
        body: settlements.map((s) => [
          format(new Date(s.settled_at), "dd/MM/yyyy"),
          s.from_profile?.name || "Usuário",
          s.to_profile?.name || "Usuário",
          `R$ ${Number(s.amount).toFixed(2)}`,
        ]),
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 9 },
        columnStyles: { 3: { halign: "right" } },
      });
    }

    // ── Footer em todas as páginas ──
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `SplitEasy  •  Página ${i} de ${totalPages}`,
        pageW / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      );
    }

    doc.save(`spliteasy-relatorio-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleExportPDF}
          disabled={expenses.length === 0}
        >
          <FileDown className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Total de despesas registradas</p>
          <p className="text-3xl font-bold">R$ {totalExpenses.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">{expenses.length} despesa{expenses.length !== 1 ? "s" : ""}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Insights</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {expenses.length === 0 ? (
            <EmptyState icon={TrendingUp} text="Registre despesas para ver previsões e alertas." />
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Previsão para este mês</p>
                <p className="text-3xl font-bold">{brl(forecast.forecast)}</p>
                {forecast.high > forecast.low + 0.01 && (
                  <p className="text-sm text-muted-foreground">
                    Faixa provável: {brl(forecast.low)} a {brl(forecast.high)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Gasto até agora: {brl(forecast.spentSoFar)} (dia {forecast.daysElapsed} de {forecast.daysInMonth}).{" "}
                  {forecast.trend === null
                    ? "Baseado só no ritmo deste mês — o histórico ainda é curto."
                    : `Combina o ritmo deste mês com a tendência de ${forecast.historyMonths} meses anteriores${forecast.r2 !== null ? ` (R² ${forecast.r2.toFixed(2)})` : ""}.`}
                </p>
              </div>

              {(deviations.length > 0 || anomalies.length > 0) ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" /> Fora do padrão
                  </p>
                  {deviations.map((d) => (
                    <div key={d.category} className="rounded-lg border border-border p-3 text-sm">
                      <span className="font-medium capitalize">{d.category}</span>: {brl(d.current)} neste mês,
                      acima da média mensal de {brl(d.mean)}.
                    </div>
                  ))}
                  {anomalies.map((a) => (
                    <div key={a.expense.id} className="rounded-lg border border-border p-3 text-sm">
                      <span className="font-medium">{a.expense.description}</span> ({brl(a.expense.amount)}) — bem acima
                      do seu gasto típico em <span className="capitalize">{a.expense.category}</span> ({brl(a.median)}).
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum gasto fora do seu padrão.</p>
              )}
            </>
          )}
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
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={isMobile ? false : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                {isMobile && <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />}
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
                <YAxis tick={{ fontSize: 12 }} width={isMobile ? 40 : 60} />
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
                <div key={id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <span className="min-w-0 truncate font-medium">{name}</span>
                  <span className={cn("shrink-0 font-semibold", bal > 0 ? "text-success" : "text-destructive")}>
                    {bal > 0 ? "+" : ""}R$ {(bal as number).toFixed(2)}
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
