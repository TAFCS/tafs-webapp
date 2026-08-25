export function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function formatRs(n: number | null | undefined): string {
  return `Rs. ${Math.round(n ?? 0).toLocaleString()}`;
}

/** Newest-first "YYYY-YYYY" labels; the actual Apr-Mar vs Aug-Jul window for a
 *  given year is resolved server-side per graduated_from_class's term system. */
export function generateGraduationYears(): string[] {
  const y = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, i) => `${y - 8 + i}-${y - 7 + i}`).reverse();
}

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
};
