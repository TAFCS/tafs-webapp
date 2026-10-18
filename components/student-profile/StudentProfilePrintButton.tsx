"use client";

import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthState } from "@/context/AuthContext";
import type {
    ProfileFeeCell, ProfileFeeSchedule, ProfileGuardian, ProfileHistoryRow, ProfileSibling, StudentProfileData,
} from "./StudentProfilePDF";

/**
 * TAFSD-345: "Print" in the Student Directory window. Gathers the student,
 * progression and (when the viewer may see it) fee schedule through the same
 * scoped endpoints the window uses, and opens a one-page A4 profile.
 */

type Maybe = string | null | undefined;
interface GuardianRow {
    relationship?: Maybe; full_name?: Maybe; cnic?: Maybe; primary_phone?: Maybe; whatsapp_number?: Maybe;
    occupation?: Maybe; organization?: Maybe; mailing_address?: Maybe; house_appt_number?: Maybe;
    house_appt_name?: Maybe; area_block?: Maybe; city?: Maybe;
}
interface SiblingRow { cc: number; gr_number?: Maybe; full_name?: Maybe; grade?: Maybe; status?: Maybe }
/** GET /v1/staff-editing/students/:cc — the fields this sheet reads. */
interface StudentRecord {
    cc: number; full_name?: Maybe; gr_number?: Maybe; cnic?: Maybe; dob?: Maybe; gender?: Maybe;
    nationality?: Maybe; religion?: Maybe; place_of_birth?: Maybe; city?: Maybe; country?: Maybe;
    date_of_admission?: Maybe; status?: Maybe; academic_year?: Maybe; academic_system?: Maybe;
    campus_name?: Maybe; class_name?: Maybe; class_code?: Maybe; section_name?: Maybe; house_name?: Maybe;
    photograph_url?: Maybe; household_name?: Maybe; home_phone?: Maybe; family_id?: number | null;
    families?: { household_name?: Maybe; legacy_pid?: Maybe } | null;
    guardians?: GuardianRow[]; siblings?: SiblingRow[];
}
interface PeriodRow {
    valid_from: string; valid_to: string | null; change_type: string; academic_year: string | null;
    campuses: { campus_name: string } | null; classes: { description: string } | null;
    sections: { description: string } | null; houses: { house_name: string | null } | null;
}
interface FeeRow {
    is_discount?: boolean; target_month: number; term_start_month?: number | null; status?: string | null;
    amount?: string | number | null; amount_after_discount?: string | number | null; amount_before_discount?: string | number | null;
    description_prefix?: Maybe; fee_types?: { description?: Maybe } | null;
}

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Printed under each amount. Not issued yet prints the amount alone.
const FEE_STATUS: Record<string, string> = {
    PAID: "Paid",
    PARTIALLY_PAID: "Part paid",
    ISSUED: "Issued",
    NOT_ISSUED: "",
    WAIVED: "Waived",
    DISCOUNT: "Discount",
};
// A head split across vouchers shows the least-settled status for the month.
const STATUS_RANK = ["Paid", "Waived", "Discount", "Part paid", "Issued", ""];
// Beyond these, the fee grid no longer fits on the page with everything else,
// so it is left off first (the ticket's order: drop fees, then overflow).
const FEES_FIT = { history: 9, siblings: 4, guardians: 3, heads: 12 };

const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
};
/** "SOFT_ADMISSION" → "Soft admission": the sheet is in normal case, not capitals. */
const titleCase = (x: string | null | undefined) =>
    x ? x.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "";

async function asDataUrl(url: string): Promise<string | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

function schoolNameFor(student: StudentRecord): string {
    const system = String(student.academic_system || "").toUpperCase();
    const klass = String(student.class_code || student.class_name || "").toUpperCase();
    if (system.includes("A LEVEL") || system.includes("A-LEVEL") || /\b(AS|A2)\b/.test(klass)) {
        return "The American Foundation School for A Level Studies";
    }
    return "The American Foundation School";
}

function guardianRows(student: StudentRecord): ProfileGuardian[] {
    const order = (r: string) => (/MOTHER/i.test(r) ? 1 : /FATHER/i.test(r) && !/GRAND/i.test(r) ? 0 : 2);
    return [...(student.guardians ?? [])]
        .sort((a, b) => order(a.relationship ?? "") - order(b.relationship ?? ""))
        .map((g) => ({
            relationship: titleCase(g.relationship),
            name: g.full_name ?? "",
            cnic: g.cnic ?? "",
            phone: g.primary_phone ?? g.whatsapp_number ?? "",
            occupation: [g.occupation, g.organization].filter(Boolean).join(", "),
        }));
}

function familyAddress(student: StudentRecord): string {
    const g = (student.guardians ?? []).find((x) => x.mailing_address || x.house_appt_number || x.area_block);
    if (!g) return "";
    if (g.mailing_address) return g.mailing_address;
    return [g.house_appt_number, g.house_appt_name, g.area_block, g.city].filter(Boolean).join(", ");
}

function historyRows(periods: PeriodRow[]): ProfileHistoryRow[] {
    return [...periods]
        .sort((a, b) => new Date(a.valid_from).getTime() - new Date(b.valid_from).getTime())
        .map((p) => ({
            from: fmtDate(p.valid_from),
            to: p.valid_to ? fmtDate(p.valid_to) : "Present",
            change: titleCase(p.change_type),
            campus: p.campuses?.campus_name ?? "",
            klass: p.classes?.description ?? "",
            section: p.sections?.description ?? "",
            house: p.houses?.house_name ?? "",
            year: p.academic_year ?? "",
        }));
}

function feeSchedule(fees: FeeRow[], academicYear: string): ProfileFeeSchedule | null {
    const heads = fees.filter((f) => !f.is_discount && f.target_month);
    if (!heads.length) return null;
    const start = heads.find((f) => f.term_start_month)?.term_start_month ?? 8;
    const months = Array.from({ length: 12 }, (_, i) => ((start - 1 + i) % 12) + 1);
    const byHead = new Map<string, Record<number, ProfileFeeCell>>();
    for (const f of heads) {
        const name = [f.description_prefix, f.fee_types?.description].filter(Boolean).join(" ") || "FEE";
        const cells = byHead.get(name) ?? {};
        const status = FEE_STATUS[f.status ?? "NOT_ISSUED"] ?? String(f.status);
        // Same amount the Student Overrides grid shows: after discount, else the base amount.
        const amount = Number(f.amount_after_discount ?? f.amount ?? f.amount_before_discount ?? 0) || 0;
        const cur = cells[f.target_month];
        cells[f.target_month] = cur
            ? { amount: cur.amount + amount, status: STATUS_RANK.indexOf(status) > STATUS_RANK.indexOf(cur.status) ? status : cur.status }
            : { amount, status };
        byHead.set(name, cells);
    }
    const used = months.filter((m) => [...byHead.values()].some((c) => c[m]));
    return {
        academicYear,
        months: used.map((m) => ({ month: m, label: MONTHS[m] })),
        heads: [...byHead.entries()].map(([name, cells]) => ({ name, cells })),
    };
}

export function StudentProfilePrintButton({ cc, className }: { cc: number; className?: string }) {
    const { user } = useAuthState();
    const [busy, setBusy] = useState(false);

    const print = async () => {
        // Opened before the awaits so the browser doesn't treat it as a pop-up.
        const win = window.open("", "_blank");
        setBusy(true);
        try {
            const [{ data: sRes }, progRes, { pdf }, { StudentProfilePDF }] = await Promise.all([
                api.get(`/v1/staff-editing/students/${cc}`),
                api.get(`/v1/students/${cc}/progression`).catch(() => null),
                import("@react-pdf/renderer"),
                import("./StudentProfilePDF"),
            ]);
            const student = sRes?.data as StudentRecord | undefined;
            if (!student) throw new Error("Student not found");

            const academicYear: string = student.academic_year ?? "";
            const feeRes = academicYear
                ? await api
                    .get(`/v1/student-fees/student/${cc}/schedule`, { params: { academic_year: academicYear } })
                    .catch(() => null)
                : null;

            const [logoUrl, photoUrl] = await Promise.all([
                asDataUrl("/logo.png"),
                student.photograph_url
                    ? asDataUrl(`/api/photo-proxy?url=${encodeURIComponent(student.photograph_url)}`)
                    : Promise.resolve(null),
            ]);

            const guardians = guardianRows(student);
            const siblings: ProfileSibling[] = (student.siblings ?? [])
                .filter((x) => Number(x.cc) !== Number(student.cc))
                .map((x) => ({
                    cc: x.cc,
                    gr: x.gr_number ?? "",
                    name: x.full_name ?? "",
                    klass: x.grade ?? "",
                    status: titleCase(x.status),
                }));
            const history = historyRows(progRes?.data?.data ?? []);

            let fees: ProfileFeeSchedule | null = null;
            let feesNote: string | null = null;
            const feeRows = feeRes?.data?.data;
            if (!feeRes) {
                feesNote = academicYear ? "Fee schedule not included: you don't have access to student fee schedules." : null;
            } else if (feeRows?.is_template || !feeRows?.fees?.length) {
                feesNote = `No fee schedule saved for ${academicYear}.`;
            } else {
                const grid = feeSchedule(feeRows.fees, academicYear);
                const fits = history.length <= FEES_FIT.history && siblings.length <= FEES_FIT.siblings
                    && guardians.length <= FEES_FIT.guardians && (grid?.heads.length ?? 0) <= FEES_FIT.heads;
                if (grid && fits) fees = grid;
                else if (grid) feesNote = "Fee schedule left off to keep the profile on one page. See Finance, Student Overrides.";
            }

            const data: StudentProfileData = {
                schoolName: schoolNameFor(student),
                campusName: student.campus_name ?? "",
                logoUrl,
                photoUrl,
                name: student.full_name ?? "",
                cc: student.cc,
                gr: student.gr_number ?? "",
                status: titleCase(student.status),
                academicYear,
                details: [
                    { label: "Full name", value: student.full_name },
                    { label: "Date of birth", value: fmtDate(student.dob) },
                    { label: "B-Form / CNIC", value: student.cnic },
                    { label: "Gender", value: student.gender },
                    { label: "Nationality", value: student.nationality },
                    { label: "Religion", value: student.religion },
                    { label: "Place of birth", value: student.place_of_birth ?? [student.city, student.country].filter(Boolean).join(", ") },
                    { label: "Admitted on", value: fmtDate(student.date_of_admission) },
                    { label: "Campus", value: student.campus_name },
                    { label: "Class", value: student.class_name },
                    { label: "Section", value: student.section_name },
                    { label: "House", value: student.house_name },
                    { label: "System", value: student.academic_system },
                    { label: "Status", value: titleCase(student.status) },
                ],
                guardians,
                family: [
                    { label: "Household", value: student.household_name ?? student.families?.household_name },
                    { label: "Family code", value: student.families?.legacy_pid || (student.family_id ? `#${student.family_id}` : "") },
                    { label: "Home phone", value: student.home_phone },
                    { label: "Address", value: familyAddress(student) },
                ],
                siblings,
                history,
                fees,
                feesNote,
                printedAt: new Date().toLocaleString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi",
                }),
                printedBy: user ? `${user.fullName || user.username} (${user.username})` : "staff",
            };

            const blob = await pdf(<StudentProfilePDF data={data} />).toBlob();
            const url = URL.createObjectURL(blob);
            if (win) win.location.href = url;
            else window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);

            api.post(`/v1/enrollments/${cc}/log-certificate-generation`, {
                document_type: "Student Profile",
                note: `Printed the student profile for ${student.full_name ?? `CC ${cc}`}`,
            }).catch(() => {});
        } catch (err) {
            console.error("Student profile print failed:", err);
            win?.close();
            toast.error("Could not build the student profile. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            type="button"
            onClick={print}
            disabled={busy}
            title="Print an A4 student profile"
            className={className ?? "flex items-center gap-1.5 px-3 h-8 rounded-xl text-[11px] font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50"}
        >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            <span className="text-[10px] font-black uppercase tracking-tighter">{busy ? "Preparing…" : "Print"}</span>
        </button>
    );
}
