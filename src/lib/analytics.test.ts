import { describe, it, expect } from "vitest";
import {
  ExpensePoint,
  categoryDeviations,
  detectAnomalies,
  forecastMonth,
  linearRegression,
  median,
  monthlySeries,
} from "./analytics";

let seq = 0;
const exp = (date: string, amount: number, category = "alimentação"): ExpensePoint => ({
  id: String(++seq),
  description: `desp ${seq}`,
  category,
  amount,
  date,
});

describe("median", () => {
  it("handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

describe("linearRegression", () => {
  it("fits a perfect line", () => {
    const r = linearRegression([100, 200, 300, 400])!;
    expect(r.slope).toBeCloseTo(100);
    expect(r.intercept).toBeCloseTo(100);
    expect(r.r2).toBeCloseTo(1);
  });

  it("needs at least 3 points", () => {
    expect(linearRegression([1, 2])).toBeNull();
  });
});

describe("monthlySeries", () => {
  it("fills missing months with zero and excludes the current month", () => {
    const s = monthlySeries([exp("2026-01-10", 50), exp("2026-03-05", 30), exp("2026-04-01", 99)], "2026-04");
    expect(s).toEqual([
      { month: "2026-01", total: 50 },
      { month: "2026-02", total: 0 },
      { month: "2026-03", total: 30 },
    ]);
  });
});

describe("forecastMonth", () => {
  it("uses only run rate without history", () => {
    const f = forecastMonth([exp("2026-09-01", 100), exp("2026-09-10", 200)], new Date(2026, 8, 15));
    expect(f.trend).toBeNull();
    expect(f.runRate).toBeCloseTo((300 / 15) * 30);
    expect(f.forecast).toBeCloseTo(600);
  });

  it("blends run rate with the historical trend", () => {
    const history = [exp("2026-06-15", 1000), exp("2026-07-15", 1100), exp("2026-08-15", 1200)];
    const f = forecastMonth([...history, exp("2026-09-01", 390)], new Date(2026, 8, 10));
    expect(f.trend).toBeCloseTo(1300);
    expect(f.runRate).toBeCloseTo(1170);
    // peso 10/30 no run rate, 20/30 na tendência
    expect(f.forecast).toBeCloseTo((1 / 3) * 1170 + (2 / 3) * 1300);
    expect(f.r2).toBeCloseTo(1);
  });

  it("never forecasts below what was already spent", () => {
    const history = [exp("2026-06-15", 100), exp("2026-07-15", 100), exp("2026-08-15", 100)];
    const f = forecastMonth([...history, exp("2026-09-02", 5000)], new Date(2026, 8, 29));
    expect(f.forecast).toBeGreaterThanOrEqual(5000);
    expect(f.low).toBeGreaterThanOrEqual(5000);
  });
});

describe("detectAnomalies", () => {
  it("flags an expense far above the category's usual value", () => {
    const normal = [40, 45, 50, 55, 42, 48, 52].map((v, i) => exp(`2026-08-0${i + 1}`, v));
    const outlier = exp("2026-09-01", 400);
    const res = detectAnomalies([...normal, outlier]);
    expect(res).toHaveLength(1);
    expect(res[0].expense.id).toBe(outlier.id);
  });

  it("ignores categories with few samples and low values", () => {
    expect(detectAnomalies([exp("2026-09-01", 10), exp("2026-09-02", 1000)])).toEqual([]);
    const normal = [40, 45, 50, 55, 42, 48].map((v, i) => exp(`2026-08-0${i + 1}`, v));
    expect(detectAnomalies([...normal, exp("2026-09-01", 1)])).toEqual([]);
  });

  it("works when most values are identical (MAD = 0)", () => {
    const same = Array.from({ length: 6 }, (_, i) => exp(`2026-08-0${i + 1}`, 20));
    const res = detectAnomalies([...same, exp("2026-08-09", 25), exp("2026-09-01", 300)]);
    expect(res.map((a) => a.expense.amount)).toEqual([300]);
  });
});

describe("categoryDeviations", () => {
  it("flags a category above its monthly pattern", () => {
    const hist = ["2026-05", "2026-06", "2026-07", "2026-08"].flatMap((m, i) => [
      exp(`${m}-10`, 100 + i * 10, "lazer"),
      exp(`${m}-10`, 500, "moradia"),
    ]);
    const current = [exp("2026-09-05", 400, "lazer"), exp("2026-09-05", 250, "moradia")];
    const res = categoryDeviations([...hist, ...current], new Date(2026, 8, 15));
    expect(res.map((r) => r.category)).toEqual(["lazer"]);
  });
});
