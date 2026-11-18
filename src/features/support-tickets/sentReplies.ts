import api from "@/lib/api";
import type { TicketLane } from "@/store/slices/supportTicketsSlice";

/**
 * The "Sent" tab (TAFSD-536): the signed-in staff member's own ticket replies
 * and the review status a super admin gave each. One definition of the
 * GET v1/support-tickets/sent contract for the page and its list.
 */

export type SentReplyStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Filter values, in chip order. Empty selection means every status. */
export const SENT_FILTERS = ["pending", "approved", "rejected"] as const;
export type SentFilter = (typeof SENT_FILTERS)[number];

export const SENT_FILTER_LABEL: Record<SentFilter, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export interface SentReply {
  id: string;
  message_type: string;
  /** Text cut to a preview, or [IMAGE] / [VOICE] / [DOCUMENT]. */
  snippet: string;
  status: SentReplyStatus;
  created_at: string;
  reviewed_at: string | null;
  review_comment: string | null;
  reviewer: { id: string; full_name: string } | null;
  ticket: {
    id: string;
    status: "OPEN" | "ASSIGNED" | "CLOSED";
    category: "GENERAL" | "FINANCIAL";
    subtopic: string | null;
    flow_path: { key: string; type: string; label: string }[] | null;
    /** Flow path without lane and child steps, or the legacy subtopic. */
    topic: string | null;
    lane: Omit<TicketLane, "id"> | null;
    lane_name: string | null;
    families: { id: number; household_name: string } | null;
    students: { cc: number; full_name: string } | null;
  };
}

export interface SentReplyCounts {
  all: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface SentRepliesPage {
  items: SentReply[];
  total: number;
  take: number;
  skip: number;
  counts: SentReplyCounts;
}

export const EMPTY_SENT_COUNTS: SentReplyCounts = { all: 0, pending: 0, approved: 0, rejected: 0 };

/** Parses ?sent=approved,rejected; unknown values are dropped, empty means all. */
export function parseSentFilters(raw: string | null | undefined): SentFilter[] {
  const wanted = new Set((raw ?? "").split(",").map((s) => s.trim().toLowerCase()));
  return SENT_FILTERS.filter((f) => wanted.has(f));
}

export async function fetchSentReplies(
  filters: SentFilter[],
  take = 50,
  skip = 0,
): Promise<SentRepliesPage> {
  const res = await api.get("v1/support-tickets/sent", {
    params: {
      status: filters.length ? filters.join(",") : "all",
      take,
      skip,
    },
  });
  const body = (res.data?.data ?? res.data) as Partial<SentRepliesPage>;
  return {
    items: body.items ?? [],
    total: body.total ?? 0,
    take: body.take ?? take,
    skip: body.skip ?? skip,
    counts: body.counts ?? EMPTY_SENT_COUNTS,
  };
}
