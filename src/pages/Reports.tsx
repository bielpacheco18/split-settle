import { useExpenses, useBalances } from "@/hooks/useExpenses";
import { useSettlements } from "@/hooks/useSettlements";
import { useFriends } from "@/hooks/useFriends";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { BarChart3, PieChart as PieChartIcon, Users, FileDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  const expenses = expensesQuery.data ?? [];
  const settlements = settlementsQuery.data ?? [];

  const categoryTotals: Record<string, number> = {};
  expenses.forEach((exp: any) => {
    categoryTotals[exp.category] = (categoryTotals[exp.category] ?? 0) + Number(exp.total_amount);
  });
  const categoryData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));

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
    y = (doc as any).lastAutoTable.finalY + 10;

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
      y = (doc as any).lastAutoTable.finalY + 10;
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
      y = (doc as any).lastAutoTable.finalY + 10;
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
      y = (doc as any).lastAutoTable.finalY + 10;
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
        body: expenses.map((exp: any) => [
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
      y = (doc as any).lastAutoTable.finalY + 10;
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
        body: settlements.map((s: any) => [
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
    const totalPages = (doc as any).internal.getNumberOfPages();
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
      <div className="flex items-center justify-between">
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
        <CardHeader><CardTitle className="text-lg">Por categoria</CardTitle></CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <EmptyState icon={PieChartIcon} text="Adicione despesas para ver a distribuição por categoria." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
