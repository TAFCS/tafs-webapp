import api from "./api";

/**
 * TAFSD-556: Attendance → Not Enrolled Check-ins. Biometric scans by students
 * who had left, been expelled or graduated when they scanned. The backend
 * flags them as scans arrive; this only carries the report.
 */

export type NonEnrolledStatus = "LEFT" | "EXPELLED" | "GRADUATED" | "ENROLLED" | "SOFT_ADMISSION" | "QUICK_ADMISSION";

export interface NonEnrolledCheckInRow {
    /** YYYY-MM-DD, Pakistan date. */
    date: string;
    student_cc: number;
    full_name: string | null;
    gr_number: string | null;
    class_name: string | null;
    /** Status when they scanned. */
    status: NonEnrolledStatus;
    /** Status now; differs if they were brought back since. */
    current_status: NonEnrolledStatus | null;
    /** YYYY-MM-DD they moved to that status, when recorded. */
    left_on: string | null;
    campus_id: number | null;
    campus_name: string | null;
    /** Segment of the student's class (Early Years, Junior, ...). */
    segment_id: number | null;
    segment_name: string | null;
    devices: { sn: string; pin: string }[];
    /** HH:mm, Pakistan time. */
    first_scan: string;
    last_scan: string;
    scans: number;
}

export interface NonEnrolledCheckInReport {
    from: string;
    to: string;
    rows: NonEnrolledCheckInRow[];
    /** Students and check-in days per segment, over the same filters. */
    by_segment: NonEnrolledSegmentCount[];
    /** True until the table's migration is applied on the server. */
    pending_migration: boolean;
}

export interface NonEnrolledSegmentCount {
    segment_id: number | null;
    segment_name: string | null;
    students: number;
    days: number;
}

export interface NonEnrolledCheckInQuery {
    from: string;
    to: string;
    campus_ids?: number[];
    segment_ids?: number[];
    q?: string;
}

const toParams = (query: NonEnrolledCheckInQuery) => ({
    from: query.from,
    to: query.to,
    campus_ids: query.campus_ids?.length ? query.campus_ids.join(",") : undefined,
    segment_ids: query.segment_ids?.length ? query.segment_ids.join(",") : undefined,
    q: query.q?.trim() || undefined,
});

export const nonEnrolledCheckInsService = {
    async report(query: NonEnrolledCheckInQuery): Promise<NonEnrolledCheckInReport> {
        const { data } = await api.get("/v1/attendance/non-enrolled-check-ins", { params: toParams(query) });
        return data.data;
    },

    async exportExcel(query: NonEnrolledCheckInQuery): Promise<Blob> {
        const { data } = await api.get("/v1/attendance/non-enrolled-check-ins/export", {
            params: toParams(query),
            responseType: "blob",
        });
        return data;
    },
};
