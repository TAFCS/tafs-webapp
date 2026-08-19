/**
 * The one-line identity of a person shown next to their name whenever a device
 * PIN is being pointed at them — in the picker, in the suggestion cells, and in
 * the confirm dialog that actually commits the link.
 *
 * A name and a GR number are not enough to tell two same-named children apart,
 * and a PIN confirmed onto the wrong one rewrites real attendance, so class and
 * section travel with the name everywhere the decision is made.
 */
export interface PersonMetaSource {
    /** Present on staff. */
    id?: number;
    /** Present on students. */
    cc?: number;
    employee_code?: string | null;
    gr_number?: string | null;
    classes?: { description: string | null } | null;
    sections?: { description: string | null } | null;
    campuses?: { campus_name: string | null } | null;
}

export function personMetaLine(p: PersonMetaSource | null | undefined): string {
    if (!p) return "";
    if (p.cc === undefined) {
        return p.employee_code ? `Code ${p.employee_code}` : "";
    }
    return [
        p.gr_number ? `GR ${p.gr_number}` : `CC #${p.cc}`,
        // Labelled, because a bare "B" next to a class code reads as noise.
        p.classes?.description ? `Class ${p.classes.description}` : null,
        p.sections?.description ? `Sec ${p.sections.description}` : null,
        p.campuses?.campus_name,
    ]
        .filter(Boolean)
        .join(" · ");
}
