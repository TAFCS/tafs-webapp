"use client";

import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthState } from "@/context/AuthContext";
import { schoolHeadingForClass } from "./school-heading";
import type {
    ProfileFeeCell,
    ProfileFeeSchedule,
    ProfileGuardian,
    ProfileHistoryRow,
    ProfileSibling,
    StudentProfileData,
} from "./StudentProfilePDF";

/**
 * TAFSD-345 / Mirza Student Profile Print:
 * - Gather student record, progression history, fee schedule (if authorized), and sibling details.
 * - Prints an official A4 student profile with:
 *   - School heading by class (Secondary Studies for VI-X, A Level Studies for AS/A2, standard otherwise).
 *   - All text in CAPITALS.
 *   - Important fields in bold: student name, GR, class/section, campus, father's name, contact numbers, status.
 *   - First and latest upload photos side by side with upload dates (single photo if identical).
 *   - Siblings section at bottom with photo, name, GR ("LINK TO GR"), class/section, campus, status.
 */

type Maybe = string | null | undefined;

interface GuardianRow {
    relationship?: Maybe;
    full_name?: Maybe;
    cnic?: Maybe;
    primary_phone?: Maybe;
    whatsapp_number?: Maybe;
    occupation?: Maybe;
    organization?: Maybe;
    mailing_address?: Maybe;
    house_appt_number?: Maybe;
    house_appt_name?: Maybe;
    area_block?: Maybe;
    city?: Maybe;
}

interface SiblingRow {
    cc: number;
    gr_number?: Maybe;
    full_name?: Maybe;
    grade?: Maybe;
    class_name?: Maybe;
    section_name?: Maybe;
    campus_name?: Maybe;
    photograph_url?: Maybe;
    status?: Maybe;
}

/** GET /v1/staff-editing/students/:cc — the fields this sheet reads. */
interface StudentRecord {
    cc: number;
    full_name?: Maybe;
    gr_number?: Maybe;
    cnic?: Maybe;
    dob?: Maybe;
    gender?: Maybe;
    nationality?: Maybe;
    religion?: Maybe;
    place_of_birth?: Maybe;
    city?: Maybe;
    country?: Maybe;
    date_of_admission?: Maybe;
    status?: Maybe;
    academic_year?: Maybe;
    academic_system?: Maybe;
    campus_id?: number | null;
    campus_name?: Maybe;
    class_id?: number | null;
    class_name?: Maybe;
    class_code?: Maybe;
    section_name?: Maybe;
    house_name?: Maybe;
    photograph_url?: Maybe;
    first_photo_url?: Maybe;
    first_photo_date?: Maybe;
    latest_photo_url?: Maybe;
    latest_photo_date?: Maybe;
    school_heading?: Maybe;
    household_name?: Maybe;
    home_phone?: Maybe;
    family_id?: number | null;
    families?: { household_name?: Maybe; legacy_pid?: Maybe } | null;
    guardians?: GuardianRow[];
    siblings?: SiblingRow[];
}

interface PeriodRow {
    valid_from: string;
    valid_to: string | null;
    change_type: string;
    academic_year: string | null;
    campuses: { campus_name: string } | null;
    classes: { description: string } | null;
    sections: { description: string } | null;
    houses: { house_name: string | null } | null;
}

interface FeeRow {
    is_discount?: boolean;
    target_month: number;
    term_start_month?: number | null;
    status?: string | null;
    amount?: string | number | null;
    amount_after_discount?: string | number | null;
    amount_before_discount?: string | number | null;
    description_prefix?: Maybe;
    fee_types?: { description?: Maybe } | null;
}

const MONTHS = ["", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Printed under each amount. Not issued yet prints the amount alone.
const FEE_STATUS: Record<string, string> = {
    PAID: "PAID",
    PARTIALLY_PAID: "PART PAID",
    ISSUED: "ISSUED",
    NOT_ISSUED: "",
    WAIVED: "WAIVED",
    DISCOUNT: "DISCOUNT",
};

// A head split across vouchers shows the least-settled status for the month.
const STATUS_RANK = ["PAID", "WAIVED", "DISCOUNT", "PART PAID", "ISSUED", ""];

// Beyond these, the fee grid no longer fits on the page with everything else,
// so it is left off first to preserve page flow.
const FEES_FIT = { history: 9, siblings: 4, guardians: 3, heads: 12 };

const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).toUpperCase();
    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Karachi",
    }).toUpperCase();
};

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

function guardianRows(student: StudentRecord): ProfileGuardian[] {
    const order = (r: string) => (/MOTHER/i.test(r) ? 1 : /FATHER/i.test(r) && !/GRAND/i.test(r) ? 0 : 2);
    return [...(student.guardians ?? [])]
        .sort((a, b) => order(a.relationship ?? "") - order(b.relationship ?? ""))
        .map((g) => {
            const rel = (g.relationship ?? "").trim().toUpperCase();
            const isFather = rel === "FATHER" || (rel.includes("FATHER") && !rel.includes("GRAND"));
            return {
                relationship: rel,
                name: (g.full_name ?? "").toUpperCase(),
                cnic: (g.cnic ?? "").toUpperCase(),
                phone: (g.primary_phone ?? g.whatsapp_number ?? "").toUpperCase(),
                occupation: [g.occupation, g.organization].filter(Boolean).join(", ").toUpperCase(),
                isFather,
            };
        });
}

function familyAddress(student: StudentRecord): string {
    const g = (student.guardians ?? []).find((x) => x.mailing_address || x.house_appt_number || x.area_block);
    if (!g) return "";
    if (g.mailing_address) return g.mailing_address.toUpperCase();
    return [g.house_appt_number, g.house_appt_name, g.area_block, g.city].filter(Boolean).join(", ").toUpperCase();
}

function historyRows(periods: PeriodRow[]): ProfileHistoryRow[] {
    return [...periods]
        .sort((a, b) => new Date(a.valid_from).getTime() - new Date(b.valid_from).getTime())
        .map((p) => ({
            from: fmtDate(p.valid_from),
            to: p.valid_to ? fmtDate(p.valid_to) : "PRESENT",
            change: (p.change_type ?? "").replace(/_/g, " ").toUpperCase(),
            campus: (p.campuses?.campus_name ?? "").toUpperCase(),
            klass: (p.classes?.description ?? "").toUpperCase(),
            section: (p.sections?.description ?? "").toUpperCase(),
            house: (p.houses?.house_name ?? "").toUpperCase(),
            year: (p.academic_year ?? "").toUpperCase(),
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
        const status = FEE_STATUS[f.status ?? "NOT_ISSUED"] ?? String(f.status).toUpperCase();
        const amount = Number(f.amount_after_discount ?? f.amount ?? f.amount_before_discount ?? 0) || 0;
        const cur = cells[f.target_month];
        cells[f.target_month] = cur
            ? {
                amount: cur.amount + amount,
                status: STATUS_RANK.indexOf(status) > STATUS_RANK.indexOf(cur.status) ? status : cur.status,
            }
            : { amount, status };
        byHead.set(name, cells);
    }
    const used = months.filter((m) => [...byHead.values()].some((c) => c[m]));
    return {
        academicYear: academicYear.toUpperCase(),
        months: used.map((m) => ({ month: m, label: MONTHS[m] })),
        heads: [...byHead.entries()].map(([name, cells]) => ({ name: name.toUpperCase(), cells })),
    };
}

export function StudentProfilePrintButton({ cc, className }: { cc: number; className?: string }) {
    const { user } = useAuthState();
    const [busy, setBusy] = useState(false);

    const print = async () => {
        // Opened before the awaits so the browser doesn't block the new tab
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

            // Photos: first uploaded photo and latest photo
            const firstUrl = student.first_photo_url || student.photograph_url;
            const latestUrl = student.latest_photo_url || student.photograph_url;
            const hasTwoPhotos = Boolean(firstUrl && latestUrl && firstUrl !== latestUrl);

            const [logoUrl, firstPhotoDataUrl, latestPhotoDataUrl] = await Promise.all([
                asDataUrl("/logo.png"),
                firstUrl
                    ? asDataUrl(`/api/photo-proxy?url=${encodeURIComponent(firstUrl)}`)
                    : Promise.resolve(null),
                hasTwoPhotos && latestUrl
                    ? asDataUrl(`/api/photo-proxy?url=${encodeURIComponent(latestUrl)}`)
                    : Promise.resolve(null),
            ]);

            const guardians = guardianRows(student);

            // Siblings with photo dataUrl, GR, class/section, campus, status
            const rawSiblings = (student.siblings ?? []).filter((x) => Number(x.cc) !== Number(student.cc));
            const siblings: ProfileSibling[] = await Promise.all(
                rawSiblings.map(async (x) => {
                    const gradeStr = x.grade || [x.class_name, x.section_name ? `(${x.section_name})` : ""].filter(Boolean).join(" ");
                    const photoDataUrl = x.photograph_url
                        ? await asDataUrl(`/api/photo-proxy?url=${encodeURIComponent(x.photograph_url)}`)
                        : null;
                    return {
                        cc: x.cc,
                        gr: (x.gr_number ?? "").toUpperCase(),
                        name: (x.full_name ?? "").toUpperCase(),
                        grade: gradeStr.toUpperCase(),
                        campus: (x.campus_name ?? "").toUpperCase(),
                        status: (x.status ?? "").replace(/_/g, " ").toUpperCase(),
                        photoDataUrl,
                    };
                }),
            );

            const history = historyRows(progRes?.data?.data ?? []);

            let fees: ProfileFeeSchedule | null = null;
            let feesNote: string | null = null;
            const feeRows = feeRes?.data?.data;
            if (!feeRes) {
                feesNote = academicYear
                    ? "FEE SCHEDULE NOT INCLUDED: YOU DON'T HAVE ACCESS TO STUDENT FEE SCHEDULES."
                    : null;
            } else if (feeRows?.is_template || !feeRows?.fees?.length) {
                feesNote = `NO FEE SCHEDULE SAVED FOR ${academicYear.toUpperCase()}.`;
            } else {
                const grid = feeSchedule(feeRows.fees, academicYear);
                const fits = history.length <= FEES_FIT.history &&
                    siblings.length <= FEES_FIT.siblings &&
                    guardians.length <= FEES_FIT.guardians &&
                    (grid?.heads.length ?? 0) <= FEES_FIT.heads;
                if (grid && fits) fees = grid;
                else if (grid) {
                    feesNote = "FEE SCHEDULE LEFT OFF TO KEEP THE PROFILE COMPACT. SEE FINANCE, STUDENT OVERRIDES.";
                }
            }

            // School heading by class rule (VI-X Secondary, AS/A2 A Level, otherwise standard)
            const schoolName = student.school_heading || schoolHeadingForClass({
                class_id: student.class_id,
                class_name: student.class_name,
                class_code: student.class_code,
                academic_system: student.academic_system,
            });

            const data: StudentProfileData = {
                schoolName,
                campusName: (student.campus_name ?? "").toUpperCase(),
                logoUrl,
                firstPhotoDataUrl,
                firstPhotoDate: student.first_photo_date ? fmtDate(student.first_photo_date) : null,
                latestPhotoDataUrl: hasTwoPhotos ? latestPhotoDataUrl : firstPhotoDataUrl,
                latestPhotoDate: student.latest_photo_date ? fmtDate(student.latest_photo_date) : null,
                name: (student.full_name ?? "").toUpperCase(),
                cc: student.cc,
                gr: (student.gr_number ?? "").toUpperCase(),
                status: (student.status ?? "").replace(/_/g, " ").toUpperCase(),
                academicYear: (student.academic_year ?? "").toUpperCase(),
                details: [
                    { label: "FULL NAME", value: student.full_name, bold: true },
                    { label: "GR NUMBER", value: student.gr_number, bold: true },
                    { label: "DATE OF BIRTH", value: fmtDate(student.dob), bold: false },
                    { label: "B-FORM / CNIC", value: student.cnic, bold: false },
                    { label: "GENDER", value: student.gender, bold: false },
                    { label: "NATIONALITY", value: student.nationality, bold: false },
                    { label: "RELIGION", value: student.religion, bold: false },
                    {
                        label: "PLACE OF BIRTH",
                        value: student.place_of_birth ?? [student.city, student.country].filter(Boolean).join(", "),
                        bold: false,
                    },
                    { label: "ADMITTED ON", value: fmtDate(student.date_of_admission), bold: false },
                    { label: "CAMPUS", value: student.campus_name, bold: true },
                    { label: "CLASS", value: student.class_name, bold: true },
                    { label: "SECTION", value: student.section_name, bold: true },
                    { label: "HOUSE", value: student.house_name, bold: false },
                    { label: "SYSTEM", value: student.academic_system, bold: false },
                    { label: "STATUS", value: student.status?.replace(/_/g, " "), bold: true },
                ],
                guardians,
                family: [
                    { label: "HOUSEHOLD", value: student.household_name ?? student.families?.household_name, bold: false },
                    {
                        label: "FAMILY CODE",
                        value: student.families?.legacy_pid || (student.family_id ? `#${student.family_id}` : ""),
                        bold: false,
                    },
                    { label: "HOME PHONE", value: student.home_phone, bold: true },
                    { label: "ADDRESS", value: familyAddress(student), bold: false },
                ],
                siblings,
                history,
                fees,
                feesNote,
                printedAt: new Date().toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Karachi",
                }).toUpperCase(),
                printedBy: user ? `${user.fullName || user.username} (${user.username})`.toUpperCase() : "STAFF",
            };

            const blob = await pdf(<StudentProfilePDF data={data} />).toBlob();
            const url = URL.createObjectURL(blob);
            if (win) win.location.href = url;
            else window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);

            api.post(`/v1/enrollments/${cc}/log-certificate-generation`, {
                document_type: "Student Profile",
                note: `PRINTED THE STUDENT PROFILE FOR ${student.full_name ?? `CC ${cc}`}`,
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
