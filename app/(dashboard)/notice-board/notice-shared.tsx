// Shared by the Notice Board feed and its superadmin review page.

export const STATUS_OPTIONS: { id: string; label: string }[] = [
    { id: "QUICK_ADMISSION", label: "Quick Admission" },
    { id: "ENROLLED", label: "Enrolled" },
    { id: "SOFT_ADMISSION", label: "Soft Admission" },
    { id: "EXPELLED", label: "Expelled" },
    { id: "GRADUATED", label: "Graduated" },
    { id: "LEFT", label: "Left" },
];

/** PENDING until a superadmin approves; only APPROVED posts reach families. */
export type NoticePostStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Post {
    id: number;
    title: string | null;
    body: string;
    campus_ids: number[];
    class_ids: number[];
    section_ids: number[];
    student_ccs: number[];
    student_statuses: string[];
    academic_years: string[];
    targeted_students?: { cc: number; full_name: string; gr_number: string; household_name?: string }[];
    media_urls: string[];
    media_types: string[];
    is_pinned: boolean;
    notification_only: boolean;
    posted_at: string;
    expires_at: string | null;
    deleted_at: string | null;
    status?: NoticePostStatus;
    reviewed_at?: string | null;
    review_reason?: string | null;
    reviewer?: { full_name: string } | null;
    /** Poster's user id. */
    posted_by?: string;
    users: { full_name: string };
    _count: { post_reads: number };
    total_reached?: number;
    /** False when the post reached the viewer's students but its audience goes beyond their scope: view only. */
    viewer_can_manage?: boolean;
}

/** The bits of a GET /v1/campuses row the audience labels read. */
export type CampusLike = {
    id: number;
    campus_name?: string;
    offered_classes?: { id?: number; description: string; sections?: { id?: number; description: string }[] }[];
};

export type NameMaps = { classNameMap: Map<number, string>; sectionNameMap: Map<number, string> };

/** Class/section name lookup from the campuses payload. */
export function buildNameMaps(campuses: CampusLike[]): NameMaps {
    const classNameMap = new Map<number, string>();
    const sectionNameMap = new Map<number, string>();
    for (const c of campuses) {
        for (const oc of (c.offered_classes ?? [])) {
            if (oc.id) classNameMap.set(oc.id, oc.description);
            for (const s of (oc.sections ?? [])) {
                if (s.id) sectionNameMap.set(s.id, s.description);
            }
        }
    }
    return { classNameMap, sectionNameMap };
}

export function audienceBadges(post: Post, campuses: CampusLike[], { classNameMap, sectionNameMap }: NameMaps): { label: string; color: string }[] {
    const badges: { label: string; color: string }[] = [];
    if (post.student_ccs?.length) {
        badges.push({ label: `Targeted: ${post.student_ccs.length} student${post.student_ccs.length > 1 ? "s" : ""}`, color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" });
    }
    if (!post.campus_ids.length && !post.class_ids.length && !post.section_ids.length && !post.student_statuses?.length && !post.academic_years?.length) {
        if (!post.student_ccs?.length) {
            badges.push({ label: "School-wide", color: "bg-zinc-200 dark:bg-zinc-700 text-zinc-500" });
        }
        return badges;
    }
    if (post.campus_ids.length) {
        for (const id of post.campus_ids) {
            const name = campuses.find(c => c.id === id)?.campus_name;
            if (name) badges.push({ label: name, color: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" });
        }
    }
    if (post.class_ids.length) {
        for (const id of post.class_ids) {
            const name = classNameMap.get(id);
            if (name) badges.push({ label: name, color: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" });
        }
    }
    if (post.section_ids.length) {
        for (const id of post.section_ids) {
            const name = sectionNameMap.get(id);
            if (name) badges.push({ label: name, color: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" });
        }
    }
    if (post.student_statuses?.length) {
        for (const s of post.student_statuses) {
            const name = STATUS_OPTIONS.find(o => o.id === s)?.label;
            if (name) badges.push({ label: name, color: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300" });
        }
    }
    if (post.academic_years?.length) {
        for (const y of post.academic_years) {
            badges.push({ label: y, color: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300" });
        }
    }
    return badges;
}

/** "Awaiting approval" / "Rejected" chip. Renders nothing for a live post. */
export function ReviewStatusBadge({ status, size = "sm" }: { status?: NoticePostStatus; size?: "xs" | "sm" }) {
    if (status !== "PENDING" && status !== "REJECTED") return null;
    const cls = size === "xs" ? "text-[9px] rounded px-1 py-px" : "text-xs rounded-full px-2.5 py-0.5";
    return status === "PENDING" ? (
        <span className={`${cls} font-bold flex-shrink-0 text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300`}>
            {size === "xs" ? "AWAITING APPROVAL" : "Awaiting approval"}
        </span>
    ) : (
        <span className={`${cls} font-bold flex-shrink-0 text-rose-700 bg-rose-100 dark:bg-rose-900/40 dark:text-rose-300`}>
            {size === "xs" ? "REJECTED" : "Rejected"}
        </span>
    );
}
