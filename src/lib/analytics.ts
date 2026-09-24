// Análise estatística dos gastos: previsão do mês e detecção de anomalias.
// Funções puras (sem React/Supabase) para poderem ser testadas isoladamente.

export interface ExpensePoint {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string; // YYYY-MM-DD
}

export interface MonthTotal {
  month: string; // YYYY-MM
  total: number;
}

export interface Regression {
  slope: number;
  intercept: number;
  r2: number;
  residualStd: number;
}

export interface MonthForecast {
  month: string;
  spentSoFar: number;
  daysElapsed: number;
  daysInMonth: number;
  runRate: number; // projeção pelo ritmo diário do mês atual
  trend: number | null; // projeção pela regressão sobre meses anteriores
  forecast: number; // combinação ponderada das duas
  low: number; // intervalo de ~95%
  high: number;
  r2: number | null;
  historyMonths: number;
}

export interface ExpenseAnomaly {
  expense: ExpensePoint;
  score: number; // z-score modificado (robusto)
  median: number;
}

export interface CategoryDeviation {
  category: string;
  current: number;
  mean: number;
  std: number;
  z: number;
}

const monthKey = (date: string) => date.slice(0, 7);

function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function mean(xs: number[]) {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Desvio padrão amostral (n - 1). */
export function std(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export function median(xs: number[]) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Totais mensais contínuos (meses sem gasto entram como zero) até `untilMonth`, exclusivo. */
export function monthlySeries(expenses: ExpensePoint[], untilMonth: string): MonthTotal[] {
  const totals: Record<string, number> = {};
  for (const e of expenses) {
    const k = monthKey(e.date);
    if (k < untilMonth) totals[k] = (totals[k] ?? 0) + e.amount;
  }
  const months = Object.keys(totals).sort();
  if (months.length === 0) return [];

  const series: MonthTotal[] = [];
  for (let m = months[0]; m < untilMonth; m = nextMonth(m)) {
    series.push({ month: m, total: totals[m] ?? 0 });
  }
  return series;
}

/** Regressão linear por mínimos quadrados, com x = 0..n-1. */
export function linearRegression(ys: number[]): Regression | null {
  const n = ys.length;
  if (n < 3) return null;
  const xs = ys.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const sxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const slope = sxy / sxx;
  const intercept = my - slope * mx;

  const sse = ys.reduce((s, y, i) => s + (y - (intercept + slope * i)) ** 2, 0);
  const sst = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  return {
    slope,
    intercept,
    r2: sst === 0 ? 1 : 1 - sse / sst,
    residualStd: Math.sqrt(sse / (n - 2)),
  };
}

/**
 * Previsão do total do mês corrente.
 * Combina o ritmo diário do mês (run rate) com a tendência histórica (regressão linear).
 * O peso do run rate cresce conforme o mês avança: no dia 1 vale quase só a tendência,
 * no fim do mês vale quase só o que já foi gasto.
 */
export function forecastMonth(expenses: ExpensePoint[], today: Date = new Date()): MonthForecast {
  const todayStr = toDateString(today);
  const month = monthKey(todayStr);
  const dim = daysInMonth(month);
  const daysElapsed = today.getDate();

  const spentSoFar = expenses
    .filter((e) => monthKey(e.date) === month && e.date <= todayStr)
    .reduce((s, e) => s + e.amount, 0);
  const runRate = (spentSoFar / daysElapsed) * dim;

  const history = monthlySeries(expenses, month).map((m) => m.total);
  const reg = linearRegression(history);
  const trend = reg ? Math.max(0, reg.intercept + reg.slope * history.length) : history.length > 0 ? mean(history) : null;

  const w = daysElapsed / dim;
  let forecast = trend === null ? runRate : w * runRate + (1 - w) * trend;
  forecast = Math.max(forecast, spentSoFar);

  // Incerteza: erro residual da regressão (ou desvio dos meses), encolhendo conforme o mês avança.
  const spread = reg ? reg.residualStd : std(history);
  const margin = 1.96 * spread * (1 - w);

  return {
    month,
    spentSoFar,
    daysElapsed,
    daysInMonth: dim,
    runRate,
    trend,
    forecast,
    low: Math.max(spentSoFar, forecast - margin),
    high: forecast + margin,
    r2: reg ? reg.r2 : null,
    historyMonths: history.length,
  };
}

/**
 * Despesas atípicas dentro da própria categoria, usando o z-score modificado
 * (Iglewicz & Hoaglin): 0.6745 * (x - mediana) / MAD. Usa mediana e MAD em vez de
 * média e desvio padrão para que os próprios outliers não distorçam a referência.
 * Só sinaliza valores acima do normal (gastar menos não é alerta).
 */
export function detectAnomalies(
  expenses: ExpensePoint[],
  { threshold = 3.5, minSamples = 5 }: { threshold?: number; minSamples?: number } = {}
): ExpenseAnomaly[] {
  const byCategory: Record<string, ExpensePoint[]> = {};
  for (const e of expenses) (byCategory[e.category] ??= []).push(e);

  const anomalies: ExpenseAnomaly[] = [];
  for (const items of Object.values(byCategory)) {
    if (items.length < minSamples) continue;
    const amounts = items.map((e) => e.amount);
    const med = median(amounts);
    const mad = median(amounts.map((a) => Math.abs(a - med)));

    // MAD = 0 quando mais da metade dos valores é igual; cai para o desvio absoluto médio.
    const scale = mad > 0 ? mad / 0.6745 : mean(amounts.map((a) => Math.abs(a - med))) * 1.253314;
    if (scale === 0) continue;

    for (const e of items) {
      const score = (e.amount - med) / scale;
      if (score > threshold) anomalies.push({ expense: e, score, median: med });
    }
  }
  return anomalies.sort((a, b) => b.score - a.score);
}

/**
 * Categorias cujo gasto no mês corrente está acima do padrão dos meses anteriores (z-score).
 * O mês corrente é comparado já projetado para o mês inteiro, para não subestimar no início do mês.
 */
export function categoryDeviations(
  expenses: ExpensePoint[],
  today: Date = new Date(),
  { threshold = 2, minMonths = 3 }: { threshold?: number; minMonths?: number } = {}
): CategoryDeviation[] {
  const month = monthKey(toDateString(today));
  const factor = daysInMonth(month) / today.getDate();
  const categories = [...new Set(expenses.map((e) => e.category))];

  const result: CategoryDeviation[] = [];
  for (const category of categories) {
    const items = expenses.filter((e) => e.category === category);
    const history = monthlySeries(items, month).map((m) => m.total);
    if (history.length < minMonths) continue;

    const current = items.filter((e) => monthKey(e.date) === month).reduce((s, e) => s + e.amount, 0);
    const m = mean(history);
    const s = std(history);
    if (s === 0) continue;

    const z = (current * factor - m) / s;
    if (z > threshold) result.push({ category, current, mean: m, std: s, z });
  }
  return result.sort((a, b) => b.z - a.z);
}
