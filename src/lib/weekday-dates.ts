/** Shared weekday date helpers for makeup / missed-lesson pickers. */

export const WEEKDAY_FULL: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export function clampSourceDateForWeekday(
  rawIso: string,
  dayOfWeek: number,
  minIso: string,
): string {
  const raw = new Date(`${rawIso}T00:00:00.000Z`);
  const min = new Date(`${minIso}T00:00:00.000Z`);
  let d = new Date(raw);
  while (d.getUTCDay() !== dayOfWeek) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  if (d.getTime() < min.getTime()) {
    d = new Date(min);
    while (d.getUTCDay() !== dayOfWeek) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  return d.toISOString().slice(0, 10);
}

export function generateWeekdayOccurrences(
  dayOfWeek: number,
  fromIso: string,
  toIso: string,
): string[] {
  const from = new Date(`${fromIso}T00:00:00.000Z`);
  const to = new Date(`${toIso}T00:00:00.000Z`);
  const out: string[] = [];
  const d = new Date(from);
  while (d.getUTCDay() !== dayOfWeek) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  while (d.getTime() <= to.getTime()) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

export function defaultSourceDateIso(beforeIso: string, weekday: number): string {
  const d = new Date(`${beforeIso}T00:00:00.000Z`);
  const diff = (d.getUTCDay() - weekday + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}
