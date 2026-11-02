// TAFSD-455: the fee benefit categories a student can hold. Mirrors the
// backend's STUDENT_BENEFITS. Full names only: never FE / COMP / SES / SEI.

export const STUDENT_BENEFITS = [
    { key: "FEE_ENDOWMENT", label: "Fee Endowment", prefix: "fee_endowment", tone: "amber", hint: "Everything waived" },
    { key: "FEE_ENDOWMENT_MTF", label: "Fee Endowment (Monthly Tuition Fee)", prefix: "fee_endowment_mtf", tone: "orange", hint: "Monthly Tuition Fee waived; other heads charged" },
    { key: "COMPLEMENTARY", label: "Complementary", prefix: "complementary", tone: "emerald", hint: "Everything waived" },
    { key: "SEHM_E_SADAAT", label: "Sehm-e-Sadaat", prefix: "sehm_e_sadaat", tone: "sky", hint: "Everything waived" },
    { key: "SEHM_E_IMAM", label: "Sehm-e-Imam", prefix: "sehm_e_imam", tone: "violet", hint: "Everything waived" },
] as const;

export type StudentBenefit = (typeof STUDENT_BENEFITS)[number];
export type StudentBenefitKey = StudentBenefit["key"];

export const benefitLabel = (key: string) =>
    STUDENT_BENEFITS.find((b) => b.key === key)?.label ?? key;

export interface BenefitState {
    on: boolean;
    reason: string;
    /** YYYY-MM-DD or "". */
    until: string;
    /** YYYY-MM-DD or "": when the home reminder starts. */
    remind_from: string;
}
export type BenefitsState = Record<StudentBenefitKey, BenefitState>;

const day = (v: unknown) => (v ? String(v).slice(0, 10) : "");

export function benefitsFromStudent(s: Record<string, unknown> | null | undefined): BenefitsState {
    return Object.fromEntries(
        STUDENT_BENEFITS.map((b) => [
            b.key,
            {
                on: !!s?.[`is_${b.prefix}`],
                reason: String(s?.[`${b.prefix}_reason`] ?? ""),
                until: day(s?.[`${b.prefix}_until`]),
                remind_from: day(s?.[`${b.prefix}_remind_from`]),
            },
        ]),
    ) as BenefitsState;
}

export const emptyBenefits = () => benefitsFromStudent(null);

/** The first benefit switched on without a reason or end date, if any. */
export function benefitMissing(state: BenefitsState): StudentBenefit | undefined {
    return STUDENT_BENEFITS.find((b) => {
        const v = state[b.key];
        return v.on && (!v.reason.trim() || !v.until);
    });
}

/** PATCH body for /staff-editing/students/:cc. Off benefits clear their details. */
export function benefitsPayload(state: BenefitsState): Record<string, boolean | string | null> {
    const out: Record<string, boolean | string | null> = {};
    for (const b of STUDENT_BENEFITS) {
        const v = state[b.key];
        out[`is_${b.prefix}`] = v.on;
        out[`${b.prefix}_reason`] = v.on ? v.reason.trim() : null;
        out[`${b.prefix}_until`] = v.on ? v.until : null;
        out[`${b.prefix}_remind_from`] = v.on && v.remind_from ? v.remind_from : null;
    }
    return out;
}

export const benefitsChanged = (a: BenefitsState, b: BenefitsState) =>
    JSON.stringify(a) !== JSON.stringify(b);
