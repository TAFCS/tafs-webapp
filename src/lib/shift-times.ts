/**
 * The one rule for an employee's fixed shift: check-out has to come after
 * check-in.
 *
 * It lives here rather than in each form because it is enforced in more than
 * one place (the employee form, the schedule editor in the detail panel, and the
 * "Data Audit" filter on the employee list), and they must never disagree.
 *
 * Shifts are single-day. Late marking and payroll compare clock times within
 * one date, so an overnight pair (say 19:00 to 06:00) cannot work in this system
 * whatever the intent, and is reported as an error like any other reversed pair.
 * The mistake this really catches is a 12-hour slip: 19:30 typed for 07:30, or
 * 04:30 for 16:30.
 */

/**
 * Minutes since midnight from either an <input type="time"> value ("07:30",
 * "07:30:00") or the API's time column ("1970-01-01T07:30:00.000Z", whose UTC
 * fields are the wall clock). Null for anything unparseable, including empty.
 */
export function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/T?(\d{2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 19:30 -> "7:30 PM", the way the time inputs display it, so the message matches what the user sees. */
function to12Hour(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

/**
 * A message when the pair is invalid, or null when it is fine.
 *
 * A missing time is not reported: whether one is required depends on the
 * schedule source, and callers already have that check. This only judges a
 * pair that is fully present.
 */
export function shiftTimeOrderError(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): string | null {
  const start = timeToMinutes(checkIn);
  const end = timeToMinutes(checkOut);
  if (start == null || end == null || start < end) return null;

  if (start === end) {
    return `Check-out is the same as check-in (${to12Hour(start)}). Check-out has to be later in the day.`;
  }
  return `Check-out (${to12Hour(end)}) is earlier than check-in (${to12Hour(start)}). Check that AM and PM are right on both.`;
}

/** For the employee list's audit filter, which holds API records rather than form values. */
export function hasReversedShiftTimes(employee: {
  reporting_time?: string | null;
  leaving_time?: string | null;
}): boolean {
  return shiftTimeOrderError(employee.reporting_time, employee.leaving_time) !== null;
}
