/**
 * Student search (TAFSD-344) matches far more than name / CC: phones, CNICs,
 * guardians and families. A student found through a guardian's phone looks
 * unrelated to what was typed, so show the server's reason. CC and name
 * matches are self-explanatory and stay hidden.
 */

export const STUDENT_SEARCH_PLACEHOLDER = "Search name, CC, GR, phone, CNIC or guardian…";

const OBVIOUS = new Set(["C.C.", "Name"]);

export function StudentMatchReason({ matchedOn, className = "" }: { matchedOn?: string | null; className?: string }) {
    if (!matchedOn || OBVIOUS.has(matchedOn)) return null;
    return (
        <span
            className={`block truncate text-[10px] font-medium text-primary/80 ${className}`}
            title={`Matched on ${matchedOn}`}
        >
            Matched: {matchedOn}
        </span>
    );
}
