"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { ArrowLeft, Check, Ban, Loader2, Search, Pin, FileText, Users, ShieldCheck } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useNoticeBoardAccess } from "@/hooks/use-notice-board-access";
import { type Post, type NoticePostStatus, buildNameMaps, audienceBadges } from "../notice-shared";

// Superadmin review queue for notice board posts. Every post by a
// non-superadmin waits here as PENDING; nothing reaches families (feed or
// push) until it is approved.

const TABS: { id: NoticePostStatus; label: string }[] = [
    { id: "PENDING", label: "Pending" },
    { id: "REJECTED", label: "Rejected" },
    { id: "APPROVED", label: "Approved" },
];

function errorMessage(err: unknown, fallback: string): string {
    const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
    return Array.isArray(msg) ? msg.join(", ") : msg || fallback;
}

export default function NoticeReviewPage() {
    const access = useNoticeBoardAccess();
    const [tab, setTab] = useState<NoticePostStatus>("PENDING");
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [pendingCount, setPendingCount] = useState<number | null>(null);
    const [campuses, setCampuses] = useState<Parameters<typeof buildNameMaps>[0]>([]);
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const searchTimer = useRef<NodeJS.Timeout | null>(null);

    // Per-card action state
    const [busyId, setBusyId] = useState<number | null>(null);
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [cardError, setCardError] = useState<{ id: number; message: string } | null>(null);

    const nameMaps = buildNameMaps(campuses);

    useEffect(() => {
        if (!access.isSuperAdmin) return;
        api.get("v1/campuses")
            .then(res => setCampuses(Array.isArray(res.data) ? res.data : res.data?.data ?? []))
            .catch(() => {});
        refreshCount();
    }, [access.isSuperAdmin]);

    useEffect(() => {
        if (!access.isSuperAdmin) return;
        fetchPage(undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [access.isSuperAdmin, tab, debouncedQuery]);

    function onQueryChange(value: string) {
        setQuery(value);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setDebouncedQuery(value.trim()), 300);
    }

    async function refreshCount() {
        try {
            const res = await api.get("v1/admin/notice-board/review/count");
            setPendingCount(res.data?.pending ?? 0);
        } catch {
            setPendingCount(null);
        }
    }

    async function fetchPage(cursor: number | undefined) {
        if (cursor) setLoadingMore(true);
        else setLoading(true);
        try {
            const res = await api.get("v1/admin/notice-board/review", {
                params: { status: tab, cursor, q: debouncedQuery || undefined },
            });
            const rows: Post[] = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
            setPosts(prev => (cursor ? [...prev, ...rows] : rows));
            setHasMore(rows.length === 30);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }

    function dropFromList(id: number) {
        setPosts(prev => prev.filter(p => p.id !== id));
        setPendingCount(c => (c == null ? c : Math.max(0, c - 1)));
    }

    async function approve(post: Post) {
        setBusyId(post.id);
        setCardError(null);
        try {
            await api.patch(`v1/admin/notice-board/${post.id}/approve`);
            dropFromList(post.id);
        } catch (err) {
            setCardError({ id: post.id, message: errorMessage(err, "Could not approve this post.") });
            refreshCount();
        } finally {
            setBusyId(null);
        }
    }

    async function reject(post: Post) {
        const reason = rejectReason.trim();
        if (!reason) return;
        setBusyId(post.id);
        setCardError(null);
        try {
            await api.patch(`v1/admin/notice-board/${post.id}/reject`, { reason });
            dropFromList(post.id);
            setRejectingId(null);
            setRejectReason("");
        } catch (err) {
            setCardError({ id: post.id, message: errorMessage(err, "Could not reject this post.") });
            refreshCount();
        } finally {
            setBusyId(null);
        }
    }

    if (!access.isSuperAdmin) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-zinc-500">
                <ShieldCheck className="h-10 w-10 opacity-30" />
                <p className="text-sm">Only a superadmin can review notice board posts.</p>
                <Link href="/notice-board" className="text-sm font-semibold text-primary hover:underline">Back to Notice Board</Link>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <Link href="/notice-board" className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors" title="Back to Notice Board">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Review Notices</h1>
                        <p className="text-xs text-zinc-500">Posts by staff other than superadmins go live only once approved here.</p>
                    </div>
                </div>
                <div className="relative">
                    <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        value={query}
                        onChange={e => onQueryChange(e.target.value)}
                        placeholder="Search title, text or author"
                        className="h-9 w-64 pl-9 pr-3 text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                </div>
            </div>

            <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => { setTab(t.id); setRejectingId(null); setCardError(null); }}
                        className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                            tab === t.id ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                    >
                        {t.label}
                        {t.id === "PENDING" && !!pendingCount && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">{pendingCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
            ) : posts.length === 0 ? (
                <p className="text-center text-zinc-400 text-sm py-16">
                    {debouncedQuery
                        ? `No ${tab.toLowerCase()} posts match "${debouncedQuery}".`
                        : tab === "PENDING" ? "Nothing waiting for approval." : `No ${tab.toLowerCase()} posts yet.`}
                </p>
            ) : (
                <div className="flex flex-col gap-4">
                    {posts.map(post => (
                        <div key={post.id} className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                            <div className="p-5 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {audienceBadges(post, campuses, nameMaps).map((b, i) => (
                                            <span key={i} className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${b.color}`}>{b.label}</span>
                                        ))}
                                        {post.is_pinned && <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 flex items-center gap-1"><Pin className="h-3 w-3" />Pinned</span>}
                                        {post.notification_only && <span className="text-xs font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-300 rounded-full px-2.5 py-0.5">Notification only</span>}
                                    </div>
                                    {typeof post.total_reached === "number" && (
                                        <span className="text-xs text-zinc-500 flex items-center gap-1 whitespace-nowrap">
                                            <Users className="h-3.5 w-3.5" /> {post.total_reached} {post.total_reached === 1 ? "family" : "families"}
                                        </span>
                                    )}
                                </div>

                                {post.title && <p className="font-bold text-zinc-800 dark:text-zinc-100">{post.title}</p>}
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{post.body}</p>

                                {post.media_urls?.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {post.media_urls.map((url, i) =>
                                            post.media_types?.[i] === "image" ? (
                                                <a key={url} href={url} target="_blank" rel="noreferrer">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={url} alt="" className="h-24 w-24 object-cover rounded-lg border border-zinc-200 dark:border-zinc-800" />
                                                </a>
                                            ) : (
                                                <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-primary border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                                                    <FileText className="h-3.5 w-3.5" /> {post.media_types?.[i] === "video" ? "Video" : post.media_types?.[i] === "pdf" ? "PDF" : "File"} {i + 1}
                                                </a>
                                            ),
                                        )}
                                    </div>
                                )}

                                {post.targeted_students && post.targeted_students.length > 0 && (
                                    <p className="text-xs text-zinc-500">
                                        <span className="font-semibold">Students:</span>{" "}
                                        {post.targeted_students.map(s => `${s.full_name} (GR ${s.gr_number || s.cc})`).join(", ")}
                                    </p>
                                )}

                                <p className="text-xs text-zinc-400">
                                    By <span className="font-semibold text-zinc-600 dark:text-zinc-300">{post.users.full_name}</span>
                                    {tab === "PENDING"
                                        ? ` · submitted ${formatDistanceToNow(new Date(post.posted_at), { addSuffix: true })}`
                                        : post.reviewed_at && ` · ${tab === "APPROVED" ? "approved" : "rejected"}${post.reviewer?.full_name ? ` by ${post.reviewer.full_name}` : ""} on ${format(new Date(post.reviewed_at), "d MMM yyyy, h:mm a")}`}
                                    {post.expires_at && ` · expires ${format(new Date(post.expires_at), "d MMM yyyy")}`}
                                </p>

                                {tab === "REJECTED" && post.review_reason && (
                                    <p className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 rounded-lg px-3 py-2">
                                        <span className="font-semibold">Reason:</span> {post.review_reason}
                                    </p>
                                )}

                                {cardError?.id === post.id && (
                                    <p className="text-sm text-rose-600">{cardError.message}</p>
                                )}
                            </div>

                            {tab === "PENDING" && (
                                <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40">
                                    {rejectingId === post.id ? (
                                        <div className="flex flex-col gap-2">
                                            <textarea
                                                autoFocus
                                                value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)}
                                                maxLength={500}
                                                rows={2}
                                                placeholder="Why isn't this going out? The author sees this."
                                                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-rose-300"
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => { setRejectingId(null); setRejectReason(""); }}
                                                    className="px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => reject(post)}
                                                    disabled={busyId === post.id || !rejectReason.trim()}
                                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-40 flex items-center gap-1.5"
                                                >
                                                    {busyId === post.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => { setRejectingId(post.id); setRejectReason(""); setCardError(null); }}
                                                disabled={busyId === post.id}
                                                className="px-3 py-1.5 text-xs font-semibold text-rose-600 border border-rose-200 dark:border-rose-900/50 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 flex items-center gap-1.5"
                                            >
                                                <Ban className="h-3.5 w-3.5" /> Reject
                                            </button>
                                            <button
                                                onClick={() => approve(post)}
                                                disabled={busyId === post.id}
                                                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1.5"
                                            >
                                                {busyId === post.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                Approve &amp; publish
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {hasMore && (
                        <button
                            onClick={() => fetchPage(posts[posts.length - 1]?.id)}
                            disabled={loadingMore}
                            className="self-center px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40 flex items-center gap-1.5"
                        >
                            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Load more
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
