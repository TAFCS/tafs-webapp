/**
 * TAFSD-279: the order the deposit modal lists its arrear months in.
 *
 * Heads arrive grouped by fee type (fee-type priority first, then month), so
 * building the month groups in arrival order puts September above August
 * whenever a higher-priority fee type only has September. Sort the groups
 * themselves instead:
 *   1. earliest fee_date in the group,
 *   2. then the month in academic-year order (Aug→Jul, or Apr→Mar for a class
 *      whose term starts in April), so a tie on fee_date reads August, September…
 *   3. then the lowest student_fees.id, so the order never changes on refresh.
 */

export interface ArrearGroupOrderKey {
    /** Earliest fee date in the group (ISO or YYYY-MM-DD); null sorts last. */
    feeDate: string | null;
    /** target_month (1–12). */
    month: number | null;
    /** "2026-2027" (or "2026"). */
    academicYear: string | null;
    /** Month the term starts in: 8 (Aug–Jul) or 4 (Apr–Mar). Defaults to 8. */
    termStartMonth?: number | null;
    /** Lowest student_fees.id in the group; null for a surcharge-only group. */
    minFeeId: number | null;
}

/** Months since a fixed origin, in the order the academic year runs. */
export function academicMonthIndex(month: number | null, academicYear: string | null, termStartMonth?: number | null): number | null {
    if (month == null || !academicYear) return null;
    const startYear = parseInt(academicYear.slice(0, 4), 10);
    if (!Number.isFinite(startYear)) return null;
    const tsm = termStartMonth ?? 8;
    const year = month >= tsm ? startYear : startYear + 1;
    return year * 12 + (month - 1);
}

const dayOf = (d: string | null) => (d ? d.slice(0, 10) : null);

export function compareArrearGroups(a: ArrearGroupOrderKey, b: ArrearGroupOrderKey): number {
    const da = dayOf(a.feeDate);
    const db = dayOf(b.feeDate);
    if (da !== db) {
        if (da == null) return 1;
        if (db == null) return -1;
        return da < db ? -1 : 1;
    }
    const ia = academicMonthIndex(a.month, a.academicYear, a.termStartMonth);
    const ib = academicMonthIndex(b.month, b.academicYear, b.termStartMonth);
    if (ia !== ib) {
        if (ia == null) return 1;
        if (ib == null) return -1;
        return ia - ib;
    }
    return (a.minFeeId ?? Number.POSITIVE_INFINITY) - (b.minFeeId ?? Number.POSITIVE_INFINITY);
}
